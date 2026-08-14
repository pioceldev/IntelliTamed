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
# Modèles de secours (chacun a son propre quota) — utilisés automatiquement
# quand le modèle principal est bloqué par le quota (429).
# Testés : gemini-flash-lite-latest et gemini-3.1-flash-lite répondent
# correctement (STOP) ; gemini-flash-latest renvoie des réponses corrompues
# et gemini-2.5-flash n'est plus accessible en free tier (404).
FALLBACK_MODELS = os.environ.get(
    "GEMINI_FALLBACK_MODELS", "gemini-flash-lite-latest,gemini-3.1-flash-lite"
).split(",")
TIMEOUT_SECONDS = 60
MAX_CYCLES = 2  # cycles de tentatives (chaque cycle essaie tous les modèles)

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


def _quota_retry_delay(body):
    """Extrait le délai (secondes) conseillé par Gemini dans le corps d'une erreur 429."""
    match = re.search(r"retry in\s+([\d.]+)s", body, re.IGNORECASE)
    if match:
        try:
            return min(float(match.group(1)) + 2, 90)  # marge + plafond de sécurité
        except ValueError:
            pass
    return 5


class GeminiService:
    """Accès à l'API Gemini (generateContent)."""

    @staticmethod
    def generate(prompt, history=None, model=None, max_tokens=1024):
        """Envoie un prompt (+ historique optionnel) et retourne le texte généré."""
        key = os.environ.get("GEMINI_API_KEY", "")
        if not key:
            raise GeminiError("GEMINI_API_KEY non configurée côté serveur.")

        requested = model or DEFAULT_MODEL
        models = [requested] + [m for m in FALLBACK_MODELS if m and m != requested]

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
        body_bytes = json.dumps(payload).encode("utf-8")

        started = time.monotonic()
        last_quota = None
        for cycle in range(MAX_CYCLES):
            for candidate in models:
                url = f"{GEMINI_ENDPOINT.format(model=candidate)}?key={key}"
                req = urllib.request.Request(
                    url,
                    data=body_bytes,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                try:
                    with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
                        data = json.loads(resp.read().decode("utf-8"))
                    latency = time.monotonic() - started
                    reply = GeminiService._extract_text(data)
                    if not reply:
                        raise GeminiError("Gemini n'a pas généré de réponse.")
                    if candidate != requested:
                        logger.info("Gemini OK via modèle de secours (%s) en %.2fs", candidate, latency)
                    else:
                        logger.info("Gemini OK (%s) en %.2fs", candidate, latency)
                    return reply
                except urllib.error.HTTPError as exc:
                    body = exc.read().decode("utf-8", "replace")[:600]
                    if exc.code == 429:
                        last_quota = body
                        logger.warning(
                            "Quota Gemini (%s) — bascule vers le modèle suivant", candidate
                        )
                        continue  # passe au modèle suivant : chacun a son propre quota
                    logger.warning("Gemini HTTP %s (%s) : %s", exc.code, candidate, body)
                    raise GeminiError(f"Gemini a renvoyé une erreur (code {exc.code}).") from exc
                except urllib.error.URLError as exc:
                    logger.error("Gemini réseau (%s) : %s", candidate, exc.reason)
                    raise GeminiError("Impossible de joindre le service Gemini.") from exc

            # Tous les modèles bloqués : pause (délai fourni par Gemini) puis nouveau cycle
            if last_quota and cycle < MAX_CYCLES - 1:
                delay = _quota_retry_delay(last_quota)
                logger.warning("Tous les modèles Gemini saturés — pause %.0fs puis cycle %d/%d", delay, cycle + 2, MAX_CYCLES)
                time.sleep(delay)

        # Tous les modèles sont bloqués par le quota
        raise GeminiError("Quota Gemini dépassé. Réessayez dans quelques instants.")

    @staticmethod
    def _extract_text(data):
        """Extrait le texte généré d'une réponse generateContent."""
        try:
            return "".join(
                p.get("text", "")
                for c in data.get("candidates", [])
                for p in (c.get("content") or {}).get("parts", [])
            )
        except (AttributeError, TypeError):
            return ""

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
        raw = GeminiService.generate(prompt, max_tokens=8192)
        parsed = GeminiService._parse_json(raw)
        return GeminiService._validate_analysis(parsed)

    @staticmethod
    def _parse_json(raw):
        """Extrait un objet JSON valide d'une réponse (texte autour + troncature tolérés)."""
        raw = raw.strip()
        decoder = json.JSONDecoder()

        # 1. JSON pur
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass

        # 2. Objet JSON noyé dans du texte (```json ... ```, markdown…)
        match = re.search(r"\{.*\}", raw, re.S)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass

        # 3. Réponse tronquée : on coupe au niveau de bornes plausibles et
        #    on referme les conteneurs ouverts (heuristic — l'IA ne doit
        #    jamais être trustée à 100 %, on valide ensuite).
        def _close_containers(text):
            depth_curly = depth_square = 0
            in_string = False
            escape = False
            for ch in text:
                if escape:
                    escape = False
                    continue
                if ch == "\\":
                    escape = True
                    continue
                if ch == '"':
                    in_string = not in_string
                elif not in_string:
                    if ch == "{":
                        depth_curly += 1
                    elif ch == "}" and depth_curly:
                        depth_curly -= 1
                    elif ch == "[":
                        depth_square += 1
                    elif ch == "]" and depth_square:
                        depth_square -= 1
            return text + "}" * depth_curly + "]" * depth_square

        candidates = [i for i, ch in enumerate(raw) if ch in '",}]' or ch == chr(10) and i > 0]
        for cut in reversed(candidates):
            prefix = _close_containers(raw[:cut].rstrip(","))
            try:
                obj, _ = decoder.raw_decode(prefix.lstrip())
                return obj
            except json.JSONDecodeError:
                continue
        return {}

    # ------------------------------------------------------------------
    # Génération de plan d'action structuré
    # ------------------------------------------------------------------
    PLAN_PHASES = ("phase-1", "phase-2", "phase-3", "phase-4")
    PLAN_PRIORITIES = ("high", "medium", "low")

    @staticmethod
    def generate_action_plan(project):
        """Génère un plan d'action structuré (JSON validé) depuis un projet."""
        prompt = (
            "Génère un plan d'action stratégique pour ce projet entrepreneurial. "
            "Réponds UNIQUEMENT avec un objet JSON valide (sans texte autour) au format :\n"
            '{"title": "...", "description": "...", '
            '"steps": [{"title": "...", "description": "...", "category": "...", '
            '"priority": "high|medium|low", "phase": "phase-1|phase-2|phase-3|phase-4"}]}\n\n'
            "Les 4 phases : phase-1 = Validation du concept, phase-2 = Architecture technique, "
            "phase-3 = Développement & test, phase-4 = Lancement.\n"
            "Règles : 4 à 8 étapes au total, réparties dans les 4 phases (au moins 1 par phase), "
            "chaque étape actionnable et concrète en français, priorité justifiée.\n\n"
            f"Nom : {project.name}\n"
            f"Description : {project.description}\n"
            f"Problème résolu : {project.problem}\n"
            f"Solution : {project.solution}\n"
            f"Public cible : {project.target_audience}\n"
            f"Modèle économique : {project.business_model}\n"
            f"Statut actuel : {project.get_status_display()}\n"
            f"Progression : {project.progress}%\n"
            f"Catégorie : {project.category or 'Non précisée'}"
        )
        raw = GeminiService.generate(prompt, max_tokens=8192)
        parsed = GeminiService._parse_json(raw)
        return GeminiService._validate_plan(parsed)

    @staticmethod
    def _validate_plan(data):
        """Valide/normalise la sortie d'un plan d'action — ne fait jamais confiance à l'IA."""
        if not isinstance(data, dict):
            data = {}
        title = str(data.get("title") or "Plan d'action stratégique")[:200]
        description = str(data.get("description") or "")[:2000]
        steps = []
        raw_steps = data.get("steps")
        if isinstance(raw_steps, list):
            for item in raw_steps[:12]:
                if not isinstance(item, dict):
                    continue
                phase = item.get("phase", "phase-1")
                if phase not in GeminiService.PLAN_PHASES:
                    phase = "phase-1"
                priority = item.get("priority", "medium")
                if priority not in GeminiService.PLAN_PRIORITIES:
                    priority = "medium"
                steps.append(
                    {
                        "title": str(item.get("title") or "Étape")[:200],
                        "description": str(item.get("description") or "")[:1000],
                        "category": str(item.get("category") or "Stratégique")[:50],
                        "priority": priority,
                        "phase": phase,
                    }
                )
        if not steps:
            raise ValueError("Gemini n'a pas généré d'étapes valides pour le plan.")
        return {"title": title, "description": description, "steps": steps}

    @staticmethod
    def _validate_analysis(data):
        """Valide/normalise les champs — ne fait jamais confiance aveuglément à l'IA."""
        if not isinstance(data, dict):
            data = {}
        # summary est une chaîne ; les autres champs sont des listes
        raw_summary = data.get("summary", "")
        if isinstance(raw_summary, list):
            raw_summary = " ".join(str(i) for i in raw_summary)
        data["summary"] = str(raw_summary)[:4000]
        for key in GeminiService.ANALYSIS_KEYS[1:]:
            if key not in data:
                data[key] = []
            if not isinstance(data[key], list):
                data[key] = [str(data[key])]
            data[key] = [str(item)[:2000] for item in data[key][:6]]
        return data
