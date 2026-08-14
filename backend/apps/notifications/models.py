"""Notifications utilisateur."""
from django.conf import settings
from django.db import models


class Notification(models.Model):
    """Notification adressée à un utilisateur."""

    class Type(models.TextChoices):
        INSIGHT = "insight", "Insight IA"
        OPPORTUNITY = "opportunity", "Opportunité"
        SYSTEM = "system", "Système"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    title = models.CharField("Titre", max_length=200)
    content = models.TextField("Contenu", blank=True)
    type = models.CharField(
        "Type", max_length=20, choices=Type.choices, default=Type.SYSTEM
    )
    read = models.BooleanField("Lue", default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.user.email}] {self.title}"
