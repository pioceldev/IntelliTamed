"""Service d'envoi d'emails transactionnels via Brevo (ex-Sendinblue).

Variables d'environnement (backend/.env) :
  BREVO_API_KEY       → clé API Brevo (https://app.brevo.com/settings/keys/api)
  BREVO_SENDER_EMAIL  → expéditeur vérifié (ex: no-reply@votredomaine.com)
  BREVO_SENDER_NAME   → nom affiché de l'expéditeur (ex: IntelliTamed)

L'envoi est TOUJOURS silencieux côté application : une erreur d'email
ne fait jamais échouer l'inscription ou la demande de reset. Le résultat
est journalisé (console) pour le débogage.
"""
import logging

import requests

logger = logging.getLogger(__name__)

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


def _config():
    from django.conf import settings
    return {
        "key": getattr(settings, "BREVO_API_KEY", "") or "",
        "sender_email": getattr(settings, "BREVO_SENDER_EMAIL", "") or "no-reply@intellitamed.com",
        "sender_name": getattr(settings, "BREVO_SENDER_NAME", "") or "IntelliTamed",
    }


def send_email(to_email, subject, html, text=None, to_name=""):
    """Envoie un email via l'API Brevo. Retourne True si envoyé, False sinon."""
    cfg = _config()
    if not cfg["key"]:
        logger.warning("[Brevo] BREVO_API_KEY non configurée — email non envoyé (%s)", subject)
        return False

    payload = {
        "sender": {"name": cfg["sender_name"], "email": cfg["sender_email"]},
        "to": [{"email": to_email, "name": to_name or to_email}],
        "subject": subject,
        "htmlContent": html,
    }
    if text:
        payload["textContent"] = text

    try:
        resp = requests.post(
            BREVO_API_URL,
            headers={
                "api-key": cfg["key"],
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15,
        )
        if resp.status_code in (200, 201, 202):
            logger.info("[Brevo] Email envoyé à %s (%s)", to_email, subject)
            return True
        logger.error("[Brevo] Échec %s : %s", resp.status_code, resp.text[:300])
    except requests.RequestException as exc:
        logger.error("[Brevo] Erreur réseau : %s", exc)
    return False


# ---------------------------------------------------------------
# Emails prêts à l'emploi
# ---------------------------------------------------------------
def send_welcome_email(user):
    """Email de bienvenue envoyé après la création d'un compte."""
    first = user.first_name or user.email.split("@")[0]
    html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111827;">
      <div style="background:#0B1020;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
        <span style="font-size:22px;font-weight:800;color:#fff;">✦ IntelliTamed</span>
      </div>
      <div style="border:1px solid #E2E8F0;border-top:none;border-radius:0 0 16px 16px;padding:32px;">
        <h1 style="font-size:20px;margin:0 0 12px;">Bienvenue, {first} ! 🎉</h1>
        <p style="font-size:14px;line-height:1.7;color:#475569;margin:0 0 20px;">
          Votre compte IntelliTamed a été créé avec succès. Vous pouvez dès maintenant
          transformer vos idées en projets concrets grâce à l'IA.
        </p>
        <a href="http://127.0.0.1:8000/pages/onboarding.html"
           style="display:inline-block;background:#2563EB;color:#fff;text-decoration:none;
                  font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;">
          Commencer l'onboarding
        </a>
        <p style="font-size:12px;color:#94A3B8;margin:24px 0 0;">
          Cet email a été envoyé automatiquement — merci de ne pas y répondre.
        </p>
      </div>
    </div>
    """
    return send_email(
        user.email,
        "Bienvenue sur IntelliTamed 🎉",
        html,
        text="Bienvenue sur IntelliTamed ! Votre compte a été créé avec succès.",
        to_name=first,
    )


def send_password_reset_email(user, token):
    """Email de réinitialisation du mot de passe (lien + code)."""
    first = user.first_name or user.email.split("@")[0]
    html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111827;">
      <div style="background:#0B1020;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
        <span style="font-size:22px;font-weight:800;color:#fff;">✦ IntelliTamed</span>
      </div>
      <div style="border:1px solid #E2E8F0;border-top:none;border-radius:0 0 16px 16px;padding:32px;">
        <h1 style="font-size:20px;margin:0 0 12px;">Réinitialisation du mot de passe</h1>
        <p style="font-size:14px;line-height:1.7;color:#475569;margin:0 0 20px;">
          Bonjour {first}, nous avons reçu une demande de réinitialisation de votre mot
          de passe. Voici votre code de réinitialisation :
        </p>
        <div style="background:#F1F5F9;border:1px dashed #CBD5E1;border-radius:12px;
                    padding:18px;text-align:center;font-size:22px;font-weight:800;
                    letter-spacing:2px;color:#2563EB;margin-bottom:20px;">{token}</div>
        <p style="font-size:13px;line-height:1.6;color:#64748B;margin:0;">
          Ce code est valable pendant une durée limitée. Si vous n'êtes pas à l'origine
          de cette demande, ignorez simplement cet email.
        </p>
      </div>
    </div>
    """
    return send_email(
        user.email,
        "Réinitialisation de votre mot de passe — IntelliTamed",
        html,
        text=f"Votre code de réinitialisation : {token}",
        to_name=first,
    )
