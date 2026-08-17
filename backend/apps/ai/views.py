"""Vues de l'assistant IA : conversation + appel Gemini persisté."""
import logging
import re

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
from .services import DEFAULT_MODEL, GeminiError, GeminiService, build_user_context

logger = logging.getLogger("intellitamed.ai")


# ---------------------------------------------------------------------------
# Commandes : l'utilisateur peut « commander » l'IA pour exécuter des actions
# réelles sur la plateforme (créer un projet, analyser, plan d'action,
# opportunités) directement depuis le chat.
# ---------------------------------------------------------------------------

def _find_project(user, hint):
    """Retrouve un projet de l'utilisateur : correspondance exacte puis sous-chaîne.
    Sans indice, renvoie le projet le plus récent."""
    from apps.projects.models import Project

    projects = list(Project.objects.filter(owner=user).order_by("-updated_at"))
    if not projects:
        return None
    if not hint:
        return projects[0]
    low = hint.lower()
    for p in projects:
        if p.name.lower() == low:
            return p
    for p in projects:
        if low in p.name.lower():
            return p
    return None


def _extract_project_hint(message):
    """Extrait un nom de projet mentionné après « projet » dans une commande."""
    m = re.search(
        r"projet\s+(?:appel[ée]|nomm[ée]|intitul[ée])?\s*[\"']?"
        r"([^\"',.;!?\n]{2,60}?)(?:\s+(?:avec|description|concept)|\s*$)",
        message, re.I,
    )
    return m.group(1).strip() if m else ""


def _extract_create_project(message):
    """Extrait le nom (+ description éventuelle) d'un projet à créer."""
    name = ""
    m = re.search(
        r"(?:appel[ée]|nomm[ée]|intitul[ée])\s+[\"']?"
        r"([^\"',.;!?\n]{2,80}?)(?:\s+(?:avec|description|concept)|\s*$)",
        message, re.I,
    )
    if m:
        name = m.group(1).strip()
    else:
        m = re.search(
            r"projet\s+[\"']?([^\"',.;!?\n]{2,80}?)(?:\s+(?:avec|description|concept)|\s*$)",
            message, re.I,
        )
        if m:
            name = m.group(1).strip()
    desc = ""
    m = re.search(r"(?:description|concept)\s*[\:\-]?\s*(.+)", message, re.I | re.S)
    if m:
        desc = m.group(1).strip()[:500]
    return name, desc


def detect_command(message):
    """Détecte une commande exécutable dans un message utilisateur.

    Retourne (action, params) — action vaut None si c'est une simple conversation.
    Actions : create_project, analyze, action_plan, opportunities.
    """
    msg = message.lower()
    # 1) Créer un projet : « crée un projet », « nouveau projet », « projet appelé … »
    if re.search(r"(?:cr[ée]e|cr[ée]er|nouveau|nouvelle|ajoute|ajouter)\s+(?:un\s+)?(?:nouveau\s+)?projet", msg) or \
       re.search(r"projet\s+(?:appel[ée]|nomm[ée]|intitul[ée]|cr[ée]e)", msg):
        return "create_project", {}
    # 2) Plan d'action : « génère/le plan d'action … »
    if re.search(r"plan\s+d['’]?action", msg):
        return "action_plan", {}
    # 3) Analyse d'un projet : « analyse mon projet … »
    if re.search(r"\banalys", msg) and re.search(r"projet", msg):
        return "analyze", {}
    # 4) Générer des opportunités : « génère/trouve des opportunités »
    if re.search(r"opportunit[ée]s?", msg) and re.search(
        r"(g[ée]n[èe]re|trouve|cherche|cr[ée]e|propose|donne|recommande)", msg
    ):
        return "opportunities", {}
    return None, {}


def execute_command(action, message, user):
    """Exécute une commande détectée et renvoie le message de confirmation du chat.

    Lève ValueError avec un message clair si l'action est impossible
    (projet introuvable, IA indisponible…).
    """
    from apps.action_plans.models import ActionPlan, ActionStep
    from apps.ai.models import AIRequest
    from apps.opportunities.views import generate_opportunities_for_user
    from apps.projects.models import Project, ProjectAnalysis

    if action == "create_project":
        name, desc = _extract_create_project(message)
        if not name:
            raise ValueError(
                "Je n'ai pas compris le nom du projet. Exemple : « crée un projet appelé Marketplace B2B »."
            )
        if Project.objects.filter(owner=user, name__iexact=name).exists():
            raise ValueError("Un projet **« " + name + " »** existe déjà dans votre espace.")
        project = Project.objects.create(
            owner=user, name=name, description=desc, status=Project.Status.IDEA
        )

        # L'IA gère tout en vrai : analyse + plan d'action générés automatiquement
        created_parts = []
        try:
            ai_req = AIRequest.objects.create(
                user=user, request_type=AIRequest.RequestType.ANALYZE
            )
            data = GeminiService.analyze_project(project, context=build_user_context(user))
            analysis = ProjectAnalysis.objects.create(project=project, **data)
            ai_req.status = AIRequest.Status.SUCCESS
            ai_req.model_used = DEFAULT_MODEL
            ai_req.save()
            summary = (analysis.summary or "").strip()
            created_parts.append(
                "**analyse IA**" + (" : " + summary[:150] if summary else "") + " → "
                "voir [Analyse](project-analysis.html)"
            )
        except (GeminiError, ValueError) as exc:
            logger.warning("Auto-analyse échouée pour %s : %s", project.name, exc)

        try:
            ai_req2 = AIRequest.objects.create(
                user=user, request_type=AIRequest.RequestType.ACTION_PLAN
            )
            data2 = GeminiService.generate_action_plan(project, context=build_user_context(user))
            plan = ActionPlan.objects.create(
                user=user, project=project, title=data2["title"], description=data2["description"]
            )
            for order, step in enumerate(data2["steps"]):
                ActionStep.objects.create(
                    plan=plan, title=step["title"], description=step["description"],
                    category=step["category"], priority=step["priority"],
                    phase=step["phase"], order=order,
                )
            ai_req2.status = AIRequest.Status.SUCCESS
            ai_req2.save()
            created_parts.append(
                "**plan d'action** (« " + plan.title + " » — " + str(len(data2["steps"]))
                + " étapes en 4 phases) → voir [Plan d'action](action-plan.html)"
            )
        except (GeminiError, ValueError) as exc:
            logger.warning("Plan d'action auto échoué pour %s : %s", project.name, exc)

        reply = "✅ **Projet créé !** « " + name + " » est maintenant dans votre espace (statut : Idée)."
        if created_parts:
            reply += (
                "\n\n🧠 **L'IA a déjà analysé votre projet et mis le contenu en place :**\n"
                "- " + "\n- ".join(created_parts)
            )
        else:
            reply += (
                "\n\n⚠️ Le service IA n'a pas pu générer l'analyse et le plan d'action "
                "automatiquement. Vous pouvez les lancer plus tard : « analyse mon projet "
                + name + " » ou « plan d'action pour " + name + " »."
            )
        reply += (
            "\n\nDites « génère des opportunités » pour trouver des opportunités adaptées à ce projet.\n"
            "→ Voir dans [Mes Projets](projects.html)"
        )
        return reply

    if action == "analyze":
        project = _find_project(user, _extract_project_hint(message))
        if not project:
            raise ValueError(
                "Je n'ai trouvé aucun projet à analyser. Créez d'abord un projet : « crée un projet appelé … »."
            )
        ai_req = AIRequest.objects.create(
            user=user, request_type=AIRequest.RequestType.ANALYZE
        )
        try:
            data = GeminiService.analyze_project(
                project, context=build_user_context(user)
            )
        except GeminiError as exc:
            ai_req.status = AIRequest.Status.ERROR
            ai_req.error = str(exc)
            ai_req.save()
            raise ValueError(str(exc))
        analysis = ProjectAnalysis.objects.create(project=project, **data)
        ai_req.status = AIRequest.Status.SUCCESS
        ai_req.model_used = DEFAULT_MODEL
        ai_req.save()
        parts = ["✅ **Analyse IA terminée** pour « " + project.name + " »."]
        if analysis.summary:
            parts.append("Résumé : " + analysis.summary[:280])
        parts.append("Forces : " + ", ".join(analysis.strengths[:3]) + ".")
        parts.append("Risques : " + ", ".join(analysis.risks[:3]) + ".")
        parts.append("→ Voir le rapport complet dans [Analyse](project-analysis.html)")
        return "\n".join(parts)

    if action == "action_plan":
        project = _find_project(user, _extract_project_hint(message))
        if not project:
            raise ValueError(
                "Je n'ai trouvé aucun projet pour le plan d'action. Créez d'abord un projet : « crée un projet appelé … »."
            )
        ai_req = AIRequest.objects.create(
            user=user, request_type=AIRequest.RequestType.ACTION_PLAN
        )
        try:
            data = GeminiService.generate_action_plan(
                project, context=build_user_context(user)
            )
        except (GeminiError, ValueError) as exc:
            ai_req.status = AIRequest.Status.ERROR
            ai_req.error = str(exc)
            ai_req.save()
            raise ValueError(str(exc))
        plan = ActionPlan.objects.create(
            user=user, project=project, title=data["title"], description=data["description"]
        )
        for order, step in enumerate(data["steps"]):
            ActionStep.objects.create(
                plan=plan, title=step["title"], description=step["description"],
                category=step["category"], priority=step["priority"],
                phase=step["phase"], order=order,
            )
        ai_req.status = AIRequest.Status.SUCCESS
        ai_req.save()
        return (
            "✅ **Plan d'action généré** pour « " + project.name + " » : **" + plan.title + "** "
            "avec " + str(len(data["steps"])) + " étapes réparties en 4 phases.\n"
            "→ Voir dans [Plan d'action](action-plan.html)"
        )

    if action == "opportunities":
        ai_req = AIRequest.objects.create(
            user=user, request_type=AIRequest.RequestType.RECOMMEND
        )
        try:
            created = generate_opportunities_for_user(user)
        except GeminiError as exc:
            ai_req.status = AIRequest.Status.ERROR
            ai_req.error = str(exc)
            ai_req.save()
            raise ValueError(str(exc))
        ai_req.status = AIRequest.Status.SUCCESS
        ai_req.save()
        titles = " ; ".join(o.title for o in created[:5])
        return (
            "✅ **" + str(len(created)) + " opportunités générées** pour votre profil !\n"
            + titles + "\n"
            "→ Voir dans [Opportunités](opportunities.html)"
        )

    raise ValueError("Commande inconnue.")


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
        action, _ = detect_command(message)
        try:
            if action:
                # Commande exécutable : l'IA fait réellement l'action sur la plateforme
                reply = execute_command(action, message, request.user)
            else:
                # Conversation classique : réponse Gemini avec le contexte utilisateur
                reply = GeminiService.generate(
                    message, history=history, context=build_user_context(request.user)
                )
        except ValueError as exc:
            # Commande impossible (projet introuvable, IA indisponible…) : réponse claire dans le chat
            reply = "⚠️ " + str(exc)
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
