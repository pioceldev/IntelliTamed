"""Abonnements et plans."""
from django.conf import settings
from django.db import models


class Subscription(models.Model):
    """Abonnement d'un utilisateur à un plan."""

    class Plan(models.TextChoices):
        STARTER = "starter", "Starter"
        PRO = "pro", "Pro"
        ENTERPRISE = "enterprise", "Entreprise"

    class Status(models.TextChoices):
        TRIAL = "trial", "Essai"
        ACTIVE = "active", "Actif"
        CANCELED = "canceled", "Annulé"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="subscription"
    )
    plan = models.CharField(
        "Plan", max_length=20, choices=Plan.choices, default=Plan.STARTER
    )
    status = models.CharField(
        "Statut", max_length=20, choices=Status.choices, default=Status.TRIAL
    )
    start_date = models.DateField(auto_now_add=True)
    end_date = models.DateField(null=True, blank=True)
    payment_info = models.JSONField("Informations de paiement", default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} · {self.plan} · {self.status}"
