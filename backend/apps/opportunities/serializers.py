"""Serializers des opportunités."""
from rest_framework import serializers

from .models import Opportunity, Watchlist


class OpportunitySerializer(serializers.ModelSerializer):
    saved = serializers.SerializerMethodField()

    class Meta:
        model = Opportunity
        fields = (
            "id", "title", "organization", "description", "category",
            "location", "remote", "deadline", "link", "status", "saved", "created_at",
        )
        read_only_fields = ("id", "created_at")

    def get_saved(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return Watchlist.objects.filter(
                user=request.user, opportunity=obj
            ).exists()
        return False


class WatchlistSerializer(serializers.ModelSerializer):
    opportunity = OpportunitySerializer(read_only=True)
    opportunity_id = serializers.PrimaryKeyRelatedField(
        queryset=Opportunity.objects.all(), source="opportunity", write_only=True
    )

    class Meta:
        model = Watchlist
        fields = ("id", "opportunity", "opportunity_id", "created_at")
        read_only_fields = ("id", "created_at")
