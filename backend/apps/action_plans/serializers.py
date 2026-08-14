"""Serializers des plans d'action."""
from rest_framework import serializers

from .models import ActionPlan, ActionStep


class ActionStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActionStep
        fields = (
            "id", "plan", "title", "description", "category",
            "priority", "status", "phase", "deadline", "order", "created_at",
        )
        read_only_fields = ("id", "plan", "created_at")


class ActionPlanSerializer(serializers.ModelSerializer):
    progress = serializers.IntegerField(read_only=True)
    steps = ActionStepSerializer(many=True, read_only=True)
    step_count = serializers.IntegerField(source="steps.count", read_only=True)

    class Meta:
        model = ActionPlan
        fields = (
            "id", "user", "project", "title", "description",
            "status", "progress", "step_count", "steps", "created_at", "updated_at",
        )
        read_only_fields = ("id", "user", "created_at", "updated_at")
