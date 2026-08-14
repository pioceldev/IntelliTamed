# IntelliTamed — Backend (Django REST Framework)

> **Tame Intelligence. Shape the Future.**
> Backend Django professionnel d'IntelliTamed : authentification JWT, projets, assistant IA connecté à **Gemini**, analyses structurées, plans d'action, opportunités, notifications.

## 🧭 Vue d'ensemble

```
Frontend (HTML/CSS/JS existant, intact)
    ↓  fetch /api/... (JWT Bearer)
backend/
    manage.py
    config/          → settings (env, DRF, JWT, CORS), urls, wsgi
    apps/
        accounts/      → User (email) + Profile (onboarding, compétences, objectifs)
        projects/      → Project, ProjectAnalysis (SWOT structuré)
        ai/            → Conversation, Message, AIRequest, GeminiService
        action_plans/  → ActionPlan, ActionStep (progression auto)
        opportunities/ → Opportunity (8 catégories), Watchlist
        notifications/ → Notification
        subscriptions/ → Subscription (plans, statut)
    .env              → SECRET_KEY, DEBUG, DATABASE_URL, GEMINI_API_KEY
    requirements.txt
```

## ✨ Fonctionnalités

| Domaine | Détail |
|---|---|
| **Auth** | Inscription, connexion JWT (access + refresh), profil, onboarding, déconnexion |
| **Projets** | CRUD complet (créer, lire, modifier, supprimer), statuts (idée → croissance), progression |
| **Assistant IA** | Conversations persistées, messages, contexte conservé, **Gemini en réel** |
| **Analyse IA** | SWOT structuré (forces, faiblesses, opportunités, risques, recommandations, prochaines actions) généré par Gemini et **validé avant sauvegarde** |
| **Plans d'action** | Phases + étapes, progression calculée automatiquement, priorité, échéances |
| **Opportunités** | 8 catégories (emploi, freelance, hackathon, formation, financement, incubateur, partenariat, recherche), recherche, filtres, watchlist |
| **Notifications** | Listées par utilisateur, marquage lu/non lu |
| **Admin** | `/api/auth/admin/stats` : utilisateurs, projets, requêtes IA, abonnements (staff) + Django Admin complet |
| **Sécurité** | JWT, permissions par propriétaire (anti-IDOR), rate limiting (anti brute-force + anti abus Gemini), mots de passe hashés, clé API jamais exposée |

## 🛠 Technologies

- **Python 3.12+** · **Django 4.2** · **Django REST Framework**
- **SimpleJWT** (authentification par token)
- **PostgreSQL** (SQLite par défaut en dev, bascule en 1 ligne)
- **Gemini API** (`generativelanguage.googleapis.com`), modèle par défaut `gemini-3.6-flash`
- `django-cors-headers`, `django-filter`

## 🚀 Installation

### 1. Prérequis

```bash
cd backend
python -m venv venv
# Windows : venv\Scripts\activate   ·   macOS/Linux : source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configuration

```bash
cp .env.example .env
```

Renseigne dans `backend/.env` :

```
SECRET_KEY=ta-cle-secrete-django
DEBUG=True
DATABASE_URL=            # vide → SQLite ; ou postgres://user:pass@localhost:5432/intellitamed
GEMINI_API_KEY=AIza...   # clé Gemini (https://aistudio.google.com/apikey)
```

> 🔒 **La clé Gemini ne doit JAMAIS apparaître dans le frontend, le code, Git ou les réponses API.** Elle est lue uniquement côté serveur depuis `.env`.

### 3. Base de données

**Option A — SQLite (zéro config, dev rapide)** : ne rien mettre dans `DATABASE_URL`.

**Option B — PostgreSQL** :

```bash
createdb intellitamed
# puis dans .env :
# DATABASE_URL=postgres://postgres:motdepasse@localhost:5432/intellitamed
```

**Option C — MySQL (phpMyAdmin/WAMP)** :

```bash
# DATABASE_URL=mysql://root:@localhost:3306/intellitamed
# (base à créer dans phpMyAdmin ; moteur compatible Django)
```

### 4. Migrations + admin

```bash
python manage.py migrate
python manage.py createsuperuser   # email + mot de passe (identifiant = email)
```

### 5. Lancement

```bash
python manage.py runserver
```

Le serveur sert **l'API ET le frontend existant** (racine du projet) :

- Frontend : http://127.0.0.1:8000/ (landing), `/pages/dashboard.html`, etc.
- API : http://127.0.0.1:8000/api/...
- Admin : http://127.0.0.1:8000/admin/

## 🔌 API (extraits)

| Méthode | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Inscription (email + mot de passe) | public |
| POST | `/api/auth/login` | Connexion → `{access, refresh}` JWT | public |
| POST | `/api/auth/refresh` | Rafraîchir le token | public |
| GET | `/api/auth/me` | Utilisateur connecté | 🔒 |
| GET/PUT | `/api/auth/profile` | Profil (bio, pays, compétences…) | 🔒 |
| POST | `/api/auth/onboarding` | Enregistre l'onboarding, marque le profil complété | 🔒 |
| GET/POST | `/api/projects/` | Liste / créer ses projets | 🔒 |
| GET/PUT/DELETE | `/api/projects/{id}/` | Détail / modifier / supprimer (propriétaire uniquement) | 🔒 |
| POST | `/api/projects/{id}/analyze/` | Analyse SWOT structurée via Gemini | 🔒 |
| GET | `/api/projects/{id}/analyses/` | Analyses précédentes | 🔒 |
| POST | `/api/assistant` | Envoyer un message → réponse Gemini (contexte conservé) | 🔒 |
| GET/POST | `/api/conversations/` | Conversations de l'utilisateur | 🔒 |
| GET/DELETE | `/api/conversations/{id}/` | Détail (avec messages) / suppression | 🔒 |
| GET | `/api/opportunities/` | Opportunités (recherche `?search=`, filtres `?category=`) | 🔒 |
| GET | `/api/action-plans/` | Plans d'action (progression auto) | 🔒 |
| GET | `/api/notifications/` | Notifications | 🔒 |
| GET | `/api/health` | État du service (`gemini: configured/missing-key`) | public |
| GET | `/api/auth/admin/stats` | Statistiques globales | 🔒 staff |

**Exemple** — envoyer un message à l'assistant :

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"vous@exemple.com","password":"MotDePasse123!"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['access'])")

curl -X POST http://127.0.0.1:8000/api/assistant \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Analyse mon idée de marketplace créative"}'
```

## 🤖 Architecture Gemini

```
Frontend  →  Django REST API  →  GeminiService  →  Gemini API
                ↑                                    ↓
          Validation des données            Réponse JSON structurée
```

- **Service isolé** : `apps/ai/services.py` — prompts IntelliTamed, timeout 60 s, gestion des erreurs (429 quota, réseau), journalisation.
- **Validation** : le JSON renvoyé par Gemini est parsé et normalisé avant sauvegarde (troncature tolérée, champs contrôlés, jamais confiance aveugle).
- **Journalisation** : chaque appel est enregistré (`AIRequest` : type, modèle, statut, erreur) pour le suivi admin et l'anti-abus.

## 🔒 Sécurité

- **JWT** : access 8 h, refresh 14 j — aucun token en clair côté frontend (stocké localStorage, envoyé en `Authorization: Bearer`).
- **Permissions** : chaque vue ne renvoie que les données du propriétaire → **anti-IDOR** (testé : un utilisateur reçoit 404 sur les données d'un autre).
- **Rate limiting** : `anon` 60/min, `user` 120/min, `login` 5/min (anti brute-force), `assistant` 30/min (anti abus Gemini).
- **Mots de passe** : hashés (PBKDF2 par défaut), validation Django complète.
- **CSRF / XSS / SQLi** : framework Django (ORMs, autoescaping), CORS restreint à l'origine frontend.
- **Clés** : `SECRET_KEY` et `GEMINI_API_KEY` uniquement dans `.env` (`.gitignore`), jamais dans Git.

## 🧪 Tests

```bash
python manage.py test
```

Le parcours principal testable : **Inscription → Onboarding → Projet → Analyse Gemini → Assistant → Plan d'action → Opportunités → Profil**.

## 📁 Fichiers utiles

- `backend/.env.example` — modèle de configuration
- `backend/.gitignore` — exclut `.env`, `venv/`, `__pycache__/`, `db.sqlite3`
- `assets/js/api.js` — pont frontend (token JWT + repli mode démo si backend injoignable)
