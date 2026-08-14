"""Serializer des notifications."""
from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ("id", "title", "content", "type", "read", "created_at")
        read_only_fields = ("id", "title", "content", "type", "created_at")
