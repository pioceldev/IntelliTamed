"""Vues des opportunités : consultation (100 % IA), filtres, génération, sauvegarde."""
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.ai.services import GeminiError, GeminiService
from apps.projects.models import Project

from .models import Opportunity, Watchlist
from .serializers import OpportunitySerializer, WatchlistSerializer


def generate_opportunities_for_user(user):
    """Génère et persiste des opportunités personnalisées via Gemini pour un utilisateur.

    Retourne la liste des opportunités créées (instances de modèle).
    Lève GeminiError si l'IA ne répond pas ou ne génère rien de valide.
    """
    profile = getattr(user, "profile", None)

    profile_lines = []
    if profile:
        profile_lines.append(f"Type de profil : {profile.profile_type or 'non renseigné'}")
        profile_lines.append(f"Domaine : {profile.domain or 'non renseigné'}")
        profile_lines.append(f"Pays : {profile.country or 'non renseigné'}")
        profile_lines.append(f"Expérience : {profile.experience or 'non renseignée'}")
        if profile.skills:
            profile_lines.append("Compétences : " + ", ".join(str(s) for s in profile.skills))
        if profile.bio:
            profile_lines.append("Bio : " + profile.bio[:400])
    if not profile_lines:
        profile_lines.append("Profil non complété.")

    projects = list(Project.objects.filter(owner=user).order_by("-updated_at")[:5])
    project_lines = []
    for p in projects:
        project_lines.append(
            f"- {p.name} | statut : {p.get_status_display()} | progression : {p.progress}% | "
            f"catégorie : {p.category or 'non précisée'} | {p.description[:200]}"
        )
    if not project_lines:
        project_lines.append("Aucun projet pour le moment.")

    prompt = (
        "Tu es un expert en venture building. À partir du profil et des projets de cet entrepreneur, "
        "génère 5 opportunités concrètes et réalistes qui lui correspondent (financements, incubateurs, "
        "hackathons, partenariats, missions freelance, formations, concours, emplois, études de marché). "
        "Réponds UNIQUEMENT avec un objet JSON valide (sans texte autour) au format :\n"
        '{"opportunities": [{"title": "...", "organization": "...", '
        '"category": "emploi|freelance|hackathon|concours|formation|financement|incubateur|partenariat|recherche", '
        '"location": "...", "remote": true, "description": "..."}]}\n'
        "Règles : chaque description fait 2 à 4 phrases en français, concrète et actionnable, cohérente "
        "avec le profil et les projets ; ne génère rien d'irréaliste ; varie les catégories.\n\n"
        "PROFIL DE L'UTILISATEUR :\n" + "\n".join(profile_lines)
        + "\n\nPROJETS DE L'UTILISATEUR :\n" + "\n".join(project_lines)
    )

    raw = GeminiService.generate(prompt, max_tokens=8192)
    items = GeminiService.parse_opportunities(raw)
    if not items:
        raise GeminiError("L'IA n'a pas généré d'opportunités valides. Réessayez.")

    return [
        Opportunity.objects.create(
            **item, created_by=user, status=Opportunity.Status.ACTIVE
        )
        for item in items
    ]


class OpportunityViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/opportunities — liste, filtres (category, remote, search)."""

    serializer_class = OpportunitySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["category", "status", "remote"]
    search_fields = ["title", "organization", "description", "location"]

    def get_queryset(self):
        # 100 % dynamique : uniquement les opportunités générées par l'IA
        # pour l'utilisateur connecté (plus aucune opportunité statique).
        return Opportunity.objects.filter(
            status=Opportunity.Status.ACTIVE, created_by=self.request.user
        )

    @action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request):
        """POST /api/opportunities/generate/ — génère des opportunités personnalisées
        via l'IA à partir du profil et des projets de l'utilisateur connecté.
        Les opportunités générées sont persistées (visibles uniquement par lui)."""
        try:
            created = generate_opportunities_for_user(request.user)
        except GeminiError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        serializer = self.get_serializer(created, many=True)
        return Response({"results": serializer.data, "generated": len(created)})

    @action(detail=True, methods=["post", "delete"])
    def save(self, request, pk=None):
        """POST/DELETE /api/opportunities/{id}/save — ajouter/retirer de la watchlist."""
        opportunity = self.get_object()
        watch, created = Watchlist.objects.get_or_create(
            user=request.user, opportunity=opportunity
        )
        if request.method == "DELETE":
            watch.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(
            {"saved": True, "opportunity_id": opportunity.id},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class WatchlistViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/watchlist — les opportunités sauvegardées par l'utilisateur."""

    serializer_class = WatchlistSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Watchlist.objects.filter(user=self.request.user)
