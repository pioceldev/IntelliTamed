"""Serializers de l'assistant IA."""
from rest_framework import serializers

from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ("id", "role", "content", "created_at")
        read_only_fields = ("id", "created_at")


class ConversationSerializer(serializers.ModelSerializer):
    message_count = serializers.IntegerField(source="messages.count", read_only=True)

    class Meta:
        model = Conversation
        fields = ("id", "title", "created_at", "updated_at", "message_count")
        read_only_fields = ("id", "created_at", "updated_at")


class ConversationDetailSerializer(ConversationSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta(ConversationSerializer.Meta):
        fields = ("id", "title", "created_at", "updated_at", "message_count", "messages")


class AssistantRequestSerializer(serializers.Serializer):
    """Corps de requête de POST /api/assistant."""

    message = serializers.CharField(max_length=4000)
    conversation_id = serializers.IntegerField(required=False, allow_null=True)
    title = serializers.CharField(max_length=200, required=False, allow_blank=True)
