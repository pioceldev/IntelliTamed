"""Vues des comptes : inscription, profil, onboarding, stats admin."""
from django.db.models import Count
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.ai.models import AIRequest
from apps.action_plans.models import ActionPlan
from apps.opportunities.models import Opportunity
from apps.projects.models import Project
from apps.subscriptions.models import Subscription

from .models import Profile, User
from .serializers import ProfileSerializer, RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    """POST /api/auth/register — crée un utilisateur + profil."""

    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"


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
