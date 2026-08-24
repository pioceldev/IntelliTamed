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

    def compute_progress(self):
        """Progression AUTOMATIQUE, calculée depuis les actions de l'utilisateur :
        - 30 % : champs du projet remplis (description, problème, solution,
          public cible, modèle économique, catégorie)
        -  5 % : objectifs définis
        - 20 % : analyse IA générée
        - 40 % : étapes du plan d'action terminées
        -  5 % : avancement du statut (idée → préparation → … → croissance)
        """
        from apps.action_plans.models import ActionStep

        score = 0.0

        # 1) Fondations : champs remplis (0-30)
        fields = [
            "description", "problem", "solution",
            "target_audience", "business_model", "category",
        ]
        filled = sum(1 for f in fields if (getattr(self, f) or "").strip())
        score += (filled / len(fields)) * 30

        # 2) Objectifs définis (+5)
        if self.objectives:
            score += 5

        # 3) Analyse IA générée (+20) — uniquement si le projet est enregistré
        if self.pk is not None and self.analyses.exists():
            score += 20

        # 4) Plan d'action : étapes terminées (0-40)
        if self.pk is not None:
            plan = self.action_plans.order_by("-updated_at").first()
            if plan:
                steps = list(plan.steps.all())
                if steps:
                    done = sum(1 for s in steps if s.status == ActionStep.Status.DONE)
                    score += (done / len(steps)) * 40
                else:
                    score += 5  # plan créé mais pas encore d'étapes

        # 5) Statut avancé (+0-5)
        status_bonus = {
            "idea": 0, "preparation": 1, "development": 2,
            "launched": 4, "growth": 5,
        }
        score += status_bonus.get(self.status, 0)

        return round(max(0, min(100, score)))

    def save(self, *args, **kwargs):
        # La progression est toujours recalculée automatiquement
        self.progress = self.compute_progress()
        super().save(*args, **kwargs)


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
