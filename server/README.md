# IntelliTamed — Backend (proxy Gemini)

Petit serveur **Node.js / Express** qui sert le frontend statique et fait le relais
vers l'**API Google Gemini**. La clé API ne quitte **jamais** le serveur.

## Installation

```bash
cd server
npm install
cp .env.example .env      # puis renseignez GEMINI_API_KEY
npm start
```

Ouvrez **http://localhost:3000** — le frontend est servi à la racine
(`index.html`, `pages/`, `assets/`).

## Configuration (server/.env)

| Variable | Description | Défaut |
|---|---|---|
| `GEMINI_API_KEY` | Clé API Gemini (https://aistudio.google.com/apikey) | — |
| `GEMINI_MODEL` | Modèle utilisé | `gemini-2.5-flash` |
| `PORT` | Port du serveur | `3000` |

> ⚠️ Ne commitez jamais `server/.env` (ignoré par `.gitignore`).

## Endpoints

### `POST /api/assistant`

Appelle Gemini avec le persona stratégique IntelliTamed.

```json
// Requête
{ "message": "Valider mon idée de marketplace", "history": [{ "role": "user", "text": "..." }] }

// Réponse
{ "reply": "Voici mon analyse…", "model": "gemini-2.5-flash" }
```

Erreurs possibles :
- `400` — message manquant ou trop long
- `503` — clé API non configurée sur le serveur
- `502` — erreur de l'API Gemini (quota, modèle, etc.)

### `GET /api/health`

```json
{ "status": "ok", "gemini": "configured" | "missing-key", "model": "gemini-2.5-flash" }
```

## Mode démo (sans clé)

Si le backend est arrêté ou sans clé API, l'assistant du frontend bascule
automatiquement sur ses **réponses simulées** et affiche « Mode démo » dans l'en-tête.
