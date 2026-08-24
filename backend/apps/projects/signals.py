"""Signaux des projets : la progression se recalcule automatiquement."""
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import ProjectAnalysis


@receiver(post_save, sender=ProjectAnalysis)
def recompute_project_progress(sender, instance, **kwargs):
    """Une analyse IA générée fait avancer la progression du projet."""
    project = instance.project
    if project:
        project.save(update_fields=["progress"])
