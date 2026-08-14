"""Vues des notifications."""
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """Notifications de l'utilisateur connecté."""

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        """POST /api/notifications/{id}/read — marquer comme lue."""
        notification = self.get_object()
        notification.read = True
        notification.save(update_fields=["read"])
        return Response({"read": True})

    @action(detail=False, methods=["post"])
    def read_all(self, request):
        """POST /api/notifications/read_all — tout marquer comme lu."""
        self.get_queryset().update(read=True)
        return Response({"read": True})

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        count = self.get_queryset().filter(read=False).count()
        return Response({"unread_count": count})
