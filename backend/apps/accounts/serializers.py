"""Serializers des comptes : inscription, profil, onboarding."""
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.opportunities.models import Opportunity

from .models import Profile, User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ("email", "password", "role", "first_name", "last_name")

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User.objects.create_user(**validated_data)
        user.set_password(password)
        user.save()
        Profile.objects.create(
            user=user,
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "role", "first_name", "last_name", "is_staff", "date_joined")


class AdminOpportunitySerializer(serializers.ModelSerializer):
    """Création d'opportunité par l'administration."""

    class Meta:
        model = Opportunity
        fields = (
            "id", "title", "organization", "description", "category",
            "location", "remote", "deadline", "link", "status", "created_at",
        )
        read_only_fields = ("id", "created_at")


class ProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    email_verified = serializers.BooleanField(source="user.email_verified", read_only=True)

    class Meta:
        model = Profile
        fields = (
            "email", "email_verified", "first_name", "last_name", "avatar", "country",
            "bio", "website", "linkedin", "profile_type", "domain", "skills",
            "experience", "goals", "interests", "ai_preferences", "onboarding_completed",
        )

    def update(self, instance, validated_data):
        # Les champs prénom/nom remontent aussi sur l'utilisateur
        first = validated_data.pop("first_name", None)
        last = validated_data.pop("last_name", None)
        profile = super().update(instance, validated_data)
        user = instance.user
        if first is not None:
            user.first_name = first
        if last is not None:
            user.last_name = last
        user.save(update_fields=["first_name", "last_name"])
        return profile
