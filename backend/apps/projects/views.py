"""Vues des projets : CRUD propriétaire + analyse IA."""
import logging

from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.ai.models import AIRequest
from apps.ai.services import DEFAULT_MODEL, GeminiError, GeminiService

from .models import Project, ProjectAnalysis
from .serializers import ProjectAnalysisSerializer, ProjectSerializer

logger = logging.getLogger("intellitamed.projects")


class ProjectViewSet(viewsets.ModelViewSet):
    """CRUD des projets de l'utilisateur connecté (jamais ceux d'un autre)."""

    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["status", "category"]
    search_fields = ["name", "description", "category"]

    def get_queryset(self):
        return Project.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"])
    def analyze(self, request, pk=None):
        """POST /api/projects/{id}/analyze — analyse structurée via Gemini."""
        project = self.get_object()
        req = AIRequest.objects.create(
            user=request.user, request_type=AIRequest.RequestType.ANALYZE
        )
        try:
            data = GeminiService.analyze_project(project)
        except GeminiError as exc:
            req.status = AIRequest.Status.ERROR
            req.error = str(exc)
            req.save()
            return Response({"error": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        analysis = ProjectAnalysis.objects.create(project=project, **data)
        req.status = AIRequest.Status.SUCCESS
        req.model_used = DEFAULT_MODEL
        req.save()
        return Response(ProjectAnalysisSerializer(analysis).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"])
    def analyze_idea(self, request):
        """POST /api/projects/analyze_idea — analyse une idée brute sans créer de projet."""
        idea = (request.data.get("idea") or "").strip()
        if not idea:
            return Response(
                {"idea": ["Décrivez votre idée (au moins quelques mots)."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(idea) > 4000:
            return Response(
                {"idea": ["Idée trop longue (4000 caractères max)."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        req = AIRequest.objects.create(
            user=request.user, request_type=AIRequest.RequestType.ANALYZE
        )
        try:
            data = GeminiService.analyze_idea(idea)
        except GeminiError as exc:
            req.status = AIRequest.Status.ERROR
            req.error = str(exc)
            req.save()
            return Response({"error": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        req.status = AIRequest.Status.SUCCESS
        req.model_used = DEFAULT_MODEL
        req.save()
        return Response(data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"])
    def analyses(self, request, pk=None):
        """GET /api/projects/{id}/analyses — analyses précédentes."""
        project = self.get_object()
        analyses = project.analyses.all()
        page = self.paginate_queryset(analyses)
        serializer = ProjectAnalysisSerializer(
            page if page is not None else analyses, many=True
        )
        return self.get_paginated_response(serializer.data) if page is not None else Response(serializer.data)

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        """POST /api/projects/{id}/archive — archive ou restaure un projet."""
        project = self.get_object()
        project.status = Project.Status.ARCHIVED if project.status != Project.Status.ARCHIVED else Project.Status.IDEA
        project.save(update_fields=["status"])
        return Response({"status": project.status, "restored": project.status == Project.Status.IDEA})
