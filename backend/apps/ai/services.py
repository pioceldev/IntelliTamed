"""Service Gemini — couche isolée entre Django et l'API Gemini.

Responsabilités :
- appels HTTP à l'API Gemini (clé lue depuis l'environnement UNIQUEMENT) ;
- prompt système IntelliTamed ;
- timeout, gestion des erreurs, journalisation ;
- parsing + validation des réponses structurées (jamais confiance aveugle).

La clé (GEMINI_API_KEY) ne doit jamais apparaître dans le code, le HTML,
les réponses API ou Git — uniquement dans backend/.env.
"""
import json
import logging
import os
import re
import time
import urllib.error
import urllib.request

logger = logging.getLogger("intellitamed.ai")

GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
DEFAULT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
TIMEOUT_SECONDS = 60

SYSTEM_PROMPT = (
    "Tu es l'Assistant IntelliTamed, un expert stratégique en entrepreneuriat et venture building. "
    "Tu accompagnes des entrepreneurs, créateurs de projets, freelances et professionnels pour "
    "transformer leurs idées en projets concrets. Règles : "
    "- Réponds toujours en français, de façon concise et structurée (listes, sections courtes). "
    "- Sois actionnable : donne des étapes concrètes, des ordres de grandeur, des priorités. "
    "- Challemge les idées : identifie les risques et les angles morts avec bienveillance. "
    "- Couvre : validation de concept, analyse de marché, business model, pricing, plan d'action, levée de fonds. "
    "- Si l'utilisateur demande un plan d'action, propose de le retrouver dans son espace « Plan d'action ». "
    "- N'invente pas de chiffres précis : donne des ordres de grandeur à vérifier. "
    "- Reste professionnel, premium et orienté solutions."
)


class GeminiError(Exception):
    """Erreur d'appel à l'API Gemini."""


class GeminiService:
    """Accès à l'API Gemini (generateContent)."""

    @staticmethod
    def generate(prompt, history=None, model=None, max_tokens=1024):
        """Envoie un prompt (+ historique optionnel) et retourne le texte généré."""
        key = os.environ.get("GEMINI_API_KEY", "")
        if not key:
            raise GeminiError("GEMINI_API_KEY non configurée côté serveur.")

        model = model or DEFAULT_MODEL
        contents = [
            {
                "role": "user" if m["role"] == "user" else "model",
                "parts": [{"text": str(m["text"])[:4000]}],
            }
            for m in (history or [])[-12:]
        ]
        contents.append({"role": "user", "parts": [{"text": prompt[:8000]}]})

        payload = {
            "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": contents,
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": max_tokens,
                "topP": 0.9,
            },
        }

        url = f"{GEMINI_ENDPOINT.format(model=model)}?key={key}"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        started = time.monotonic()
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", "replace")[:400]
            logger.error("Gemini HTTP %s : %s", exc.code, body)
            if exc.code == 429:
                raise GeminiError("Quota Gemini dépassé. Réessayez dans quelques instants.") from exc
            raise GeminiError(f"Gemini a renvoyé une erreur (code {exc.code}).") from exc
        except urllib.error.URLError as exc:
            logger.error("Gemini réseau : %s", exc.reason)
            raise GeminiError("Impossible de joindre le service Gemini.") from exc

        latency = time.monotonic() - started
        try:
            reply = "".join(
                p.get("text", "")
                for c in data.get("candidates", [])
                for p in (c.get("content") or {}).get("parts", [])
            )
        except (AttributeError, TypeError):
            reply = ""

        if not reply:
            raise GeminiError("Gemini n'a pas généré de réponse.")

        logger.info("Gemini OK (%s) en %.2fs", model, latency)
        return reply

    # ------------------------------------------------------------------
    # Analyse structurée de projet
    # ------------------------------------------------------------------
    ANALYSIS_KEYS = (
        "summary", "strengths", "weaknesses", "opportunities",
        "risks", "recommendations", "next_steps",
    )

    @staticmethod
    def analyze_project(project):
        """Génère une analyse structurée JSON d'un projet et la valide."""
        prompt = (
            "Analyse ce projet entrepreneurial et réponds UNIQUEMENT avec un objet JSON "
            "valide (sans texte autour) au format :\n"
            '{"summary": "...", "strengths": ["..."], "weaknesses": ["..."], '
            '"opportunities": ["..."], "risks": ["..."], "recommendations": ["..."], '
            '"next_steps": ["..."]}\n\n'
            f"Nom : {project.name}\n"
            f"Description : {project.description}\n"
            f"Problème résolu : {project.problem}\n"
            f"Solution : {project.solution}\n"
            f"Public cible : {project.target_audience}\n"
            f"Modèle économique : {project.business_model}\n"
            f"Statut actuel : {project.get_status_display()}\n"
            f"Progression : {project.progress}%\n\n"
            "Chaque liste contient 3 à 5 éléments concrets et actionnables en français."
        )
        raw = GeminiService.generate(prompt, max_tokens=2048)
        parsed = GeminiService._parse_json(raw)
        return GeminiService._validate_analysis(parsed)

    @staticmethod
    def _parse_json(raw):
        """Extrait le premier objet JSON valide d'une réponse (filtre le texte autour)."""
        raw = raw.strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass
        match = re.search(r"\{.*\}", raw, re.S)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
        return {}

    @staticmethod
    def _validate_analysis(data):
        """Valide/normalise les champs — ne fait jamais confiance aveuglément à l'IA."""
        if not isinstance(data, dict):
            data = {}
        for key in GeminiService.ANALYSIS_KEYS:
            if key not in data:
                data[key] = []
            if not isinstance(data[key], list):
                data[key] = [str(data[key])]
            data[key] = [str(item)[:2000] for item in data[key][:6]]
        data["summary"] = str(data.get("summary", ""))[:4000]
        return data
