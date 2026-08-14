"""OAuth2 — Connexion et inscription via Google et GitHub.

Flux (code authorization) :
    Frontend  →  /api/auth/social/{provider}/login   (redirect vers le fournisseur)
    Fournisseur  →  /api/auth/social/{provider}/callback?code=...&state=...
    Django échange le code → récupère le profil → crée/connecte l'utilisateur
    → émet un JWT IntelliTamed → redirige vers /pages/oauth-callback.html?access=...&new=1

Les identifiants (client_id / client_secret) vivent UNIQUEMENT dans backend/.env :
    GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET
    GITHUB_OAUTH_CLIENT_ID / GITHUB_OAUTH_CLIENT_SECRET
"""
import os
import secrets

import requests

from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

PROVIDERS = {
    "google": {
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v2/userinfo",
        "scope": "openid email profile",
        "client_id_var": "GOOGLE_OAUTH_CLIENT_ID",
        "client_secret_var": "GOOGLE_OAUTH_CLIENT_SECRET",
    },
    "github": {
        "authorize_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "userinfo_url": "https://api.github.com/user",
        "scope": "read:user user:email",
        "client_id_var": "GITHUB_OAUTH_CLIENT_ID",
        "client_secret_var": "GITHUB_OAUTH_CLIENT_SECRET",
    },
}

FRONTEND_BASE = os.environ.get("FRONTEND_BASE", "").rstrip("/")
CALLBACK_PATH = "/pages/oauth-callback.html"


class OAuthError(Exception):
    """Erreur OAuth (identifiants manquants, échec d'échange, etc.)."""


def _cfg(provider):
    cfg = PROVIDERS.get(provider)
    if not cfg:
        raise OAuthError("Fournisseur OAuth inconnu.")
    client_id = os.environ.get(cfg["client_id_var"], "")
    client_secret = os.environ.get(cfg["client_secret_var"], "")
    if not client_id or not client_secret:
        raise OAuthError(
            f"OAuth {provider} non configuré — ajoutez "
            f"{cfg['client_id_var']} et {cfg['client_secret_var']} dans backend/.env."
        )
    return cfg, client_id, client_secret


def build_authorize_url(provider, request):
    """Construit l'URL d'autorisation + state (stocké en session pour le callback)."""
    cfg, client_id, _ = _cfg(provider)
    state = secrets.token_urlsafe(24)
    request.session[f"oauth_state_{provider}"] = state
    params = {
        "client_id": client_id,
        "redirect_uri": request.build_absolute_uri(f"/api/auth/social/{provider}/callback"),
        "response_type": "code",
        "scope": cfg["scope"],
        "state": state,
        # Prompt d'accord explicite pour lier l'inscription ET la connexion
        "access_type": "online",
    }
    query = "&".join(f"{k}={requests.utils.quote(str(v))}" for k, v in params.items())
    return f"{cfg['authorize_url']}?{query}"


def exchange_and_get_user(provider, request):
    """Échange le code → token → profil → crée/connecte l'utilisateur → (user, created, frontend_url)."""
    code = request.GET.get("code", "")
    state = request.GET.get("state", "")

    if not code:
        raise OAuthError("Code d'autorisation manquant.")

    # Vérification du state (anti-CSRF OAuth)
    expected = request.session.pop(f"oauth_state_{provider}", None)
    if not expected or state != expected:
        raise OAuthError("State OAuth invalide (protection CSRF). Réessayez.")

    cfg, client_id, client_secret = _cfg(provider)
    token_resp = requests.post(
        cfg["token_url"],
        data={
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": request.build_absolute_uri(f"/api/auth/social/{provider}/callback"),
            "grant_type": "authorization_code",
        },
        headers={"Accept": "application/json"},
        timeout=20,
    )
    token_data = token_resp.json()
    if token_resp.status_code != 200 or "access_token" not in token_data:
        raise OAuthError(f"Échec de l'échange du code {provider}.")

    access_token = token_data["access_token"]

    # Profil utilisateur chez le fournisseur
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
    profile_resp = requests.get(cfg["userinfo_url"], headers=headers, timeout=20)
    if profile_resp.status_code != 200:
        raise OAuthError(f"Impossible de récupérer le profil {provider}.")
    profile = profile_resp.json()

    # Normalisation du profil
    email, first_name, last_name, provider_uid = _normalize(provider, profile, access_token, headers)

    if not email:
        raise OAuthError(
            f"{provider.title()} n'a pas fourni d'adresse e-mail. "
            "Autorisez l'accès à votre e-mail dans les paramètres du fournisseur."
        )

    # Connexion ou création du compte
    user, created = User.objects.get_or_create(
        email=email.lower(),
        defaults={
            "first_name": first_name,
            "last_name": last_name,
            "is_active": True,
        },
    )
    # On met à jour le prénom/nom si le fournisseur les fournit
    if first_name and not user.first_name:
        user.first_name = first_name
    if last_name and not user.last_name:
        user.last_name = last_name
    if provider_uid and not user.role:
        user.role = "entrepreneur"
    user.save()

    # Profil de plateforme (onboarding à compléter)
    from .models import Profile
    Profile.objects.get_or_create(user=user)

    # JWT IntelliTamed
    refresh = RefreshToken.for_user(user)
    query = f"access={refresh.access_token}&refresh={refresh}&new={'1' if created else '0'}"
    url = f"{FRONTEND_BASE}{CALLBACK_PATH}?{query}"
    return user, created, url


def _normalize(provider, profile, access_token, headers):
    """Convertit le profil du fournisseur en (email, first_name, last_name, uid)."""
    if provider == "google":
        return (
            profile.get("email", ""),
            profile.get("given_name", ""),
            profile.get("family_name", ""),
            str(profile.get("id", "")),
        )
    if provider == "github":
        email = profile.get("email", "")
        # GitHub ne renvoie l'e-mail public que s'il est exposé ; sinon on interroge /user/emails
        if not email:
            try:
                emails_resp = requests.get(
                    "https://api.github.com/user/emails", headers=headers, timeout=15
                )
                if emails_resp.status_code == 200:
                    for item in emails_resp.json():
                        if item.get("primary") and item.get("verified"):
                            email = item.get("email", "")
                            break
            except requests.RequestException:
                pass
        name = (profile.get("name") or "").strip()
        parts = name.split(" ", 1)
        first_name = parts[0] if parts else ""
        last_name = parts[1] if len(parts) > 1 else ""
        return (email, first_name, last_name, str(profile.get("id", "")))
    return ("", "", "", "")
