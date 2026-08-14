"""Routes de l'assistant IA."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AssistantView, ConversationViewSet

router = DefaultRouter()
router.register("conversations", ConversationViewSet, basename="conversation")

urlpatterns = [
    path("assistant", AssistantView.as_view(), name="assistant"),
    path("", include(router.urls)),
]
