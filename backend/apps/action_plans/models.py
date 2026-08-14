"""Plans d'action : phases et étapes avec progression calculée."""
from django.conf import settings
from django.db import models


class ActionPlan(models.Model):
    """Plan d'action stratégique lié à un projet."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Actif"
        COMPLETED = "completed", "Terminé"
        ARCHIVED = "archived", "Archivé"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="action_plans"
    )
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="action_plans",
    )
    title = models.CharField("Titre", max_length=200)
    description = models.TextField("Description", blank=True)
    status = models.CharField(
        "Statut", max_length=20, choices=Status.choices, default=Status.ACTIVE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.title

    @property
    def progress(self):
        """Progression calculée automatiquement depuis les étapes."""
        steps = self.steps.all()
        if not steps:
            return 0
        done = sum(1 for s in steps if s.status == ActionStep.Status.DONE)
        return round(done * 100 / steps.count())


class ActionStep(models.Model):
    """Une étape du plan d'action."""

    class Priority(models.TextChoices):
        HIGH = "high", "Haute"
        MEDIUM = "medium", "Moyenne"
        LOW = "low", "Basse"

    class Status(models.TextChoices):
        TODO = "todo", "À faire"
        DOING = "doing", "En cours"
        DONE = "done", "Terminée"

    plan = models.ForeignKey(
        ActionPlan, on_delete=models.CASCADE, related_name="steps"
    )
    title = models.CharField("Titre", max_length=200)
    description = models.TextField("Description", blank=True)
    category = models.CharField("Catégorie", max_length=50, blank=True)
    priority = models.CharField(
        "Priorité", max_length=10, choices=Priority.choices, default=Priority.MEDIUM
    )
    status = models.CharField(
        "Statut", max_length=10, choices=Status.choices, default=Status.TODO
    )
    deadline = models.DateField("Échéance", null=True, blank=True)
    order = models.PositiveIntegerField("Ordre", default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.title
