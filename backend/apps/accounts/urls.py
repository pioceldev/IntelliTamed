"""Routes des comptes."""
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import AdminStatsView, MeView, OnboardingView, ProfileView, RegisterView

urlpatterns = [
    path("register", RegisterView.as_view(), name="register"),
    path("login", TokenObtainPairView.as_view(), name="login"),
    path("refresh", TokenRefreshView.as_view(), name="refresh"),
    path("me", MeView.as_view(), name="me"),
    path("profile", ProfileView.as_view(), name="profile"),
    path("onboarding", OnboardingView.as_view(), name="onboarding"),
    path("admin/stats", AdminStatsView.as_view(), name="admin-stats"),
]
