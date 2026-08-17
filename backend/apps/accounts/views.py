"""Vues des comptes : inscription, profil, onboarding, stats admin."""
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.exceptions import ValidationError
from django.db.models import Avg, Count
from django.http import HttpResponseRedirect, JsonResponse
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
import json
import csv
import io
from rest_framework.views import APIView

from .oauth import FRONTEND_BASE, OAuthError, build_authorize_url, exchange_and_get_user

from apps.ai.models import AIRequest
from apps.action_plans.models import ActionPlan
from apps.opportunities.models import Opportunity
from apps.projects.models import Project
from apps.subscriptions.models import Subscription

from .email_service import send_password_reset_email, send_welcome_email
from .models import Profile, User
from .serializers import ProfileSerializer, RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    """POST /api/auth/register — crée un utilisateur + profil + email de bienvenue."""

    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def perform_create(self, serializer):
        user = serializer.save()
        # Email de bienvenue (silencieux si Brevo non configuré)
        send_welcome_email(user)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        user = User.objects.get(email=request.data.get("email", ""))
        token = PasswordResetTokenGenerator().make_token(user)
        response.data["email_verified"] = False
        response.data["verification_token"] = token
        return response


class MeView(generics.RetrieveAPIView):
    """GET /api/auth/me — l'utilisateur connecté."""

    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class ProfileView(generics.RetrieveUpdateAPIView):
    """GET / PUT /api/auth/profile — le profil de l'utilisateur connecté."""

    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        profile, _ = Profile.objects.get_or_create(user=self.request.user)
        return profile


class OnboardingView(APIView):
    """POST /api/auth/onboarding — enregistre les réponses de l'onboarding."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile, _ = Profile.objects.get_or_create(user=request.user)
        allowed = {
            "profile_type", "country", "domain", "skills", "experience",
            "goals", "interests", "ai_preferences",
        }
        data = {k: v for k, v in request.data.items() if k in allowed}
        for key, value in data.items():
            setattr(profile, key, value)
        profile.onboarding_completed = True
        profile.save()
        return Response(ProfileSerializer(profile).data, status=status.HTTP_200_OK)


class SocialLoginView(APIView):
    """OAuth Google / GitHub — login + inscription via un fournisseur externe.

    Flux :
      GET /api/auth/social/{provider}/login      → redirige vers le fournisseur
      GET /api/auth/social/{provider}/callback   → échange le code, redirige vers
          /pages/oauth-callback.html?access=...&refresh=...&new=1|0
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes = []  # pas de JWT requis (pré-authentification)
    throttle_scope = "login"

    def _is_callback(self, request):
        return request.path.rstrip("/").endswith("/callback")

    def get(self, request, provider):
        if self._is_callback(request):
            # Retour du fournisseur : échange du code → redirection frontend
            try:
                user, created, url = exchange_and_get_user(provider, request)
            except OAuthError as exc:
                from urllib.parse import quote
                dest = f"{FRONTEND_BASE}/pages/login.html?oauth_error={quote(str(exc))}"
                return HttpResponseRedirect(dest)
            return HttpResponseRedirect(url)

        # Début du flux : redirige vers le fournisseur (ou login.html si non configuré)
        try:
            url = build_authorize_url(provider, request)
        except OAuthError as exc:
            from urllib.parse import quote
            dest = f"{FRONTEND_BASE}/pages/login.html?oauth_error={quote(str(exc))}"
            return HttpResponseRedirect(dest)
        return HttpResponseRedirect(url)


class PasswordResetView(APIView):
    """POST /api/auth/password-reset — demande de réinitialisation.

    Sans serveur d'email configuré, le token est renvoyé dans la réponse
    (uniquement quand DEBUG=True) pour permettre le flux de démo complet.
    """

    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response(
                {"email": ["Adresse e-mail obligatoire."]}, status=status.HTTP_400_BAD_REQUEST
            )
        user = User.objects.filter(email=email).first()
        # Message identique que le compte existe ou non (pas de fuite d'information)
        data = {
            "message": "Si un compte existe avec cette adresse, un lien de réinitialisation a été envoyé."
        }
        if user:
            token = PasswordResetTokenGenerator().make_token(user)
            sent = send_password_reset_email(user, token)
            # En mode démo : toujours exposer le token pour permettre le flux complet
            # sans avoir besoin d'un service email configuré.
            if settings.DEBUG:
                data["dev_token"] = token
            elif sent:
                data["sent"] = True
                data["sent"] = True
        return Response(data)


class PasswordResetConfirmView(APIView):
    """POST /api/auth/password-reset/confirm — définit un nouveau mot de passe."""

    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        token = request.data.get("token") or ""
        new_password = request.data.get("new_password") or ""
        user = User.objects.filter(email=email).first()
        if not user or not token or not PasswordResetTokenGenerator().check_token(user, token):
            return Response(
                {"error": "Lien de réinitialisation invalide ou expiré."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_password(new_password, user)
        except ValidationError as exc:
            return Response({"new_password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"message": "Mot de passe réinitialisé avec succès."})


class EmailVerifyView(APIView):
    """POST /api/auth/email-verify — vérifie l'e-mail via un token.

    En mode dev (DEBUG=True) sans email réel envoyé, le token est renvoyé
    dans la réponse pour permettre le flux complet localement.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        token = request.data.get("token") or ""
        user = request.user
        if not token or not PasswordResetTokenGenerator().check_token(user, token):
            return Response(
                {"error": "Token de vérification invalide ou expiré."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.email_verified = True
        user.save(update_fields=["email_verified"])
        return Response({"message": "Adresse e-mail vérifiée avec succès.", "email_verified": True})


class ResendVerificationView(APIView):
    """POST /api/auth/email-verify/send — (re)envoie le token de vérification.

    Le token est renvoyé dans la réponse uniquement en mode DEBUG sans
    service email configuré (démo locale). Sinon un email Brevo est envoyé.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.email_verified:
            return Response({"message": "Votre adresse e-mail est déjà vérifiée."})
        token = PasswordResetTokenGenerator().make_token(user)
        data = {"message": "Email de vérification envoyé."}
        if settings.DEBUG:
            data["dev_token"] = token
            data["email"] = user.email
        return Response(data)


class DeleteAccountView(APIView):
    """DELETE /api/auth/account — supprime définitivement le compte et toutes ses données."""

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        user = request.user
        email = user.email
        user.delete()
        return Response({"message": f"Le compte {email} a été supprimé définitivement."})


class ChangePasswordView(APIView):
    """POST /api/auth/change-password — change le mot de passe (ancien requis)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        current = request.data.get("current_password") or ""
        new_password = request.data.get("new_password") or ""
        user = request.user
        if not user.check_password(current):
            return Response(
                {"error": "Le mot de passe actuel est incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_password(new_password, user)
        except ValidationError as exc:
            return Response(
                {"new_password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST
            )
        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"message": "Mot de passe mis à jour avec succès."})


class DashboardView(APIView):
    """GET /api/auth/dashboard — statistiques réelles de l'utilisateur connecté.

    Renvoie : projets (total, actifs, progression moyenne), conversations,
    notifications non lues, watchlist, plan d'action en cours, activité récente.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        projects = Project.objects.filter(owner=user)
        active_statuses = [
            Project.Status.IDEA, Project.Status.PREPARATION, Project.Status.DEVELOPMENT,
        ]
        active = projects.filter(status__in=active_statuses)
        total_projects = projects.count()
        active_projects = active.count()
        avg_row = projects.aggregate(avg_progress=Avg("progress"))
        avg_progress = round(avg_row.get("avg_progress") or 0) if total_projects else 0

        plans = ActionPlan.objects.filter(user=user, status=ActionPlan.Status.ACTIVE)
        current_plan = plans.first()
        plan_data = None
        if current_plan:
            steps = current_plan.steps.all()
            plan_data = {
                "id": current_plan.id,
                "title": current_plan.title,
                "progress": current_plan.progress,
                "done": sum(1 for s in steps if s.status == "done"),
                "total": steps.count(),
                "steps": [
                    {
                        "id": s.id,
                        "title": s.title,
                        "status": s.status,
                    }
                    for s in steps[:5]
                ],
            }

        # Activité récente : derniers projets + conversations + notifications
        recent = []
        for p in projects.order_by("-updated_at")[:4]:
            recent.append({
                "type": "project",
                "title": p.name,
                "subtitle": p.get_status_display(),
                "icon": "project",
                "when": p.updated_at.isoformat(),
            })
        for n in user.notifications.all()[:3]:
            recent.append({
                "type": "notification",
                "title": n.title,
                "subtitle": n.content or "",
                "icon": "notif",
                "when": n.created_at.isoformat(),
            })
        recent.sort(key=lambda r: r["when"], reverse=True)
        recent = recent[:6]

        return Response({
            "user": {
                "first_name": user.first_name or user.email.split("@")[0],
                "email": user.email,
                "role": user.role,
            },
            "stats": {
                "active_projects": active_projects,
                "total_projects": total_projects,
                "avg_progress": avg_progress,
                "conversations": user.conversations.count(),
                "unread_notifications": user.notifications.filter(read=False).count(),
                "watchlist": user.watchlist.count(),
            },
            "plan": plan_data,
            "recent_activity": recent,
        })


class AdminUsersView(APIView):
    """GET /api/admin/users — liste des utilisateurs (staff uniquement)."""

    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        users = User.objects.annotate(
            projects_count=Count("projects", distinct=True),
            conversations_count=Count("conversations", distinct=True),
        ).order_by("-date_joined")[:200]
        data = [
            {
                "id": u.id,
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "role": u.role,
                "is_active": u.is_active,
                "is_staff": u.is_staff,
                "projects_count": u.projects_count,
                "conversations_count": u.conversations_count,
                "date_joined": u.date_joined.isoformat(),
                "last_login": u.last_login.isoformat() if u.last_login else None,
            }
            for u in users
        ]
        return Response({"results": data, "count": len(data)})


class AdminProjectsView(APIView):
    """GET /api/admin/projects — liste des projets (staff uniquement)."""

    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        projects = Project.objects.select_related("owner").order_by("-created_at")[:200]
        data = [
            {
                "id": p.id,
                "name": p.name,
                "owner_email": p.owner.email,
                "status": p.status,
                "progress": p.progress,
                "category": p.category,
                "created_at": p.created_at.isoformat(),
            }
            for p in projects
        ]
        return Response({"results": data, "count": len(data)})


class AdminOpportunitiesView(APIView):
    """GET /api/admin/opportunities — consultation des opportunités (staff).

    La création est 100 % dynamique : les opportunités sont générées par l'IA
    pour chaque utilisateur (aucune opportunité statique).
    """

    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        opps = Opportunity.objects.all().order_by("-created_at")[:200]
        data = [
            {
                "id": o.id,
                "title": o.title,
                "organization": o.organization,
                "category": o.category,
                "location": o.location,
                "remote": o.remote,
                "deadline": o.deadline.isoformat() if o.deadline else None,
                "status": o.status,
            }
            for o in opps
        ]
        return Response({"results": data, "count": len(data)})


class AdminStatsView(APIView):
    """GET /api/admin/stats — statistiques globales (staff uniquement)."""

    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        today = timezone.now().date()
        active_cutoff = timezone.now() - timezone.timedelta(days=30)
        stats = {
            "users": User.objects.count(),
            "active_users": User.objects.filter(last_login__gte=active_cutoff).count(),
            "new_users_30d": User.objects.filter(date_joined__gte=active_cutoff).count(),
            "projects": Project.objects.count(),
            "ai_requests": AIRequest.objects.count(),
            "ai_requests_30d": AIRequest.objects.filter(created_at__gte=active_cutoff).count(),
            "ai_errors": AIRequest.objects.filter(status=AIRequest.Status.ERROR).count(),
            "opportunities": Opportunity.objects.filter(status=Opportunity.Status.ACTIVE).count(),
            "action_plans": ActionPlan.objects.count(),
            "subscriptions": Subscription.objects.values("plan").annotate(count=Count("id")),
            "requests_by_type": AIRequest.objects.values("request_type").annotate(count=Count("id")),
        }
        return Response(stats)


def export_projects_csv(request):
    """Export tous les projets en CSV."""
    projects = Project.objects.select_related("owner").all()
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="projects_export.csv"'
    writer = csv.writer(response)
    writer.writerow(["ID", "Name", "Owner", "Status", "Progress", "Category", "Created"])
    for p in projects:
        writer.writerow([
            p.id, p.name, p.owner.email if p.owner else "",
            p.status, p.progress, p.category or "",
            p.created_at.isoformat()
        ])
    return response


def export_action_plans_json(request):
    """Export tous les plans d'action en JSON."""
    plans = ActionPlan.objects.select_related("user").all()
    data = [
        {
            "id": p.id, "title": p.title, "description": p.description,
            "status": p.status, "progress": p.progress, "user_email": p.user.email,
            "created_at": p.created_at.isoformat()
        }
        for p in plans
    ]
    response = HttpResponse(json.dumps(data), content_type="application/json")
    response["Content-Disposition"] = 'attachment; filename="action_plans_export.json"'
    return response


def export_opportunities_csv(request):
    """Export toutes les opportunités en CSV."""
    opps = Opportunity.objects.select_related("user").all()
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="opportunities_export.csv"'
    writer = csv.writer(response)
    writer.writerow(["ID", "Title", "Organization", "Category", "Remote", "Deadline", "Status"])
    for o in opps:
        writer.writerow([
            o.id, o.title, o.organization, o.category,
            o.remote, o.deadline.isoformat() if o.deadline else "",
            o.status
        ])
    return response
