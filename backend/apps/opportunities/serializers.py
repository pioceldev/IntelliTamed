"""Serializers des opportunités."""
from rest_framework import serializers

from .models import Opportunity, Watchlist


# Mots-clés par catégorie : utilisés pour calculer la compatibilité avec le profil.
CATEGORY_KEYWORDS = {
    Opportunity.Category.EMPLOI: ["emploi", "job", "startup", "poste"],
    Opportunity.Category.FREELANCE: ["freelance", "mission", "consulting", "prestation"],
    Opportunity.Category.HACKATHON: ["hackathon", "concours", "code", "prototype"],
    Opportunity.Category.CONCOURS: ["concours", "prix", "competition"],
    Opportunity.Category.FORMATION: ["formation", "cours", "apprentissage", "skill"],
    Opportunity.Category.FINANCEMENT: ["financement", "levee", "subvention", "fond"],
    Opportunity.Category.INCUBATEUR: ["incubateur", "accelerateur", "programme"],
    Opportunity.Category.PARTENARIAT: ["partenariat", "collaboration", "joint"],
    Opportunity.Category.RECHERCHE: ["recherche", "etude", "marche"],
}


def _compute_match(obj, user):
    """Calcule le score de compatibilité (0-100) + les raisons expliquées.

    Pondération : 50 % catégorie alignée avec le profil (domaine + objectifs),
    30 % correspondance de mots-clés (compétences + intérêts), 20 % télétravail.
    Pas de score aléatoire : le résultat est reproductible et déterministe.
    """
    reasons = []
    if not user or not user.is_authenticated:
        return 60, []

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
    if hits:
        score += min(hits, 3) * 8  # jusqu'à +24
        label = dict(Opportunity.Category.choices).get(obj.category, obj.category)
        if domain:
            reasons.append(f"Votre domaine ({domain}) correspond à la catégorie {label}.")
        else:
            reasons.append(f"La catégorie {label} correspond à vos objectifs et centres d'intérêt.")

    # 2) Mots-clés de l'opportunité vs profil (compétences / intérêts)
    text = (obj.title + " " + obj.description).lower()
    profile_terms = set(skills + goals + interests + [domain])
    matched_terms = [t for t in profile_terms if t and t.lower() in text]
    if matched_terms:
        score += min(len(matched_terms), 4) * 5  # jusqu'à +20
        sample = ", ".join(matched_terms[:3])
        reasons.append(f"Vos compétences/intérêts ({sample}) apparaissent dans cette opportunité.")

    # 3) Télétravail = bonus
    if obj.remote:
        score += 6
        reasons.append("Opportunité 100% en télétravail : flexible et accessible partout.")

    if not reasons:
        reasons.append(
            "Complétez votre profil (domaine, compétences, objectifs) pour un matching plus précis."
        )

    return max(0, min(100, round(score))), reasons


class OpportunitySerializer(serializers.ModelSerializer):
    saved = serializers.SerializerMethodField()
    score = serializers.SerializerMethodField()
    reasons = serializers.SerializerMethodField()

    class Meta:
        model = Opportunity
        fields = (
            "id", "title", "organization", "description", "category",
            "location", "remote", "deadline", "link", "status", "saved", "score",
            "reasons", "created_at",
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
        request = self.context.get("request")
        user = request.user if request else None
        score, _ = _compute_match(obj, user)
        return score

    def get_reasons(self, obj):
        request = self.context.get("request")
        user = request.user if request else None
        _, reasons = _compute_match(obj, user)
        return reasons


class WatchlistSerializer(serializers.ModelSerializer):
    opportunity = OpportunitySerializer(read_only=True)
    opportunity_id = serializers.PrimaryKeyRelatedField(
        queryset=Opportunity.objects.all(), source="opportunity", write_only=True
    )

    class Meta:
        model = Watchlist
        fields = ("id", "opportunity", "opportunity_id", "created_at")
        read_only_fields = ("id", "created_at")
