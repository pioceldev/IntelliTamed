"""Opportunités : emplois, financements, hackathons, etc. + watchlist."""
from django.conf import settings
from django.db import models


class Opportunity(models.Model):
    """Une opportunité publiée (gérée par l'administration)."""

    class Category(models.TextChoices):
        EMPLOI = "emploi", "Emploi"
        FREELANCE = "freelance", "Freelance"
        HACKATHON = "hackathon", "Hackathon"
        CONCOURS = "concours", "Concours"
        FORMATION = "formation", "Formation"
        FINANCEMENT = "financement", "Financement"
        INCUBATEUR = "incubateur", "Incubateur"
        PARTENARIAT = "partenariat", "Partenariat"
        RECHERCHE = "recherche", "Recherche"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        CLOSED = "closed", "Clôturée"

    title = models.CharField("Titre", max_length=200)
    organization = models.CharField("Organisation", max_length=200, blank=True)
    description = models.TextField("Description")
    category = models.CharField(
        "Catégorie", max_length=20, choices=Category.choices, default=Category.EMPLOI
    )
    location = models.CharField("Localisation", max_length=150, blank=True)
    remote = models.BooleanField("Télétravail", default=False)
    deadline = models.DateField("Date limite", null=True, blank=True)
    link = models.URLField("Lien", blank=True)
    status = models.CharField(
        "Statut", max_length=10, choices=Status.choices, default=Status.ACTIVE
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["category", "status"])]

    def __str__(self):
        return self.title


class Watchlist(models.Model):
    """Opportunité sauvegardée par un utilisateur."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="watchlist"
    )
    opportunity = models.ForeignKey(
        Opportunity, on_delete=models.CASCADE, related_name="saved_by"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "opportunity")
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.email} → {self.opportunity.title}"
