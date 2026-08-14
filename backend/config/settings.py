"""Configuration Django d'IntelliTamed.

Variables d'environnement (backend/.env) :
  SECRET_KEY, DEBUG, DATABASE_URL, GEMINI_API_KEY, GEMINI_MODEL
"""
import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_ROOT = BASE_DIR.parent  # racine du frontend (index.html, pages/, assets/)

# ---------------------------------------------------------------
# Chargement minimal de backend/.env (sans dépendance externe)
# ---------------------------------------------------------------
def _load_env():
    env_file = BASE_DIR / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value

_load_env()

# ---------------------------------------------------------------
# Sécurité
# ---------------------------------------------------------------
SECRET_KEY = os.environ.get(
    "SECRET_KEY",
    "django-insecure-dev-only-change-me-9876543210",
)
DEBUG = os.environ.get("DEBUG", "True").lower() in ("1", "true", "yes")
ALLOWED_HOSTS = ["*"] if DEBUG else os.environ.get("ALLOWED_HOSTS", "").split(",")

# ---------------------------------------------------------------
# Applications
# ---------------------------------------------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Tiers
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    # IntelliTamed
    "apps.accounts",
    "apps.projects",
    "apps.ai",
    "apps.action_plans",
    "apps.opportunities",
    "apps.notifications",
    "apps.subscriptions",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ---------------------------------------------------------------
# Base de données — sqlite / postgres / mysql via DATABASE_URL
# ---------------------------------------------------------------
def _database_from_url(url):
    if not url or url.startswith("sqlite"):
        return {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}
    parts = url.split("://", 1)[1]
    userinfo, _, hostpart = parts.rpartition("@") if "@" in parts else ("", "", parts)
    user, _, password = userinfo.partition(":")
    hostport, _, dbname = hostpart.partition("/")
    host, _, port = hostport.partition(":")
    if url.startswith("postgres"):
        engine, port = "django.db.backends.postgresql", port or "5432"
    elif url.startswith("mysql"):
        engine, port = "django.db.backends.mysql", port or "3306"
    else:
        raise ValueError("DATABASE_URL non supporté : " + url)
    options = {}
    if engine == "django.db.backends.mysql":
        # WAMP/XAMPP utilisent MyISAM par défaut — InnoDB est requis
        # pour les index utf8mb4 (clés longues) et les FK.
        options["init_command"] = "SET default_storage_engine=InnoDB, sql_mode=STRICT_TRANS_TABLES"
    return {
        "ENGINE": engine,
        "NAME": dbname or "intellitamed",
        "USER": user,
        "PASSWORD": password,
        "HOST": host or "localhost",
        "PORT": port,
        "CONN_MAX_AGE": 60,
        "OPTIONS": options,
    }

DATABASES = {"default": _database_from_url(os.environ.get("DATABASE_URL", ""))}

# ---------------------------------------------------------------
# Authentification : email comme identifiant
# ---------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",
        "user": "120/min",
        "login": "5/min",      # anti brute-force
        "assistant": "30/min", # anti abus de l'API Gemini
    },
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DATETIME_FORMAT": "%Y-%m-%dT%H:%M:%S%z",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=14),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ---------------------------------------------------------------
# CORS — autorise le frontend statique (Node ou Django) en dev
# ---------------------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOW_CREDENTIALS = True

# ---------------------------------------------------------------
# Internationalisation / temps
# ---------------------------------------------------------------
LANGUAGE_CODE = "fr-fr"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATICFILES_DIRS = [FRONTEND_ROOT]
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------
# Brevo (emails transactionnels) — optionnel en développement
# ---------------------------------------------------------------
BREVO_API_KEY = os.environ.get("BREVO_API_KEY", "")
BREVO_SENDER_EMAIL = os.environ.get("BREVO_SENDER_EMAIL", "no-reply@intellitamed.com")
BREVO_SENDER_NAME = os.environ.get("BREVO_SENDER_NAME", "IntelliTamed")
