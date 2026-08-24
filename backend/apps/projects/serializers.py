"""Serializers des projets."""
from rest_framework import serializers

from .models import Project, ProjectAnalysis


class ProjectSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source="owner.email")

    class Meta:
        model = Project
        fields = (
            "id", "owner", "name", "description", "problem", "solution",
            "target_audience", "objectives", "business_model", "category",
            "status", "progress", "due_date", "created_at", "updated_at",
        )
        read_only_fields = ("owner", "progress", "created_at", "updated_at")


class ProjectAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectAnalysis
        fields = (
            "id", "project", "summary", "strengths", "weaknesses",
            "opportunities", "risks", "recommendations", "next_steps", "created_at",
        )
        read_only_fields = ("id", "project", "created_at")
