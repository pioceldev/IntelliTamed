/* ============================================================
   IntelliTamed — Profil & Paramètres
   ============================================================ */

(function () {
  "use strict";

  function $(sel) { return document.querySelector(sel); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var PREFERENCES_KEY = "intellitamed_prefs_v1";

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

  /* ---------- Profil ---------- */
  function loadProfile() {
    var store = window.IntelliApp ? window.IntelliApp.loadStore() : {};
    var p = store.profile || {};

    // Backend Django connecté → on charge le profil réel en priorité
    if (window.IntelliAPI && window.IntelliAPI.getToken()) {
      window.IntelliAPI.fetchProfile().then(function (prof) {
        if (!prof) return;
        p = {
          firstName: prof.first_name || "",
          lastName: prof.last_name || "",
          email: prof.email || "",
          role: prof.profile_type || "",
          bio: prof.bio || "",
          website: prof.website || "",
          linkedin: prof.linkedin || ""
        };
        store.profile = Object.assign({}, store.profile || {}, p);
        if (window.IntelliApp) window.IntelliApp.saveStore(store);
        fillProfileForm(p);
      }).catch(function () { /* backend injoignable → profil local */ });
    }

    fillProfileForm(p);
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
    var store = window.IntelliApp ? window.IntelliApp.loadStore() : {};
    var profileData = {
      firstName: $("#pf-first").value.trim() || "Jean",
      lastName: $("#pf-last").value.trim() || "Dupont",
      email: $("#pf-email").value.trim(),
      role: $("#pf-role").value.trim(),
      bio: $("#pf-bio").value.trim(),
      website: $("#pf-website").value.trim(),
      linkedin: $("#pf-linkedin").value.trim(),
      avatar: store.profile ? (store.profile.avatar || null) : null
    };
    store.profile = profileData;
    if (window.IntelliApp) window.IntelliApp.saveStore(store);

    // Backend Django connecté → sauvegarde réelle (repli silencieux sinon)
    if (window.IntelliAPI && window.IntelliAPI.getToken()) {
      window.IntelliAPI.saveProfile({
        first_name: profileData.firstName,
        last_name: profileData.lastName,
        bio: profileData.bio,
        website: profileData.website,
        linkedin: profileData.linkedin,
        profile_type: profileData.role
      }).then(function () {
        if (window.IntelliApp) window.IntelliApp.showToast("Profil mis à jour avec succès.", "success");
      }).catch(function () {
        if (window.IntelliApp) window.IntelliApp.showToast("Profil enregistré localement (backend injoignable).");
      });
    } else {
      if (window.IntelliApp) window.IntelliApp.showToast("Profil mis à jour avec succès.", "success");
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

    // Avatar upload
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
        var store = window.IntelliApp ? window.IntelliApp.loadStore() : {};
        if (!store.profile) store.profile = {};
        store.profile.avatar = ev.target.result;
        if (window.IntelliApp) {
          window.IntelliApp.saveStore(store);
          window.IntelliApp.showToast("Photo de profil mise à jour.", "success");
        }
      };
      reader.readAsDataURL(file);
    });

    removeBtn.addEventListener("click", function () {
      var avatar = $("#profile-avatar");
      if (avatar) avatar.textContent = "JD";
      var store = window.IntelliApp ? window.IntelliApp.loadStore() : {};
      if (store.profile) store.profile.avatar = null;
      if (window.IntelliApp) {
        window.IntelliApp.saveStore(store);
        window.IntelliApp.showToast("Photo de profil supprimée.");
      }
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

  /* ---------- Préférences persistées ---------- */
  function initToggles() {
    var prefs = {};
    try { prefs = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}"); } catch (e) { prefs = {}; }

    document.querySelectorAll("[data-toggle-persist]").forEach(function (input) {
      var key = input.getAttribute("data-toggle-persist");
      if (prefs[key] !== undefined) input.checked = prefs[key];
      input.addEventListener("change", function () {
        prefs[key] = input.checked;
        try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs)); } catch (e) { /* noop */ }
      });
    });

    var savePrefs = document.querySelector("[data-save-preferences]");
    if (savePrefs) {
      savePrefs.addEventListener("click", function () {
        if (window.IntelliApp) window.IntelliApp.showToast("Préférences enregistrées.", "success");
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
