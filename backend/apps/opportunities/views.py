"""Vues des opportunités : consultation, filtres, sauvegarde."""
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Opportunity, Watchlist
from .serializers import OpportunitySerializer, WatchlistSerializer


class OpportunityViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/opportunities — liste, filtres (category, remote, search)."""

    serializer_class = OpportunitySerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["category", "status", "remote"]
    search_fields = ["title", "organization", "description", "location"]

    def get_queryset(self):
        return Opportunity.objects.filter(status=Opportunity.Status.ACTIVE)

    @action(detail=True, methods=["post", "delete"])
    def save(self, request, pk=None):
        """POST/DELETE /api/opportunities/{id}/save — ajouter/retirer de la watchlist."""
        opportunity = self.get_object()
        watch, created = Watchlist.objects.get_or_create(
            user=request.user, opportunity=opportunity
        )
        if request.method == "DELETE":
            watch.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(
            {"saved": True, "opportunity_id": opportunity.id},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class WatchlistViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /api/watchlist — les opportunités sauvegardées par l'utilisateur."""

    serializer_class = WatchlistSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Watchlist.objects.filter(user=self.request.user)
