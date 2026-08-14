"""Routes des plans d'action."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ActionPlanViewSet, ActionStepViewSet

router = DefaultRouter()
router.register("action-plans", ActionPlanViewSet, basename="action-plan")
router.register("action-steps", ActionStepViewSet, basename="action-step")

urlpatterns = [
    path("", include(router.urls)),
]
