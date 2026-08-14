"""Tests de smoke IntelliTamed — parcours principal + sécurité anti-IDOR.

Lancement :
    python manage.py test
"""
from unittest import mock

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

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
