"""Routes des opportunités."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import OpportunityViewSet, WatchlistViewSet

router = DefaultRouter()
router.register("opportunities", OpportunityViewSet, basename="opportunity")
router.register("watchlist", WatchlistViewSet, basename="watchlist")

urlpatterns = [
    path("", include(router.urls)),
]
