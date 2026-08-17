"""Test réel de l'assistant (vrai appel Gemini) contre le serveur en cours (à supprimer)."""
import json
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8000/api"
EMAIL = "test-assistant-reel@example.com"
PASSWORD = "Testpass123!"


def req(method, path, body=None, token=None, timeout=60, raw=False):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            text = resp.read().decode()
            if raw:
                return resp.status, text
            return resp.status, json.loads(text)
    except urllib.error.HTTPError as e:
        text = e.read().decode(errors="replace")
        if raw:
            return e.code, text
        try:
            return e.code, json.loads(text)
        except json.JSONDecodeError:
            return e.code, text


status, data = req("POST", "/auth/register", {"email": EMAIL, "password": PASSWORD})
print("register:", status)
status, data = req("POST", "/auth/login", {"email": EMAIL, "password": PASSWORD})
token = data["access"]
print("login:", status)

status, data = req("POST", "/projects/", {
    "name": "Marketplace Freelances Creatifs",
    "description": "Plateforme qui connecte les freelances creatifs (design, video, code) avec des entreprises B2B.",
    "category": "Tech",
    "status": "idea",
    "progress": 25,
}, token=token)
print("create project:", status, "id:", data.get("id"))

msg = "Quels sont mes projets actuellement ? Resume-moi leur etat et donne-moi une action prioritaire pour le premier."
print("\nMessage envoye:", msg)
status, data = req("POST", "/assistant", {"message": msg}, token=token, timeout=180, raw=True)
print("assistant status:", status)
if isinstance(data, str):
    open("_err.html", "w", encoding="utf-8").write(data)
    print("REPONSE BRUTE sauvegardée dans _err.html (", len(data), " octets )")
    raise SystemExit("Réponse non-JSON — voir _err.html")
reply = data.get("reply", data)
print("\n=== REPONSE DE L'ASSISTANT (Gemini reel) ===")
print(reply)

mentions = "Marketplace Freelances" in reply or "freelance" in reply.lower()
print("\nL'assistant mentionne mon projet ?", "OUI" if mentions else "NON")

status, data = req("DELETE", "/auth/account", token=token)
print("cleanup compte test:", status)
