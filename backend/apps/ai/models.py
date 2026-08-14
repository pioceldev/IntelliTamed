"""Assistant : conversations, messages et journal des requêtes IA."""
from django.conf import settings
from django.db import models


class Conversation(models.Model):
    """Conversation de l'assistant IA, liée à un utilisateur."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversations"
    )
    title = models.CharField("Titre", max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.title or f"Conversation {self.pk}"


class Message(models.Model):
    """Un message d'une conversation (rôle user ou model)."""

    class Role(models.TextChoices):
        USER = "user", "Utilisateur"
        MODEL = "model", "Assistant"

    conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, related_name="messages"
    )
    role = models.CharField(max_length=10, choices=Role.choices)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.role}: {self.content[:40]}"


class AIRequest(models.Model):
    """Journal de chaque appel à Gemini (suivi, quotas, admin)."""

    class RequestType(models.TextChoices):
        ASSISTANT = "assistant", "Assistant"
        ANALYZE = "analyze", "Analyse de projet"
        RECOMMEND = "recommend", "Recommandations"
        ACTION_PLAN = "action_plan", "Plan d'action"

    class Status(models.TextChoices):
        PENDING = "pending", "En attente"
        SUCCESS = "success", "Succès"
        ERROR = "error", "Erreur"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_requests"
    )
    request_type = models.CharField(max_length=20, choices=RequestType.choices)
    model_used = models.CharField(max_length=100, blank=True)
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING
    )
    usage_info = models.JSONField("Informations d'utilisation", default=dict, blank=True)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "request_type", "status"])]

    def __str__(self):
        return f"{self.request_type} · {self.user.email} · {self.status}"
