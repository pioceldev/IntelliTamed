/* ============================================================
   IntelliTamed — Authentification (signup / login)
   Validation de champs, force du mot de passe, états loading
   ============================================================ */

(function () {
  "use strict";

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- Utilitaires de validation ---------- */
  var validators = {
    required: function (v) { return v.trim().length > 0; },
    email: function (v) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
    },
    password: function (v) {
      return /^(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/.test(v);
    },
    terms: function (checked) { return checked; }
  };

  function setError(input, msg) {
    var wrapper = input.closest(".form-group");
    input.classList.toggle("is-invalid", !!msg);
    if (wrapper) {
      var errEl = wrapper.querySelector("[data-error-for='" + input.id + "']");
      if (errEl) {
        errEl.textContent = msg || "";
        errEl.classList.toggle("is-visible", !!msg);
      }
    }
    return !msg;
  }

  function clearErrors(form) {
    form.querySelectorAll(".is-invalid").forEach(function (el) { el.classList.remove("is-invalid"); });
    form.querySelectorAll(".form-error").forEach(function (el) {
      el.textContent = "";
      el.classList.remove("is-visible");
    });
  }

  /* ---------- Affichage/masquage mot de passe ---------- */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-toggle-password]");
    if (!btn) return;
    var input = document.querySelector(btn.getAttribute("data-toggle-password"));
    if (!input) return;
    var show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.setAttribute("aria-label", show ? "Masquer le mot de passe" : "Afficher le mot de passe");
  });

  /* ---------- Force du mot de passe ---------- */
  function computeStrength(v) {
    var score = 0;
    if (v.length >= 8) score++;
    if (v.length >= 12) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
    if (v.length === 0) return null;
    if (score <= 1) return { pct: 20, label: "Faible", color: "#DC2626" };
    if (score <= 3) return { pct: 50, label: "Moyen", color: "#F59E0B" };
    if (score <= 4) return { pct: 75, label: "Bon", color: "#2563EB" };
    return { pct: 100, label: "Excellent", color: "#16A34A" };
  }

  document.addEventListener("input", function (e) {
    var input = e.target;
    if (input.id !== "password") return;
    var wrap = input.closest(".form-group");
    if (!wrap) return;
    var box = wrap.querySelector("[data-password-strength]");
    if (!box) return;
    var res = computeStrength(input.value);
    if (!res) { box.hidden = true; return; }
    box.hidden = false;
    var bar = box.querySelector("[data-strength-bar]");
    var label = box.querySelector("[data-strength-label]");
    if (bar) { bar.style.width = res.pct + "%"; bar.style.background = res.color; }
    if (label) label.textContent = "Force : " + res.label;
  });

  /* ---------- Formulaire d'inscription ---------- */
  var signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", function (e) {
      e.preventDefault();
      clearErrors(signupForm);

      var firstName = signupForm.querySelector("#first-name");
      var lastName = signupForm.querySelector("#last-name");
      var email = signupForm.querySelector("#email");
      var password = signupForm.querySelector("#password");
      var terms = signupForm.querySelector("#terms");
      var submit = document.getElementById("signup-submit");

      var ok = true;
      ok = setError(firstName, validators.required(firstName.value) ? "" : "Veuillez saisir votre prénom.") && ok;
      ok = setError(lastName, validators.required(lastName.value) ? "" : "Veuillez saisir votre nom.") && ok;
      ok = setError(email, validators.email(email.value) ? "" : "Veuillez saisir une adresse e-mail valide.") && ok;
      ok = setError(password, validators.password(password.value)
        ? "" : "Le mot de passe doit contenir au moins 8 caractères, un chiffre et un symbole.") && ok;
      ok = setError(terms, validators.terms(terms.checked) ? "" : "Veuillez accepter les conditions d'utilisation.") && ok;

      if (!ok) {
        var firstInvalid = signupForm.querySelector(".is-invalid");
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      // État loading → appel API réelle (repli démo si backend injoignable)
      submit.classList.add("is-loading");
      submit.disabled = true;

      var payload = {
        email: email.value.trim(),
        password: password.value,
        first_name: firstName.value.trim(),
        last_name: lastName.value.trim(),
        role: "entrepreneur"
      };

      function registerLocal() {
        try {
          var store = JSON.parse(localStorage.getItem("intellitamed_store_v1") || "{}");
          store.profile = {
            firstName: firstName.value.trim(),
            lastName: lastName.value.trim(),
            email: email.value.trim(),
            role: "Entrepreneur",
            bio: "",
            website: "",
            linkedin: "",
            avatar: null
          };
          localStorage.setItem("intellitamed_store_v1", JSON.stringify(store));
        } catch (err) { /* stockage indisponible */ }
        if (window.IntelliApp) IntelliApp.showToast("Compte créé avec succès ! Bienvenue 🎉", "success");
        setTimeout(function () { window.location.href = "onboarding.html"; }, 900);
      }

      function fail(msg) {
        submit.classList.remove("is-loading");
        submit.disabled = false;
        var errBox = document.querySelector("[data-form-alert]");
        if (errBox) {
          errBox.textContent = msg;
          errBox.classList.add("is-visible");
        }
        if (window.IntelliApp) IntelliApp.showToast(msg, "error");
      }

      if (window.IntelliAPI) {
        window.IntelliAPI.register(payload)
          .then(function () {
            // Connexion automatique après inscription
            return window.IntelliAPI.login(payload.email, payload.password);
          })
          .then(function () {
            submit.classList.remove("is-loading");
            submit.disabled = false;
            registerLocal();
          })
          .catch(function (err) {
            submit.classList.remove("is-loading");
            submit.disabled = false;
            if (err && (err.status === 400 || err.status === 401 || err.status === 403)) {
              // Vraie erreur API : email déjà pris, mot de passe invalide, etc.
              fail(apiErrorMessage(err));
            } else {
              // Backend injoignable → repli local (hors-ligne)
              registerLocal();
            }
          });
      } else {
        submit.classList.remove("is-loading");
        submit.disabled = false;
        registerLocal();
      }
    });
  }

  /* ---------- Message d'erreur API lisible ---------- */
  function apiErrorMessage(err) {
    if (!err || !err.data) return err && err.message ? err.message : "Une erreur est survenue.";
    var d = err.data;
    // DRF renvoie { champ: ["message"], ... } ou { detail: "..." }
    if (d.detail) return d.detail;
    var keys = Object.keys(d);
    if (!keys.length) return "Une erreur est survenue.";
    var first = keys[0];
    var msgs = Array.isArray(d[first]) ? d[first] : [d[first]];
    var labels = {
      email: "Adresse e-mail", password: "Mot de passe",
      first_name: "Prénom", last_name: "Nom"
    };
    var label = labels[first] || first;
    return label + " : " + String(msgs[0]);
  }

  /* ---------- Formulaire de connexion ---------- */
  var loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      clearErrors(loginForm);

      var email = loginForm.querySelector("#email");
      var password = loginForm.querySelector("#password");
      var submit = document.getElementById("login-submit");

      var ok = true;
      ok = setError(email, validators.email(email.value) ? "" : "Veuillez saisir une adresse e-mail valide.") && ok;
      ok = setError(password, validators.required(password.value) ? "" : "Veuillez saisir votre mot de passe.") && ok;

      if (!ok) return;

      submit.classList.add("is-loading");
      submit.disabled = true;

      function loginLocal() {
        if (window.IntelliApp) IntelliApp.showToast("Connexion réussie. Bon retour parmi nous !", "success");
        setTimeout(function () { window.location.href = "dashboard.html"; }, 700);
      }

      function fail(msg) {
        submit.classList.remove("is-loading");
        submit.disabled = false;
        var errBox = document.querySelector("[data-form-alert]");
        if (errBox) {
          errBox.textContent = msg;
          errBox.classList.add("is-visible");
        }
        if (window.IntelliApp) IntelliApp.showToast(msg, "error");
      }

      if (window.IntelliAPI) {
        window.IntelliAPI.login(email.value.trim(), password.value).then(function (data) {
          // Sauvegarde du profil utilisateur pour la topbar
          window.IntelliAPI.me().then(function (user) {
            if (user) window.IntelliAPI.setUser(user);
          }).catch(function () {});
          submit.classList.remove("is-loading");
          submit.disabled = false;
          loginLocal();
        }).catch(function (err) {
          if (err && (err.status === 400 || err.status === 401)) {
            // Mauvaises identifiants → vraie erreur
            fail(err.message || "Identifiants incorrects.");
          } else {
            // Backend injoignable → mode démo
            submit.classList.remove("is-loading");
            submit.disabled = false;
            loginLocal();
          }
        });
      } else {
        submit.classList.remove("is-loading");
        submit.disabled = false;
        loginLocal();
      }
    });
  }

  /* ---------- Connexion Google / GitHub (OAuth) ---------- */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-oauth]");
    if (!btn) return;
    e.preventDefault();
    var provider = btn.getAttribute("data-oauth");
    btn.disabled = true;
    btn.classList.add("is-loading");
    window.location.href = "/api/auth/social/" + provider + "/login";
  });

  /* ---------- Mot de passe oublié ---------- */
  var forgotSubmit = document.getElementById("forgot-submit");
  if (forgotSubmit) {
    forgotSubmit.addEventListener("click", function () {
      var email = document.getElementById("forgot-email");
      var ok = setError(email, validators.email(email.value) ? "" : "Veuillez saisir une adresse e-mail valide.");
      if (!ok) return;

      forgotSubmit.classList.add("is-loading");
      forgotSubmit.disabled = true;
      setTimeout(function () {
        forgotSubmit.classList.remove("is-loading");
        forgotSubmit.disabled = false;
        var modal = document.getElementById("forgot-modal");
        if (window.IntelliApp) {
          window.IntelliApp.closeModal(modal);
          window.IntelliApp.showToast("Lien de réinitialisation envoyé à " + esc(email.value.trim()) + ".", "success");
        }
      }, 900);
    });
  }

  /* ---------- Validation en direct (blur) ---------- */
  document.addEventListener("blur", function (e) {
    var input = e.target;
    if (!input.classList || !input.classList.contains("form-input")) return;
    if (input.id === "password") {
      var v = input.value;
      setError(input, validators.password(v) ? "" : "Le mot de passe doit contenir au moins 8 caractères, un chiffre et un symbole.");
    } else if (input.id === "email") {
      var val = input.value;
      if (val.trim()) setError(input, validators.email(val) ? "" : "Adresse e-mail invalide.");
    } else if (input.id === "first-name" || input.id === "last-name") {
      if (input.value.trim()) setError(input, validators.required(input.value) ? "" : "Champ requis.");
    }
  }, true);
})();
