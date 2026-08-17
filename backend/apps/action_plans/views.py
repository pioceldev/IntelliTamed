"""Vues des plans d'action et de leurs étapes."""
import logging

from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.ai.models import AIRequest
from apps.ai.services import GeminiError, GeminiService, build_user_context
from apps.projects.models import Project

from .models import ActionPlan, ActionStep
from .serializers import ActionPlanSerializer, ActionStepSerializer

logger = logging.getLogger("intellitamed.action_plans")


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

    @action(detail=False, methods=["post"])
    def generate(self, request):
        """POST /api/action-plans/generate — génère un plan avec Gemini depuis un projet."""
        project_id = request.data.get("project_id")
        project = get_object_or_404(Project, pk=project_id, owner=request.user)

        ai_req = AIRequest.objects.create(
            user=request.user, request_type=AIRequest.RequestType.ACTION_PLAN
        )
        try:
            data = GeminiService.generate_action_plan(
                project, context=build_user_context(request.user)
            )
        except (GeminiError, ValueError) as exc:
            ai_req.status = AIRequest.Status.ERROR
            ai_req.error = str(exc)
            ai_req.save()
            return Response({"error": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        plan = ActionPlan.objects.create(
            user=request.user,
            project=project,
            title=data["title"],
            description=data["description"],
        )
        for order, step in enumerate(data["steps"]):
            ActionStep.objects.create(
                plan=plan,
                title=step["title"],
                description=step["description"],
                category=step["category"],
                priority=step["priority"],
                phase=step["phase"],
                order=order,
            )
        ai_req.status = AIRequest.Status.SUCCESS
        ai_req.save()

        return Response(
            ActionPlanSerializer(plan).data, status=status.HTTP_201_CREATED
        )


class ActionStepViewSet(viewsets.ModelViewSet):
    """CRUD des étapes (la progression du plan est recalculée automatiquement)."""

    serializer_class = ActionStepSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ActionStep.objects.filter(plan__user=self.request.user)

    def perform_update(self, serializer):
        serializer.save()
