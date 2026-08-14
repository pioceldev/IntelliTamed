"""Serializers des opportunités."""
from rest_framework import serializers

from .models import Opportunity, Watchlist


# Mots-clés par catégorie : utilisés pour calculer la compatibilité avec le profil.
CATEGORY_KEYWORDS = {
    Opportunity.Category.EMPLOI: ["emploi", "job", "startup", "poste"],
    Opportunity.Category.FREELANCE: ["freelance", "mission", "consulting", "prestation"],
    Opportunity.Category.HACKATHON: ["hackathon", "concours", "code", "prototype"],
    Opportunity.Category.CONCOURS: ["concours", "prix", "compétition"],
    Opportunity.Category.FORMATION: ["formation", "cours", "apprentissage", "skill"],
    Opportunity.Category.FINANCEMENT: ["financement", "levée", "subvention", "fond"],
    Opportunity.Category.INCUBATEUR: ["incubateur", "accélérateur", "programme"],
    Opportunity.Category.PARTENARIAT: ["partenariat", "collaboration", "joint"],
    Opportunity.Category.RECHERCHE: ["recherche", "étude", "marché"],
}


class OpportunitySerializer(serializers.ModelSerializer):
    saved = serializers.SerializerMethodField()
    score = serializers.SerializerMethodField()

    class Meta:
        model = Opportunity
        fields = (
            "id", "title", "organization", "description", "category",
            "location", "remote", "deadline", "link", "status", "saved", "score", "created_at",
        )
        read_only_fields = ("id", "created_at")

    def get_saved(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return Watchlist.objects.filter(
                user=request.user, opportunity=obj
            ).exists()
        return False

    def get_score(self, obj):
        """Score de compatibilité (0-100) basé sur le profil utilisateur.

        Pondération : 50 % catégorie alignée avec le profil (domaine + objectifs),
        30 % correspondance de mots-clés (compétences + intérêts), 20 % télétravail.
        Pas de score aléatoire : le résultat est reproductible et déterministe.
        """
        request = self.context.get("request")
        user = request.user if request else None
        if not user or not user.is_authenticated:
            return 60

        profile = getattr(user, "profile", None)
        domain = (profile.domain if profile else "") or ""
        skills = list((profile.skills if profile else []) or [])
        goals = list((profile.goals if profile else []) or [])
        interests = list((profile.interests if profile else []) or [])
        haystack = " ".join(
            [domain.lower(), " ".join(skills).lower(), " ".join(goals).lower(), " ".join(interests).lower()]
        )
        haystack = (haystack + " " + obj.title.lower() + " " + obj.description.lower())[:4000]

        score = 50.0

        # 1) Catégorie vs domaine / objectifs
        category_terms = CATEGORY_KEYWORDS.get(obj.category, [])
        hits = sum(1 for term in category_terms if term in haystack)
        score += min(hits, 3) * 8  # jusqu'à +24

        # 2) Mots-clés de la catégorie dans le texte de l'opportunité vs profil
        text = (obj.title + " " + obj.description).lower()
        profile_terms = set(skills + goals + interests + [domain])
        if profile_terms:
            text_hits = sum(1 for term in profile_terms if term and term.lower() in text)
            score += min(text_hits, 4) * 5  # jusqu'à +20

        # 3) Télétravail = bonus si le profil n'indique pas de contrainte
        if obj.remote:
            score += 6

        return max(0, min(100, round(score)))


class WatchlistSerializer(serializers.ModelSerializer):
    opportunity = OpportunitySerializer(read_only=True)
    opportunity_id = serializers.PrimaryKeyRelatedField(
        queryset=Opportunity.objects.all(), source="opportunity", write_only=True
    )

    class Meta:
        model = Watchlist
        fields = ("id", "opportunity", "opportunity_id", "created_at")
        read_only_fields = ("id", "created_at")
