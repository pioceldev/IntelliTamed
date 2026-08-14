"""Vues de l'assistant IA : conversation + appel Gemini persisté."""
import logging

from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AIRequest, Conversation, Message
from .serializers import (
    AssistantRequestSerializer,
    ConversationDetailSerializer,
    ConversationSerializer,
    MessageSerializer,
)
from .services import DEFAULT_MODEL, GeminiError, GeminiService

logger = logging.getLogger("intellitamed.ai")


class AssistantView(APIView):
    """POST /api/assistant — envoie un message, appelle Gemini, persiste tout."""

    permission_classes = [IsAuthenticated]
    throttle_scope = "assistant"

    def post(self, request):
        serializer = AssistantRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        message = data["message"].strip()

        # Conversation existante ou nouvelle
        conv = None
        if data.get("conversation_id"):
            conv = get_object_or_404(
                Conversation, pk=data["conversation_id"], user=request.user
            )
        else:
            title = (data.get("title") or message)[:60]
            conv = Conversation.objects.create(user=request.user, title=title)

        # Persistance du message utilisateur
        Message.objects.create(conversation=conv, role=Message.Role.USER, content=message)

        # Historique pour le contexte
        history = [
            {"role": m.role, "text": m.content}
            for m in conv.messages.all().order_by("created_at")
        ]

        ai_req = AIRequest.objects.create(
            user=request.user, request_type=AIRequest.RequestType.ASSISTANT
        )
        try:
            reply = GeminiService.generate(message, history=history)
        except GeminiError as exc:
            ai_req.status = AIRequest.Status.ERROR
            ai_req.error = str(exc)
            ai_req.save()
            return Response({"error": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        Message.objects.create(conversation=conv, role=Message.Role.MODEL, content=reply)
        ai_req.status = AIRequest.Status.SUCCESS
        ai_req.model_used = DEFAULT_MODEL
        ai_req.save()

        if not conv.title and len(message) > 60:
            conv.title = message[:60]
            conv.save(update_fields=["title"])

        return Response(
            {
                "reply": reply,
                "conversation_id": conv.id,
                "title": conv.title,
            },
            status=status.HTTP_201_CREATED,
        )


class ConversationViewSet(viewsets.ModelViewSet):
    """CRUD des conversations de l'utilisateur connecté."""

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Conversation.objects.filter(user=self.request.user)
        if self.action == "retrieve":
            return qs.prefetch_related("messages")
        return qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ConversationDetailSerializer
        return ConversationSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = ConversationDetailSerializer(instance)
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
