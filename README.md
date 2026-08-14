# IntelliTamed

> **Tame Intelligence. Shape the Future.**

IntelliTamed est une plateforme mondiale utilisant l'IA pour aider les entrepreneurs, créateurs de projets, freelances et professionnels à transformer leurs idées en projets, opportunités et plans d'action concrets.

## 🗂 Structure du projet

```
├── index.html              Landing page
├── pages/                  11 interfaces applicatives (dashboard, assistant, projets, …)
├── assets/
│   ├── css/                Styles (base, ui, app + 1 fichier par interface)
│   ├── js/                 Composants, charts SVG, API, logique des pages
│   └── images/
├── backend/                Backend Django REST Framework (API + Gemini + PostgreSQL)
│   ├── apps/               accounts, projects, ai, action_plans, opportunities, …
│   ├── database/schema.sql Schéma SQL de la base
│   └── README.md           Documentation complète du backend
└── server/                 Ancien proxy Node (optionnel, remplacé par le backend Django)
```

---

## 🚀 Démarrage rapide

### 1. Backend Django (recommandé — API + Gemini + base de données)

```bash
cd backend
python -m venv venv
# Windows :  venv\Scripts\activate      macOS/Linux :  source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env        # puis renseigner SECRET_KEY, DATABASE_URL, GEMINI_API_KEY
python manage.py migrate    # crée la base + tables (schéma dans database/schema.sql)
python manage.py createsuperuser   # admin : email + mot de passe
python manage.py runserver
```

➡️ **Ouvre http://127.0.0.1:8000/** — le serveur sert le frontend **et** l'API.

| URL | Rôle |
|---|---|
| http://127.0.0.1:8000/ | Landing page |
| http://127.0.0.1:8000/pages/signup.html | Inscription |
| http://127.0.0.1:8000/pages/login.html | Connexion |
| http://127.0.0.1:8000/admin/ | Django Admin |
| http://127.0.0.1:8000/api/health | État du service (Gemini configuré ?) |

### 2. Base de données : SQLite, MySQL/phpMyAdmin ou PostgreSQL

Le fichier `backend/.env` contient `DATABASE_URL` :

| Base | `DATABASE_URL` |
|---|---|
| **SQLite** (défaut, zéro config) | *(vide)* |
| **MySQL / phpMyAdmin** | `mysql://root:motdepasse@localhost:3306/intellitamed` |
| **PostgreSQL** | `postgres://postgres:motdepasse@localhost:5432/intellitamed` |

Crée d'abord la base `intellitamed` (dans phpMyAdmin : *Nouvelle base de données → intellitamed → utf8mb4_general_ci*), puis `python manage.py migrate` génère automatiquement les tables au bon dialecte.

**Alternative — import direct dans phpMyAdmin** : le fichier **`backend/database/schema_mysql.sql`** contient tout le schéma au dialecte MySQL (22 tables + clés étrangères + index + migrations marquées comme appliquées). Dans phpMyAdmin : onglet **Importer** → sélectionner `schema_mysql.sql` → **Exécuter**. La base et les tables sont créées automatiquement, puis il suffit de `python manage.py createsuperuser`.

### 3. Clé Gemini (assistant IA + analyses)

1. Ouvre https://aistudio.google.com/apikey (gratuit)
2. **Créer une clé API** → copie la clé (`AIza…`)
3. Colle-la dans `backend/.env` :

```
GEMINI_API_KEY=AIza...
```

La clé vit **uniquement** côté serveur, jamais dans le frontend. Sans clé, l'assistant bascule en « Mode démo ».

### 4. Mode statique (frontend seul, sans backend)

Ouvre simplement `index.html` dans le navigateur, ou :

```bash
python -m http.server 8000
```

> ⚠️ **Aucune donnée statique** : les pages affichent leurs états vides sans backend. Les données viennent exclusivement de l'API.

---

## 🔌 API (extraits)

| Méthode | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/login` | Connexion → JWT |
| GET/PUT | `/api/auth/profile` | Profil |
| POST | `/api/auth/onboarding` | Onboarding |
| GET/POST | `/api/projects/` | Projets (CRUD) |
| POST | `/api/projects/{id}/analyze/` | Analyse Gemini (SWOT structuré) |
| POST | `/api/assistant` | Message → réponse Gemini |
| GET | `/api/conversations/` | Conversations |
| GET | `/api/opportunities/` | Opportunités |
| GET | `/api/health` | Santé du service |

Toutes les routes sauf `register`/`login`/`health` exigent un header `Authorization: Bearer <token>`.

---

## ✅ Données de démo

**Supprimées** : aucun projet, opportunité ou conversation pré-rempli. La base est vierge (seul l'utilisateur admin existe). Les données se créent via l'interface (inscription → projet → analyse) ou via l'API.

## 🧪 Tests

```bash
cd backend && python manage.py test
```

## 📚 Plus de détails

Voir **`backend/README.md`** pour l'architecture complète, les modèles, la sécurité et le schéma de l'API.
