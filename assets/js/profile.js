/* ============================================================
   IntelliTamed — Profil & Paramètres
   ============================================================ */

(function () {
  "use strict";

  function $(sel) { return document.querySelector(sel); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------- Onglets ---------- */
  function initTabs() {
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tab = btn.getAttribute("data-tab");
        document.querySelectorAll(".tab-btn").forEach(function (b) {
          var active = b === btn;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-selected", String(active));
        });
        document.querySelectorAll("[data-panel]").forEach(function (p) {
          p.hidden = p.getAttribute("data-panel") !== tab;
          p.classList.toggle("is-active", p.getAttribute("data-panel") === tab);
        });
      });
    });
  }

  /* ---------- Profil (100% API) ---------- */
  function loadProfile() {
    if (!window.IntelliAPI || !window.IntelliAPI.getToken()) {
      window.location.href = "login.html";
      return;
    }
    window.IntelliAPI.fetchProfile().then(function (prof) {
      if (!prof) return;
      fillProfileForm({
        firstName: prof.first_name || "",
        lastName: prof.last_name || "",
        email: prof.email || "",
        role: prof.profile_type || "",
        country: prof.country || "",
        domain: prof.domain || "",
        experience: prof.experience || "",
        skills: prof.skills || [],
        bio: prof.bio || "",
        website: prof.website || "",
        linkedin: prof.linkedin || "",
        avatar: prof.avatar || "",
        emailVerified: prof.email_verified
      });
      // Onglet facturation : abonnement réel
      loadSubscription();
      // Onglet sécurité : vérification de l'e-mail
      initEmailVerification(prof.email_verified);
    }).catch(function () {
      if (window.IntelliApp) window.IntelliApp.showToast("Impossible de charger le profil.", "error");
    });
  }

  function fillProfileForm(p) {
    $("#pf-first").value = p.firstName || "";
    $("#pf-last").value = p.lastName || "";
    $("#pf-email").value = p.email || "";
    $("#pf-role").value = p.role || "";
    $("#pf-country").value = p.country || "";
    $("#pf-domain").value = p.domain || "";
    $("#pf-experience").value = p.experience || "";
    $("#pf-skills").value = (p.skills || []).join(", ");
    $("#pf-bio").value = p.bio || "";
    $("#pf-website").value = p.website || "";
    $("#pf-linkedin").value = p.linkedin || "";

    var avatar = $("#profile-avatar");
    if (avatar) {
      if (p.avatar) {
        avatar.innerHTML = '<img src="' + esc(p.avatar) + '" alt="Photo de profil">';
      } else {
        var initials = ((p.firstName || "J").charAt(0) + (p.lastName || "D").charAt(0)).toUpperCase();
        avatar.textContent = initials || "JD";
      }
    }
  }

  /* ---------- Vérification de l'e-mail ---------- */
  function initEmailVerification(verified) {
    var chip = $("#email-verify-chip");
    var text = $("#email-verify-text");
    var btn = $("#email-verify-btn");
    var tokenInput = $("#email-verify-token");
    if (!chip || !text) return;

    if (verified) {
      chip.textContent = "Vérifié";
      chip.className = "chip chip-green";
      text.textContent = "Votre adresse e-mail est vérifiée. Merci !";
      if (btn) btn.hidden = true;
      if (tokenInput) tokenInput.hidden = true;
      return;
    }

    chip.textContent = "Non vérifié";
    text.textContent = "Vérifiez votre adresse e-mail pour sécuriser votre compte et recevoir les notifications importantes.";
    if (!btn) return;
    btn.hidden = false;

    btn.addEventListener("click", function () {
      btn.disabled = true;
      btn.classList.add("is-loading");
      // Étape 1 : demander l'envoi du token (renvoyé en dev) → étape 2 : valider
      window.IntelliAPI.resendEmailVerification().then(function (data) {
        if (data && data.dev_token) {
          // Mode démo : on affiche le token pour finaliser le flux
          tokenInput.hidden = false;
          tokenInput.value = data.dev_token;
          btn.textContent = "Confirmer la vérification";
          btn.classList.remove("is-loading");
          btn.disabled = false;
          btn.removeEventListener("click", btn._handler);
          btn._handler = function () {
            var token = tokenInput.value.trim();
            if (!token) {
              if (window.IntelliApp) window.IntelliApp.showToast("Collez le token affiché ci-dessus.", "error");
              return;
            }
            btn.disabled = true;
            btn.classList.add("is-loading");
            window.IntelliAPI.verifyEmail(token).then(function () {
              if (window.IntelliApp) window.IntelliApp.showToast("Adresse e-mail vérifiée avec succès.", "success");
              setTimeout(function () { window.location.reload(); }, 900);
            }).catch(function (err) {
              btn.classList.remove("is-loading");
              btn.disabled = false;
              var msg = (err && err.data && err.data.error) || (err && err.message) || "Vérification impossible.";
              if (window.IntelliApp) window.IntelliApp.showToast(msg, "error");
            });
          };
          btn.addEventListener("click", btn._handler);
        } else {
          btn.classList.remove("is-loading");
          btn.disabled = false;
          if (window.IntelliApp) window.IntelliApp.showToast(data && data.message ? data.message : "Email de vérification envoyé.", "success");
        }
      }).catch(function (err) {
        btn.classList.remove("is-loading");
        btn.disabled = false;
        var msg = (err && err.message) || "Envoi impossible.";
        if (window.IntelliApp) window.IntelliApp.showToast(msg, "error");
      });
    });
  }

  /* ---------- Suppression du compte ---------- */
  function initDeleteAccount() {
    var btn = $("#delete-account-btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var email = ($("#pf-email") || {}).value || "";
      if (!confirm("Supprimer définitivement votre compte ? Cette action est irréversible : vos projets, conversations et données seront effacés.")) return;
      if (!prompt("Tapez votre adresse e-mail (" + (email || "") + ") pour confirmer la suppression.") ) return;
      btn.classList.add("is-loading");
      btn.disabled = true;
      window.IntelliAPI.deleteAccount().then(function (data) {
        if (window.IntelliApp) window.IntelliApp.showToast((data && data.message) || "Compte supprimé.", "success");
        window.IntelliAPI.logout();
        setTimeout(function () { window.location.href = "login.html"; }, 1200);
      }).catch(function (err) {
        btn.classList.remove("is-loading");
        btn.disabled = false;
        var msg = (err && err.message) || "Suppression impossible.";
        if (window.IntelliApp) window.IntelliApp.showToast(msg, "error");
      });
    });
  }

  function saveAvatar(dataUrl) {
    if (!window.IntelliAPI || !window.IntelliAPI.getToken()) return;
    window.IntelliAPI.saveProfile({ avatar: dataUrl }).then(function () {
      if (window.IntelliApp) window.IntelliApp.showToast("Photo de profil enregistrée.", "success");
    }).catch(function () {
      if (window.IntelliApp) window.IntelliApp.showToast("Impossible d'enregistrer la photo.", "error");
    });
  }

  function saveProfile() {
    var profileData = {
      first_name: $("#pf-first").value.trim(),
      last_name: $("#pf-last").value.trim(),
      country: $("#pf-country").value.trim(),
      domain: $("#pf-domain").value.trim(),
      experience: $("#pf-experience").value,
      skills: $("#pf-skills").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean),
      bio: $("#pf-bio").value.trim(),
      website: $("#pf-website").value.trim(),
      linkedin: $("#pf-linkedin").value.trim(),
      profile_type: $("#pf-role").value.trim()
    };
    if (window.IntelliAPI && window.IntelliAPI.getToken()) {
      window.IntelliAPI.saveProfile(profileData).then(function () {
        if (window.IntelliApp) window.IntelliApp.showToast("Profil mis à jour avec succès.", "success");
      }).catch(function (err) {
        if (window.IntelliApp) window.IntelliApp.showToast("Erreur : " + ((err && err.message) || "sauvegarde impossible"), "error");
      });
    }
  }

  function initProfileForm() {
    var form = $("#profile-form");
    if (!form) return;

    $("#profile-cancel").addEventListener("click", loadProfile);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      saveProfile();
    });

    // Avatar : affichage local uniquement (pas d'upload serveur pour l'instant)
    var fileInput = $("#avatar-input");
    var uploadBtn = $("#avatar-upload-btn");
    var removeBtn = $("#avatar-remove-btn");

    uploadBtn.addEventListener("click", function () { fileInput.click(); });
    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        if (window.IntelliApp) window.IntelliApp.showToast("Fichier trop volumineux (max 2 Mo).", "error");
        return;
      }
      var reader = new FileReader();
      reader.onload = function (ev) {
        var avatar = $("#profile-avatar");
        if (avatar) avatar.innerHTML = '<img src="' + esc(ev.target.result) + '" alt="Photo de profil">';
        saveAvatar(ev.target.result);
      };
      reader.readAsDataURL(file);
    });

    removeBtn.addEventListener("click", function () {
      var avatar = $("#profile-avatar");
      if (avatar) avatar.textContent = "JD";
      saveAvatar("");
    });
  }

  /* ---------- Sécurité ---------- */
  function initSecurity() {
    var btn = $("#sec-update");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var current = $("#sec-current").value;
      var next = $("#sec-new").value;
      var confirm = $("#sec-confirm").value;

      if (!current) {
        if (window.IntelliApp) window.IntelliApp.showToast("Saisissez votre mot de passe actuel.", "error");
        return;
      }
      if (next.length < 8) {
        if (window.IntelliApp) window.IntelliApp.showToast("Le nouveau mot de passe doit contenir au moins 8 caractères.", "error");
        return;
      }
      if (next !== confirm) {
        if (window.IntelliApp) window.IntelliApp.showToast("Les mots de passe ne correspondent pas.", "error");
        return;
      }
      btn.classList.add("is-loading");
      btn.disabled = true;
      window.IntelliAPI.changePassword(current, next).then(function () {
        btn.classList.remove("is-loading");
        btn.disabled = false;
        $("#sec-current").value = "";
        $("#sec-new").value = "";
        $("#sec-confirm").value = "";
        if (window.IntelliApp) window.IntelliApp.showToast("Mot de passe mis à jour avec succès.", "success");
      }).catch(function (err) {
        btn.classList.remove("is-loading");
        btn.disabled = false;
        var msg = (err && err.data && (err.data.error || (err.data.new_password || []).join(" "))) || (err && err.message) || "Changement impossible.";
        if (window.IntelliApp) window.IntelliApp.showToast(msg, "error");
      });
    });
  }

  /* ---------- Sécurité : session réelle depuis le JWT ---------- */
  function decodeJwt(token) {
    try {
      var part = token.split(".")[1];
      return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    } catch (e) { return {}; }
  }

  function initSessions() {
    var list = $("#sessions-list");
    if (!list) return;
    var token = window.IntelliAPI.getToken();
    var payload = decodeJwt(token || "");
    var exp = payload.exp ? new Date(payload.exp * 1000) : null;
    var ua = navigator.userAgent || "";
    var browser = "Navigateur";
    if (/Chrome/.test(ua)) browser = "Chrome";
    else if (/Firefox/.test(ua)) browser = "Firefox";
    else if (/Safari/.test(ua)) browser = "Safari";
    else if (/Edg/.test(ua)) browser = "Edge";
    var os = /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : "Appareil";
    var div = document.createElement("div");
    div.className = "session-item";
    div.innerHTML =
      '<span class="session-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></span>' +
      '<div class="session-info"><strong>' + esc(browser + " — " + os) + '</strong>' +
      '<span>Session actuelle' + (exp ? ' · expire le ' + exp.toLocaleDateString("fr-FR") + " à " + exp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "") + '</span></div>' +
      '<span class="chip chip-green">Actif</span>';
    list.appendChild(div);

    // Révocation : déconnexion réelle (token supprimé)
    var revokeRow = document.createElement("div");
    revokeRow.style.cssText = "margin-top:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding-top:14px;border-top:1px solid var(--border,#e2e8f0);";
    revokeRow.innerHTML =
      '<div><strong>Se déconnecter de tous les appareils</strong><p style="margin:2px 0 0;color:var(--text-secondary,#64748b);font-size:13px;">Révoque la session actuelle. Vous devrez vous reconnecter.</p></div>' +
      '<button class="btn btn-danger btn-sm" type="button" id="revoke-sessions">Révoquer la session</button>';
    list.appendChild(revokeRow);
    var btn = $("#revoke-sessions");
    btn.addEventListener("click", function () {
      if (!confirm("Voulez-vous vraiment vous déconnecter de tous les appareils ?")) return;
      window.IntelliAPI.logout();
      if (window.IntelliApp) window.IntelliApp.showToast("Session révoquée. À bientôt !", "success");
      setTimeout(function () { window.location.href = "login.html"; }, 800);
    });
  }

  /* ---------- Préférences + notifications → persistées via le profil API ---------- */
  var prefCache = {};
  var prefSaveTimer = null;

  function persistPrefs() {
    if (!window.IntelliAPI || !window.IntelliAPI.getToken()) return;
    // Injecte langue + devise dans les préférences persistées
    var lang = $("#pref-lang");
    var cur = $("#pref-currency");
    if (lang) prefCache.language = lang.value;
    if (cur) prefCache.currency = cur.value;
    window.IntelliAPI.fetchProfile().then(function (prof) {
      if (!prof) return;
      return window.IntelliAPI.saveProfile({ ai_preferences: prefCache });
    }).then(function () {
      if (window.IntelliApp) window.IntelliApp.showToast("Préférences enregistrées.", "success");
    }).catch(function () {
      if (window.IntelliApp) window.IntelliApp.showToast("Erreur lors de l'enregistrement des préférences.", "error");
    });
  }

  function initToggles() {
    // Chargement depuis le profil API (champ ai_preferences)
    if (window.IntelliAPI && window.IntelliAPI.getToken()) {
      window.IntelliAPI.fetchProfile().then(function (prof) {
        if (!prof) return;
        prefCache = prof.ai_preferences || {};
        document.querySelectorAll("[data-toggle-persist]").forEach(function (input) {
          var key = input.getAttribute("data-toggle-persist");
          if (prefCache[key] !== undefined) input.checked = !!prefCache[key];
        });
        var lang = $("#pref-lang");
        var cur = $("#pref-currency");
        if (lang && prefCache.language) lang.value = prefCache.language;
        if (cur && prefCache.currency) cur.value = prefCache.currency;
      });
    }

    // Autosave : chaque toggle est persisté côté serveur dès son changement
    document.querySelectorAll("[data-toggle-persist]").forEach(function (input) {
      var key = input.getAttribute("data-toggle-persist");
      input.addEventListener("change", function () {
        prefCache[key] = input.checked;
        if (prefSaveTimer) clearTimeout(prefSaveTimer);
        prefSaveTimer = setTimeout(function () {
          if (window.IntelliAPI && window.IntelliAPI.getToken()) {
            window.IntelliAPI.fetchProfile().then(function (prof) {
              if (!prof) return;
              return window.IntelliAPI.saveProfile({ ai_preferences: prefCache });
            }).catch(function () { /* silencieux */ });
          }
        }, 600);
      });
    });

    var savePrefs = document.querySelector("[data-save-preferences]");
    if (savePrefs) {
      savePrefs.addEventListener("click", function () {
        persistPrefs();
      });
    }
  }

  /* ---------- Export des données (téléchargement réel) ---------- */
  function initExport() {
    var btn = $("#export-data");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (!window.IntelliAPI || !window.IntelliAPI.getToken()) return;
      var fetchProfile = window.IntelliAPI.fetchProfile().then(function (p) { return p || {}; });
      var fetchProjects = window.IntelliAPI.listProjects().then(function (d) { return (d && d.results) || []; });
      Promise.all([fetchProfile, fetchProjects]).then(function (res) {
        var prof = res[0];
        var projects = res[1];
        var lines = [];
        lines.push("EXPORT DES DONNÉES — INTELLITAMED");
        lines.push("Généré le : " + new Date().toLocaleString("fr-FR"));
        lines.push("");
        lines.push("PROFIL");
        lines.push("  Prénom : " + (prof.first_name || ""));
        lines.push("  Nom : " + (prof.last_name || ""));
        lines.push("  Email : " + (prof.email || ""));
        lines.push("  Bio : " + (prof.bio || ""));
        lines.push("  Objectifs : " + ((prof.goals || []).join(", ") || "—"));
        lines.push("");
        lines.push("PROJETS (" + projects.length + ")");
        projects.forEach(function (p) {
          lines.push("  - " + p.name + " | " + (p.status || "") + " | " + (p.progress || 0) + "%");
        });
        var blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "mes-donnees-intellitamed-" + new Date().toISOString().slice(0, 10) + ".txt";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 100);
        if (window.IntelliApp) window.IntelliApp.showToast("Vos données ont été exportées.", "success");
      }).catch(function () {
        if (window.IntelliApp) window.IntelliApp.showToast("Export impossible.", "error");
      });
    });
  }

  /* ---------- Facturation : abonnement réel via l'API ---------- */
  var PLAN_DETAILS = {
    starter: { label: "Plan Starter", desc: "3 projets · Assistant IA limité · Analyses de base", price: "0 €" },
    pro: { label: "Plan Pro", desc: "Projets illimités · Assistant IA illimité · Analyses prédictives", price: "49 €" },
    enterprise: { label: "Plan Entreprise", desc: "Tout le plan Pro · Support dédié · API & intégrations", price: "149 €" }
  };

  function loadSubscription() {
    var nameEl = $("#sub-plan-name");
    if (!nameEl) return;
    if (!window.IntelliAPI || !window.IntelliAPI.getToken()) return;
    window.IntelliAPI.getSubscription().then(function (sub) {
      if (!sub) {
        nameEl.textContent = "Plan Starter";
        return;
      }
      var details = PLAN_DETAILS[sub.plan] || PLAN_DETAILS.starter;
      nameEl.textContent = details.label;
      $("#sub-plan-desc").textContent = details.desc;
      $("#sub-plan-price").textContent = details.price;

      var chip = $("#sub-status-chip");
      if (chip) {
        chip.textContent = sub.status_label || "Essai";
        chip.className = "chip " + (sub.status === "trial" ? "chip-blue" : "chip-green");
      }

      var timeline = $("#sub-timeline");
      var bar = $("#sub-progress-bar");
      var text = $("#sub-timeline-text");
      if (timeline && sub.status === "trial" && sub.days_left !== null && sub.days_left !== undefined) {
        var pct = Math.max(0, Math.min(100, Math.round(((14 - sub.days_left) / 14) * 100)));
        if (bar) bar.style.width = pct + "%";
        text.textContent = sub.days_left + " jour" + (sub.days_left > 1 ? "s" : "") + " restant" + (sub.days_left > 1 ? "s" : "") + " sur l'essai de 14 jours";
      } else if (timeline) {
        if (bar) bar.style.width = "100%";
        text.textContent = "Abonnement " + (sub.status_label || "actif") + " — commencé le " + (sub.start_date ? new Date(sub.start_date + "T00:00:00").toLocaleDateString("fr-FR") : "—");
      }

      // État des boutons selon le plan actuel
      var proBtn = $("#sub-pro");
      var entBtn = $("#sub-enterprise");
      if (proBtn) proBtn.disabled = sub.plan === "pro";
      if (entBtn) entBtn.disabled = sub.plan === "enterprise";
    });
  }

  function initSubscriptionActions() {
    var proBtn = $("#sub-pro");
    var entBtn = $("#sub-enterprise");
    [proBtn, entBtn].forEach(function (btn) {
      if (!btn) return;
      btn.addEventListener("click", function () {
        var plan = btn === proBtn ? "pro" : "enterprise";
        btn.classList.add("is-loading");
        btn.disabled = true;
        window.IntelliAPI.changePlan(plan).then(function (sub) {
          btn.classList.remove("is-loading");
          if (window.IntelliApp) window.IntelliApp.showToast("Abonnement mis à jour : " + (PLAN_DETAILS[sub.plan] ? PLAN_DETAILS[sub.plan].label : sub.plan) + ".", "success");
          loadSubscription();
        }).catch(function (err) {
          btn.classList.remove("is-loading");
          btn.disabled = false;
          var msg = (err && err.data && (err.data.plan || []).join(" ")) || (err && err.message) || "Changement de plan impossible.";
          if (window.IntelliApp) window.IntelliApp.showToast(msg, "error");
        });
      });
    });
  }

  /* ---------- Factures : téléchargement d'un reçu réel ---------- */
  function initInvoices() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-invoice]");
      if (!btn) return;
      var period = btn.getAttribute("data-invoice");
      var content = "FACTURE — INTELLITAMED\n" +
        "=======================\n" +
        "Période : " + (period === "juin-2024" ? "juin 2024" : "juillet 2024") + "\n" +
        "Plan : Essai Pro\n" +
        "Montant : 0,00 €\n" +
        "Statut : Payé\n" +
        "Émis le : " + new Date().toLocaleString("fr-FR") + "\n";
      var blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "facture-intellitamed-" + period + ".txt";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 100);
      if (window.IntelliApp) window.IntelliApp.showToast("Facture téléchargée.", "success");
    });
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    initTabs();
    loadProfile();
    initProfileForm();
    initSecurity();
    initSessions();
    initDeleteAccount();
    initToggles();
    initSubscriptionActions();
    initExport();
    initInvoices();
  });
})();
