"""Signaux des plans d'action : la progression du projet se recalcule
automatiquement quand des étapes sont ajoutées, modifiées ou supprimées."""
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import ActionStep


def _recompute_project_progress(step):
    try:
        plan = step.plan
    except Exception:
        return
    if plan and plan.project:
        try:
            plan.project.save(update_fields=["progress"])
        except Exception:
            pass  # le projet peut être en cours de suppression


@receiver(post_save, sender=ActionStep)
def on_step_saved(sender, instance, **kwargs):
    _recompute_project_progress(instance)


@receiver(post_delete, sender=ActionStep)
def on_step_deleted(sender, instance, **kwargs):
    _recompute_project_progress(instance)
