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
