"""Vues des abonnements : lecture du plan et changement de plan."""
from datetime import timedelta

from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Subscription


class SubscriptionView(APIView):
    """GET/POST /api/subscriptions — l'abonnement de l'utilisateur connecté."""

    permission_classes = [permissions.IsAuthenticated]

    def _get_or_create(self, user):
        sub, _ = Subscription.objects.get_or_create(user=user)
        return sub

    def _serialize(self, sub):
        plan_labels = dict(Subscription.Plan.choices)
        status_labels = dict(Subscription.Status.choices)
        trial_ends = None
        if sub.status == Subscription.Status.TRIAL and sub.start_date:
            trial_ends = (sub.start_date + timedelta(days=14)).isoformat()
        return {
            "id": sub.id,
            "plan": sub.plan,
            "plan_label": plan_labels.get(sub.plan, sub.plan),
            "status": sub.status,
            "status_label": status_labels.get(sub.status, sub.status),
            "start_date": sub.start_date.isoformat() if sub.start_date else None,
            "end_date": sub.end_date.isoformat() if sub.end_date else None,
            "trial_ends": trial_ends,
            "days_left": (
                (sub.start_date + timedelta(days=14) - timezone.now().date()).days
                if sub.status == Subscription.Status.TRIAL and sub.start_date
                else None
            ),
        }

    def get(self, request):
        sub = self._get_or_create(request.user)
        return Response(self._serialize(sub))

    def post(self, request):
        """POST — change de plan (starter / pro / enterprise)."""
        plan = (request.data.get("plan") or "").strip().lower()
        if plan not in Subscription.Plan.values:
            return Response(
                {"plan": ["Plan invalide. Choisissez : starter, pro, enterprise."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sub = self._get_or_create(request.user)
        sub.plan = plan
        sub.status = Subscription.Status.ACTIVE
        sub.end_date = None
        sub.save(update_fields=["plan", "status", "end_date"])
        return Response(self._serialize(sub))
