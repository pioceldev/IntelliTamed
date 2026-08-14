"""Vues des plans d'action et de leurs étapes."""
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import ActionPlan, ActionStep
from .serializers import ActionPlanSerializer, ActionStepSerializer


class ActionPlanViewSet(viewsets.ModelViewSet):
    """CRUD des plans d'action de l'utilisateur connecté."""

    serializer_class = ActionPlanSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["status"]
    search_fields = ["title", "description"]

    def get_queryset(self):
        return ActionPlan.objects.filter(user=self.request.user).prefetch_related("steps")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["get", "post"])
    def steps(self, request, pk=None):
        """GET / POST /api/action-plans/{id}/steps"""
        plan = self.get_object()
        if request.method == "GET":
            serializer = ActionStepSerializer(plan.steps.all(), many=True)
            return Response(serializer.data)
        serializer = ActionStepSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(plan=plan)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ActionStepViewSet(viewsets.ModelViewSet):
    """CRUD des étapes (la progression du plan est recalculée automatiquement)."""

    serializer_class = ActionStepSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ActionStep.objects.filter(plan__user=self.request.user)

    def perform_update(self, serializer):
        serializer.save()
