"""Routes des comptes."""
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    AdminOpportunitiesView,
    AdminProjectsView,
    AdminStatsView,
    AdminUsersView,
    MeView,
    OnboardingView,
    PasswordResetConfirmView,
    PasswordResetView,
    ProfileView,
    RegisterView,
    SocialLoginView,
)

urlpatterns = [
    path("register", RegisterView.as_view(), name="register"),
    path("login", TokenObtainPairView.as_view(), name="login"),
    path("refresh", TokenRefreshView.as_view(), name="refresh"),
    path("me", MeView.as_view(), name="me"),
    path("profile", ProfileView.as_view(), name="profile"),
    path("onboarding", OnboardingView.as_view(), name="onboarding"),
    path("password-reset", PasswordResetView.as_view(), name="password-reset"),
    path("password-reset/confirm", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    path("admin/stats", AdminStatsView.as_view(), name="admin-stats"),
    path("admin/users", AdminUsersView.as_view(), name="admin-users"),
    path("admin/projects", AdminProjectsView.as_view(), name="admin-projects"),
    path("admin/opportunities", AdminOpportunitiesView.as_view(), name="admin-opportunities"),
    # OAuth — /api/auth/social/google/login  et  /api/auth/social/google/callback
    path("social/<str:provider>/login", SocialLoginView.as_view(), name="social-login"),
    path("social/<str:provider>/callback", SocialLoginView.as_view(), name="social-callback"),
]
