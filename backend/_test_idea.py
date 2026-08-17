"""Test réel de l'endpoint analyse d'idée (à supprimer après usage)."""
import json
import os
import sys
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from django.test import Client
from apps.accounts.models import User


def sp(t):
    print(t.encode(sys.stdout.encoding, "replace").decode(sys.stdout.encoding))


EMAIL = "test-idea@example.com"
PASSWORD = "Testpass123!"
User.objects.filter(email=EMAIL).delete()

c = Client()
c.post("/api/auth/register", data=json.dumps({"email": EMAIL, "password": PASSWORD}), content_type="application/json")
r = c.post("/api/auth/login", data=json.dumps({"email": EMAIL, "password": PASSWORD}), content_type="application/json")
auth = {"HTTP_AUTHORIZATION": "Bearer " + r.json()["access"]}

print("Appel réel à Gemini pour l'analyse d'idée (peut prendre ~30-90s)...")
r = c.post("/api/projects/analyze_idea/", data=json.dumps({
    "idea": "Je veux créer une plateforme qui connecte les restaurants avec des travailleurs temporaires en temps réel."
}), content_type="application/json", **auth)
print("status:", r.status_code)
data = r.json()
if r.status_code != 200:
    sp("ERREUR: " + str(data)[:400])
else:
    print("clés reçues:", sorted(data.keys()))
    for k in ("problem", "solution", "target_audience", "value_proposition", "feasibility", "business_model"):
        v = data.get(k, "")
        print(" -", k, ":", str(v)[:80])
    for k in ("opportunities", "risks", "competition", "recommendations", "next_steps"):
        print(" -", k, ":", len(data.get(k, [])), "éléments")

User.objects.filter(email=EMAIL).delete()
print("\ncleanup OK")
