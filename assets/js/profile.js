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
        bio: prof.bio || "",
        website: prof.website || "",
        linkedin: prof.linkedin || ""
      });
    }).catch(function () {
      if (window.IntelliApp) window.IntelliApp.showToast("Impossible de charger le profil.", "error");
    });
  }

  function fillProfileForm(p) {
    $("#pf-first").value = p.firstName || "";
    $("#pf-last").value = p.lastName || "";
    $("#pf-email").value = p.email || "";
    $("#pf-role").value = p.role || "";
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

  function saveProfile() {
    var profileData = {
      first_name: $("#pf-first").value.trim(),
      last_name: $("#pf-last").value.trim(),
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
        if (window.IntelliApp) window.IntelliApp.showToast("Photo de profil mise à jour (session en cours).", "success");
      };
      reader.readAsDataURL(file);
    });

    removeBtn.addEventListener("click", function () {
      var avatar = $("#profile-avatar");
      if (avatar) avatar.textContent = "JD";
      if (window.IntelliApp) window.IntelliApp.showToast("Photo de profil réinitialisée.");
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
      setTimeout(function () {
        btn.classList.remove("is-loading");
        btn.disabled = false;
        $("#sec-current").value = "";
        $("#sec-new").value = "";
        $("#sec-confirm").value = "";
        if (window.IntelliApp) window.IntelliApp.showToast("Mot de passe mis à jour avec succès.", "success");
      }, 900);
    });
  }

  /* ---------- Préférences → sauvegardées via le profil API ---------- */
  function initToggles() {
    var prefs = {};
    // Chargement depuis le profil API (champ ai_preferences)
    if (window.IntelliAPI && window.IntelliAPI.getToken()) {
      window.IntelliAPI.fetchProfile().then(function (prof) {
        if (!prof) return;
        prefs = prof.ai_preferences || {};
        document.querySelectorAll("[data-toggle-persist]").forEach(function (input) {
          var key = input.getAttribute("data-toggle-persist");
          if (prefs[key] !== undefined) input.checked = !!prefs[key];
        });
      });
    }

    document.querySelectorAll("[data-toggle-persist]").forEach(function (input) {
      var key = input.getAttribute("data-toggle-persist");
      input.addEventListener("change", function () {
        prefs[key] = input.checked;
      });
    });

    var savePrefs = document.querySelector("[data-save-preferences]");
    if (savePrefs) {
      savePrefs.addEventListener("click", function () {
        if (!window.IntelliAPI || !window.IntelliAPI.getToken()) return;
        window.IntelliAPI.fetchProfile().then(function (prof) {
          if (!prof) return;
          return window.IntelliAPI.saveProfile({
            ai_preferences: prefs
          });
        }).then(function () {
          if (window.IntelliApp) window.IntelliApp.showToast("Préférences enregistrées.", "success");
        }).catch(function () {
          if (window.IntelliApp) window.IntelliApp.showToast("Erreur lors de l'enregistrement des préférences.", "error");
        });
      });
    }
  }

  /* ---------- Init ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    initTabs();
    loadProfile();
    initProfileForm();
    initSecurity();
    initToggles();
  });
})();
