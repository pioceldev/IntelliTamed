"""Vues de l'assistant IA : conversation + appel Gemini persisté."""
import logging

from rest_framework import status, viewsets
from rest_framework.decorators import action

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


def build_user_context(user):
    """Assemble l'état réel de l'utilisateur (profil, projets, plan, activités)
    pour que l'assistant IA personnalise ses réponses — c'est la « mémoire »
    d'activité injectée à chaque message."""
    from apps.action_plans.models import ActionPlan
    from apps.projects.models import Project

    lines = []
    profile = getattr(user, "profile", None)
    if profile:
        lines.append(
            "Profil : type = " + (profile.profile_type or "non renseigné")
            + " ; domaine = " + (profile.domain or "non renseigné")
            + " ; pays = " + (profile.country or "non renseigné")
            + " ; expérience = " + (profile.experience or "non renseignée")
        )
        if profile.skills:
            lines.append("Compétences : " + ", ".join(str(s) for s in profile.skills))
        if profile.bio:
            lines.append("Bio : " + profile.bio[:400])
    else:
        lines.append("Profil : non complété")

    projects = list(Project.objects.filter(owner=user).order_by("-updated_at")[:8])
    if projects:
        lines.append("Projets de l'utilisateur :")
        for p in projects:
            desc = (p.description or "")[:220].replace("\n", " ")
            lines.append(
                "- " + p.name + " | statut : " + p.get_status_display()
                + " | progression : " + str(p.progress) + "%"
                + " | catégorie : " + (p.category or "non précisée")
                + (" | " + desc if desc else "")
            )
    else:
        lines.append("Projets de l'utilisateur : AUCUN projet pour le moment.")

    plan = ActionPlan.objects.filter(user=user, status=ActionPlan.Status.ACTIVE).first()
    if plan:
        lines.append("Plan d'action en cours : " + plan.title + " (progression " + str(plan.progress) + "%)")

    conversations = user.conversations.count()
    unread = user.notifications.filter(read=False).count()
    watch = user.watchlist.count()
    lines.append(
        "Activité : " + str(conversations) + " conversation(s) avec l'assistant, "
        + str(unread) + " notification(s) non lue(s), "
        + str(watch) + " opportunité(s) en watchlist."
    )

    recent = []
    for p in projects[:3]:
        recent.append(p.name + " (" + p.get_status_display() + ")")
    for n in user.notifications.all()[:2]:
        recent.append("Notification : " + n.title)
    if recent:
        lines.append("Activité récente : " + " ; ".join(recent))

    return "\n".join(lines)


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
            reply = GeminiService.generate(
                message, history=history, context=build_user_context(request.user)
            )
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

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        """GET /api/conversations/search?q=terme — recherche dans le titre et le contenu des messages."""
        query = request.query_params.get("q", "").strip()
        if not query:
            return Response({"results": []})
        qs = Conversation.objects.filter(user=request.user).prefetch_related("messages")
        # Recherche dans le titre
        results = qs.filter(title__icontains=query)
        # Ajouter les conversations qui ont des messages contenant le terme
        if not results.exists():
            results = qs.filter(messages__content__icontains=query).distinct()
        # Désactiver le paginateur pour cette action
        serializer = ConversationSerializer(results, many=True)
        return Response({"results": serializer.data})
