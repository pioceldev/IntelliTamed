"""Comptes : utilisateur (email) + profil entrepreneur."""
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models


class UserManager(BaseUserManager):
    """Manager compatible avec l'authentification par email (pas de username)."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("L'adresse e-mail est obligatoire.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Un superuser doit avoir is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Un superuser doit avoir is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Utilisateur authentifié par email (pas de username)."""

    class Role(models.TextChoices):
        ENTREPRENEUR = "entrepreneur", "Entrepreneur"
        FREELANCE = "freelance", "Freelance"
        STUDENT = "student", "Étudiant"
        PROFESSIONAL = "professional", "Professionnel"
        ADMIN = "admin", "Administrateur"

    username = None
    email = models.EmailField("Adresse e-mail", unique=True)
    role = models.CharField(
        "Rôle", max_length=20, choices=Role.choices, default=Role.ENTREPRENEUR
    )
    email_verified = models.BooleanField("E-mail vérifié", default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        ordering = ["-date_joined"]

    def __str__(self):
        return self.email


class Profile(models.Model):
    """Profil entrepreneur (onboarding + données pour le moteur de recommandation IA)."""

    class Experience(models.TextChoices):
        DEBUTANT = "debutant", "Débutant"
        INTERMEDIAIRE = "intermediaire", "Intermédiaire"
        EXPERT = "expert", "Expert"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    # Informations publiques
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    avatar = models.TextField("Photo de profil (data-URL)", blank=True)
    country = models.CharField("Pays", max_length=100, blank=True)
    bio = models.TextField("Bio", blank=True)
    website = models.URLField(blank=True)
    linkedin = models.CharField(max_length=200, blank=True)
    # Onboarding
    profile_type = models.CharField("Type de profil", max_length=30, blank=True)
    domain = models.CharField("Domaine", max_length=100, blank=True)
    skills = models.JSONField("Compétences", default=list, blank=True)
    experience = models.CharField(
        "Expérience", max_length=20, choices=Experience.choices, blank=True
    )
    goals = models.JSONField("Objectifs", default=list, blank=True)
    interests = models.JSONField("Centres d'intérêt", default=list, blank=True)
    ai_preferences = models.JSONField("Préférences IA", default=dict, blank=True)
    onboarding_completed = models.BooleanField("Onboarding terminé", default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profil de {self.user.email}"

    @property
    def full_name(self):
        return (self.first_name or self.last_name and f"{self.first_name} {self.last_name}".strip()) or self.user.email
