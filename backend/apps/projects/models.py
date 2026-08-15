"""Projets entrepreneuriaux et analyses IA structurées."""
from django.conf import settings
from django.db import models


class Project(models.Model):
    """Un projet entrepreneurial appartenant à un utilisateur."""

    class Status(models.TextChoices):
        IDEA = "idea", "Idée"
        PREPARATION = "preparation", "Préparation"
        DEVELOPMENT = "development", "Développement"
        LAUNCHED = "launched", "Lancé"
        GROWTH = "growth", "Croissance"
        ARCHIVED = "archived", "Archivé"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="projects"
    )
    name = models.CharField("Nom", max_length=200)
    description = models.TextField("Description", blank=True)
    problem = models.TextField("Problème résolu", blank=True)
    solution = models.TextField("Solution", blank=True)
    target_audience = models.CharField("Public cible", max_length=300, blank=True)
    objectives = models.JSONField("Objectifs", default=list, blank=True)
    business_model = models.CharField("Modèle économique", max_length=200, blank=True)
    category = models.CharField("Catégorie", max_length=100, blank=True)
    status = models.CharField(
        "Statut", max_length=20, choices=Status.choices, default=Status.IDEA
    )
    progress = models.PositiveSmallIntegerField("Progression (%)", default=0)
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["owner", "status"])]

    def __str__(self):
        return self.name


class ProjectAnalysis(models.Model):
    """Analyse structurée d'un projet, générée par Gemini."""

    project = models.ForeignKey(
        Project, on_delete=models.CASCADE, related_name="analyses"
    )
    summary = models.TextField("Résumé", blank=True)
    strengths = models.JSONField("Forces", default=list, blank=True)
    weaknesses = models.JSONField("Faiblesses", default=list, blank=True)
    opportunities = models.JSONField("Opportunités", default=list, blank=True)
    risks = models.JSONField("Risques", default=list, blank=True)
    recommendations = models.JSONField("Recommandations", default=list, blank=True)
    next_steps = models.JSONField("Prochaines actions", default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Analyse de {self.project.name}"
