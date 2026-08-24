from django.apps import AppConfig


class ActionPlansConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.action_plans"

    def ready(self):
        from . import signals  # noqa: F401
