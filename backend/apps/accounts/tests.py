"""Tests de smoke IntelliTamed — parcours principal + sécurité anti-IDOR.

Lancement :
    python manage.py test
"""
from unittest import mock

from django.test import RequestFactory, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts import oauth
from apps.accounts.models import User
from apps.projects.models import Project


class AuthFlowTests(APITestCase):
    """Inscription → connexion → me → profil → onboarding."""

    def test_register_login_me_profile_onboarding(self):
        # Inscription
        resp = self.client.post(
            reverse("register"),
            {
                "email": "alice@example.com",
                "password": "MotDePasse123!",
                "first_name": "Alice",
                "last_name": "Martin",
                "role": "entrepreneur",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        # Connexion
        resp = self.client.post(
            reverse("login"),
            {"email": "alice@example.com", "password": "MotDePasse123!"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.data)
        token = resp.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        # me
        resp = self.client.get(reverse("me"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["email"], "alice@example.com")

        # Onboarding
        resp = self.client.post(
            reverse("onboarding"),
            {
                "profile_type": "solo",
                "domain": "tech",
                "experience": "intermediaire",
                "goals": ["valider-concept"],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["onboarding_completed"])
        self.assertEqual(resp.data["domain"], "tech")

        # Profil GET / PUT
        resp = self.client.get(reverse("profile"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        resp = self.client.put(
            reverse("profile"),
            {"bio": "Entrepreneure tech", "website": "https://alice.dev"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["bio"], "Entrepreneure tech")

    def test_register_invalid_password_rejected(self):
        resp = self.client.post(
            reverse("register"),
            {"email": "bob@example.com", "password": "12345"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_projects_require_auth(self):
        resp = self.client.get("/api/projects/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class ProjectAndIdorTests(APITestCase):
    """CRUD projets + un utilisateur ne peut jamais voir les projets d'un autre."""

    def _login(self, email):
        self.client.post(
            reverse("register"),
            {"email": email, "password": "MotDePasse123!", "role": "entrepreneur"},
            format="json",
        )
        resp = self.client.post(
            reverse("login"),
            {"email": email, "password": "MotDePasse123!"},
            format="json",
        )
        return resp.data["access"]

    def test_project_crud_and_idor(self):
        # Alice crée un projet
        alice = self._login("alice@example.com")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {alice}")
        resp = self.client.post(
            "/api/projects/",
            {
                "name": "Marketplace créatifs",
                "description": "Mise en relation IA",
                "status": "idea",
                "progress": 15,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        pid = resp.data["id"]

        # Liste
        resp = self.client.get("/api/projects/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 1)

        # Bob ne peut PAS voir le projet d'Alice (anti-IDOR → 404)
        bob = self._login("bob@example.com")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {bob}")
        resp = self.client.get(f"/api/projects/{pid}/")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
        resp = self.client.patch(f"/api/projects/{pid}/", {"name": "Hack"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

        # Alice peut le modifier
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {alice}")
        resp = self.client.patch(f"/api/projects/{pid}/", {"progress": 40}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["progress"], 40)

        # Alice peut le supprimer
        resp = self.client.delete(f"/api/projects/{pid}/")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Project.objects.filter(pk=pid).exists())


class AssistantTests(APITestCase):
    """L'assistant appelle GeminiService ; on mocke l'appel réseau."""

    def _login(self):
        self.client.post(
            reverse("register"),
            {"email": "ia@example.com", "password": "MotDePasse123!"},
            format="json",
        )
        resp = self.client.post(
            reverse("login"),
            {"email": "ia@example.com", "password": "MotDePasse123!"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")

    @mock.patch("apps.ai.services.GeminiService.generate", return_value="Réponse test de Gemini.")
    def test_assistant_returns_reply_and_persists_conversation(self, mock_generate):
        self._login()
        resp = self.client.post(
            reverse("assistant"),
            {"message": "Analyse mon idée de startup"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["reply"], "Réponse test de Gemini.")
        self.assertIn("conversation_id", resp.data)
        mock_generate.assert_called_once()

    def test_assistant_requires_auth(self):
        resp = self.client.post(reverse("assistant"), {"message": "coucou"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class OAuthTests(APITestCase):
    """Flux OAuth Google : URL d'autorisation, création, reconnexion, anti-CSRF."""

    def setUp(self):
        import os
        os.environ["GOOGLE_OAUTH_CLIENT_ID"] = "google-test-id"
        os.environ["GOOGLE_OAUTH_CLIENT_SECRET"] = "google-test-secret"

    @mock.patch("apps.accounts.oauth.requests.get")
    @mock.patch("apps.accounts.oauth.requests.post")
    def test_google_full_flow(self, m_post, m_get):
        m_post.return_value.status_code = 200
        m_post.return_value.json.return_value = {"access_token": "tok-123"}
        m_get.return_value.status_code = 200
        m_get.return_value.json.return_value = {
            "id": "uid-1", "email": "oauth@example.com",
            "given_name": "Oa", "family_name": "Auth",
        }

        rf = RequestFactory()

        # 1. URL d'autorisation
        req = rf.get("/api/auth/social/google/login")
        req.session = {}
        url = oauth.build_authorize_url("google", req)
        self.assertIn("accounts.google.com", url)
        state = req.session["oauth_state_google"]

        # 2. Création du compte
        cb = rf.get(f"/api/auth/social/google/callback?code=c&state={state}")
        cb.session = dict(req.session)
        user, created, dest = oauth.exchange_and_get_user("google", cb)
        self.assertTrue(created)
        self.assertEqual(user.email, "oauth@example.com")
        self.assertIn("access=", dest)
        self.assertIn("new=1", dest)

        # 3. Reconnexion : même compte, new=0
        cb2 = rf.get(f"/api/auth/social/google/callback?code=c&state={state}")
        cb2.session = dict(req.session)
        user2, created2, dest2 = oauth.exchange_and_get_user("google", cb2)
        self.assertFalse(created2)
        self.assertEqual(user2.id, user.id)
        self.assertIn("new=0", dest2)

        # 4. State invalide → rejeté
        bad = rf.get("/api/auth/social/google/callback?code=c&state=WRONG")
        bad.session = {}
        with self.assertRaises(oauth.OAuthError):
            oauth.exchange_and_get_user("google", bad)

        User.objects.filter(email="oauth@example.com").delete()


class PasswordResetTests(APITestCase):
    """Mot de passe oublié : demande → code (dev) → confirmation → connexion."""

    def _create_user(self):
        self.client.post(
            reverse("register"),
            {"email": "reset@example.com", "password": "MotDePasse123!", "role": "entrepreneur"},
            format="json",
        )

    @override_settings(DEBUG=True)
    def test_full_reset_flow(self):
        self._create_user()
        # Demande : message générique + code dev (DEBUG=True)
        resp = self.client.post(
            reverse("password-reset"), {"email": "reset@example.com"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("message", resp.data)
        token = resp.data.get("dev_token")
        self.assertTrue(token)

        # Email inconnu : même message, pas de fuite d'information
        resp = self.client.post(
            reverse("password-reset"), {"email": "inconnu@example.com"}, format="json"
        )
        self.assertNotIn("dev_token", resp.data)

        # Confirmation avec le bon token
        resp = self.client.post(
            reverse("password-reset-confirm"),
            {"email": "reset@example.com", "token": token, "new_password": "NouveauMdp456!"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        # Le nouveau mot de passe fonctionne
        resp = self.client.post(
            reverse("login"),
            {"email": "reset@example.com", "password": "NouveauMdp456!"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_invalid_token_rejected(self):
        self._create_user()
        resp = self.client.post(
            reverse("password-reset-confirm"),
            {"email": "reset@example.com", "token": "faux-token", "new_password": "NouveauMdp456!"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class ActionPlanTests(APITestCase):
    """Génération de plan par Gemini + CRUD des étapes (progression auto)."""

    def _setup(self):
        self.client.post(
            reverse("register"),
            {"email": "plan@example.com", "password": "MotDePasse123!"},
            format="json",
        )
        resp = self.client.post(
            reverse("login"),
            {"email": "plan@example.com", "password": "MotDePasse123!"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
        resp = self.client.post(
            "/api/projects/",
            {"name": "EcoCharge", "description": "Batterie recyclable", "status": "idea"},
            format="json",
        )
        return resp.data["id"]

    @mock.patch("apps.ai.services.GeminiService.generate_action_plan")
    def test_generate_plan_with_gemini(self, mock_gen):
        pid = self._setup()
        mock_gen.return_value = {
            "title": "Plan EcoCharge",
            "description": "Feuille de route",
            "steps": [
                {"title": "Valider le problème", "description": "Entretiens", "category": "Stratégique", "priority": "high", "phase": "phase-1"},
                {"title": "Prototyper le MVP", "description": "Batterie modulaire", "category": "Technique", "priority": "high", "phase": "phase-3"},
            ],
        }
        resp = self.client.post(
            "/api/action-plans/generate/", {"project_id": pid}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["step_count"], 2)
        self.assertEqual(resp.data["progress"], 0)

        # Marquer une étape terminée → progression recalculée (50%)
        step_id = resp.data["steps"][0]["id"]
        resp = self.client.patch(
            f"/api/action-steps/{step_id}/", {"status": "done"}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        plan_id = resp.data["plan"]
        resp = self.client.get(f"/api/action-plans/{plan_id}/")
        self.assertEqual(resp.data["progress"], 50)

        # Ajout d'étape
        resp = self.client.post(
            f"/api/action-plans/{plan_id}/steps/",
            {"title": "Tester", "description": "UX", "category": "Technique", "priority": "medium", "phase": "phase-2"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_generate_requires_own_project(self):
        self.client.post(
            reverse("register"),
            {"email": "plan2@example.com", "password": "MotDePasse123!"},
            format="json",
        )
        resp = self.client.post(
            reverse("login"),
            {"email": "plan2@example.com", "password": "MotDePasse123!"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
        # Projet inexistant → 404
        resp = self.client.post(
            "/api/action-plans/generate/", {"project_id": 9999}, format="json"
        )
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)


class AdminEndpointsTests(APITestCase):
    """Endpoints admin : staff autorisé, non-staff refusé (403)."""

    def test_admin_endpoints_require_staff(self):
        self.client.post(
            reverse("register"),
            {"email": "user@example.com", "password": "MotDePasse123!"},
            format="json",
        )
        resp = self.client.post(
            reverse("login"),
            {"email": "user@example.com", "password": "MotDePasse123!"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
        self.assertEqual(self.client.get("/api/auth/admin/stats").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/api/auth/admin/users").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/api/auth/admin/projects").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/api/auth/admin/opportunities").status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_can_read_and_create(self):
        User.objects.create_superuser(
            email="admin@example.com", password="MotDePasse123!"
        )
        resp = self.client.post(
            reverse("login"),
            {"email": "admin@example.com", "password": "MotDePasse123!"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")

        resp = self.client.get("/api/auth/admin/stats")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("users", resp.data)
        self.assertIn("subscriptions", resp.data)

        resp = self.client.get("/api/auth/admin/users")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 1)

        resp = self.client.post(
            "/api/auth/admin/opportunities",
            {"title": "Hackathon IA", "organization": "Org", "description": "48h", "category": "hackathon", "location": "Paris", "remote": False, "status": "active"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)


class WatchlistTests(APITestCase):
    """Sauvegarde/retrait d'une opportunité (watchlist)."""

    def _setup(self):
        from apps.opportunities.models import Opportunity

        opp = Opportunity.objects.create(
            title="Offre Freelance", organization="ACME",
            description="Mission React", category="freelance", status="active",
        )
        self.client.post(
            reverse("register"),
            {"email": "watch@example.com", "password": "MotDePasse123!"},
            format="json",
        )
        resp = self.client.post(
            reverse("login"),
            {"email": "watch@example.com", "password": "MotDePasse123!"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
        return opp.id

    def test_save_unsave_watchlist(self):
        opp_id = self._setup()
        # Sauvegarder
        resp = self.client.post(f"/api/opportunities/{opp_id}/save/")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        # La liste renvoie la watchlist avec l'opportunité embarquée
        resp = self.client.get("/api/watchlist/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["opportunity"]["id"], opp_id)
        # Le champ saved est vrai sur la liste publique
        resp = self.client.get("/api/opportunities/")
        self.assertTrue(resp.data["results"][0]["saved"])
        # Retirer
        resp = self.client.delete(f"/api/opportunities/{opp_id}/save/")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        resp = self.client.get("/api/watchlist/")
        self.assertEqual(resp.data["count"], 0)
