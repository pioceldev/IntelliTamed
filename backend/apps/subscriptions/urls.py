"""Routes des abonnements."""
from django.urls import path

from .views import SubscriptionView

urlpatterns = [
    path("subscriptions", SubscriptionView.as_view(), name="subscription"),
]
