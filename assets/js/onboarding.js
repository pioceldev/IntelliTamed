/* ============================================================
   IntelliTamed — Onboarding (wizard 4 étapes)
   ============================================================ */

(function () {
  "use strict";

  var currentStep = 1;
  var totalSteps = 4;

  var state = {
    profile: null,
    experience: null,
    projectName: "",
    projectDesc: "",
    domain: null,
    goals: []
  };

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- Sélections ---------- */
  function bindSelectable(containerSel, itemSel, attr, store) {
    var container = $(containerSel);
    if (!container) return;
    container.addEventListener("click", function (e) {
      var item = e.target.closest(itemSel);
      if (!item) return;
      $all(itemSel, container).forEach(function (el) { el.classList.remove("is-selected"); });
      item.classList.add("is-selected");
      var value = item.getAttribute(attr);
      if (store) store(value);
      if (item.getAttribute("data-exp") !== null && !item.closest("[data-exp]")) { /* noop */ }
    });
  }

  // Profil
  bindSelectable(".profile-cards", ".profile-card", "data-profile", function (v) { state.profile = v; });

  // Expérience
  bindSelectable(".exp-options", ".exp-option", "data-value", function (v) { state.experience = v; });

  // Domaine
  bindSelectable(".domain-chips", ".domain-chip", "data-value", function (v) { state.domain = v; });

  // Objectifs (checkbox)
  var goalsEl = $("[data-goals]");
  if (goalsEl) {
    goalsEl.addEventListener("change", function (e) {
      if (e.target.type === "checkbox") {
        state.goals = $all("input:checked", goalsEl).map(function (i) { return i.value; });
      }
    });
  }

  // Champs texte
  var nameInput = $("#onb-project-name");
  var descInput = $("#onb-project-desc");
  if (nameInput) nameInput.addEventListener("input", function () { state.projectName = nameInput.value; });
  if (descInput) descInput.addEventListener("input", function () { state.projectDesc = descInput.value; });

  /* ---------- Rendu du stepper ---------- */
  function renderSteps() {
    $all(".onboarding-step").forEach(function (el) {
      var n = parseInt(el.getAttribute("data-step-label"), 10);
      el.classList.toggle("is-active", n === currentStep);
      el.classList.toggle("is-done", n < currentStep);
    });
    var bar = $("[data-wizard-progress]");
    if (bar) bar.style.width = ((currentStep / totalSteps) * 100) + "%";
  }

  function goToStep(n) {
    currentStep = Math.min(totalSteps, Math.max(1, n));
    $all(".wizard-step").forEach(function (el) {
      el.hidden = parseInt(el.getAttribute("data-step"), 10) !== currentStep;
    });
    var prev = $("#wizard-prev");
    if (prev) prev.hidden = currentStep === 1;
    var next = $("#wizard-next");
    if (next) {
      next.hidden = currentStep === totalSteps;
      next.textContent = "Suivant";
    }
    renderSteps();
  }

  /* ---------- Validation par étape ---------- */
  function validateStep() {
    var errEl = $("[data-error-for='onboarding-step-" + currentStep + "']");
    if (errEl) { errEl.textContent = ""; errEl.classList.remove("is-visible"); }

    if (currentStep === 1) {
      if (!state.profile) {
        setStepError(errEl, "Sélectionnez votre profil pour continuer.");
        return false;
      }
      if (!state.experience) {
        setStepError(errEl, "Indiquez votre niveau d'expérience.");
        return false;
      }
      return true;
    }

    if (currentStep === 2) {
      var name = state.projectName.trim();
      var desc = state.projectDesc.trim();
      var ok = true;
      var nErr = $("[data-error-for='onb-project-name']");
      var dErr = $("[data-error-for='onb-project-desc']");
      var nInput = $("#onb-project-name");
      var dInput = $("#onb-project-desc");
      if (!name) { if (nInput) nInput.classList.add("is-invalid"); if (nErr) { nErr.textContent = "Donnez un nom à votre projet."; nErr.classList.add("is-visible"); } ok = false; }
      else if (nInput) nInput.classList.remove("is-invalid");
      if (!desc || desc.length < 20) { if (dInput) dInput.classList.add("is-invalid"); if (dErr) { dErr.textContent = desc ? "Description trop courte (minimum 20 caractères)." : "Décrivez votre projet."; dErr.classList.add("is-visible"); } ok = false; }
      else if (dInput) dInput.classList.remove("is-invalid");
      if (!ok) return false;
      if (!state.domain) {
        setStepError(errEl, "Sélectionnez votre domaine d'activité.");
        return false;
      }
      return true;
    }

    if (currentStep === 3) {
      if (state.goals.length === 0) {
        setStepError(errEl, "Sélectionnez au moins un objectif.");
        return false;
      }
      return true;
    }

    return true;
  }

  function setStepError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-visible");
  }

  /* ---------- Résumé final ---------- */
  var PROFILE_LABELS = {
    solo: "Solo Entrepreneur",
    cofounder: "Co-fondateur",
    intrapreneur: "Intrapreneur",
    visionary: "Visionnaire"
  };
  var DOMAIN_LABELS = {
    tech: "Technologie", fintech: "FinTech", sante: "E-santé", edtech: "EdTech",
    commerce: "E-commerce", logistique: "Logistique", marketing: "Marketing", autre: "Autre"
  };
  var GOAL_LABELS = {
    "valider-concept": "Valider mon concept",
    "trouver-financement": "Trouver un financement",
    "croissance": "Accélérer ma croissance",
    "reseau": "Développer mon réseau",
    "competences": "Monter en compétences",
    "business-plan": "Construire mon business plan"
  };

  function fillSummary() {
    var prof = $("[data-summary-profile]");
    if (prof) prof.textContent = PROFILE_LABELS[state.profile] || state.profile || "—";
    var proj = $("[data-summary-project]");
    if (proj) proj.textContent = state.projectName.trim() || "—";
    var dom = $("[data-summary-domain]");
    if (dom) dom.textContent = DOMAIN_LABELS[state.domain] || state.domain || "—";
    var goals = $("[data-summary-goals]");
    if (goals) goals.textContent = state.goals.map(function (g) { return GOAL_LABELS[g] || g; }).join(", ") || "—";
  }

  /* ---------- Sauvegarde ---------- */
  function saveOnboarding() {
    try {
      var store = JSON.parse(localStorage.getItem("intellitamed_store_v1") || "{}");
      store.onboarding = {
        profile: state.profile,
        experience: state.experience,
        projectName: state.projectName.trim(),
        projectDesc: state.projectDesc.trim(),
        domain: state.domain,
        goals: state.goals
      };
      localStorage.setItem("intellitamed_store_v1", JSON.stringify(store));
    } catch (e) { /* stockage indisponible */ }
  }

  /* ---------- Événements ---------- */
  var nextBtn = $("#wizard-next");
  var prevBtn = $("#wizard-prev");
  var finishBtn = $("#finish-onboarding");

  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      if (!validateStep()) return;
      if (currentStep < totalSteps) goToStep(currentStep + 1);
      if (currentStep === totalSteps - 1 && false) { /* noop */ }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", function () { goToStep(currentStep - 1); });
  }

  if (finishBtn) {
    finishBtn.addEventListener("click", function () {
      saveOnboarding();
      finishBtn.classList.add("is-loading");
      finishBtn.disabled = true;
      if (window.IntelliApp) window.IntelliApp.showToast("Onboarding terminé. Bienvenue ! 🚀", "success");
      setTimeout(function () { window.location.href = "dashboard.html"; }, 1100);
    });
  }

  // Pré-remplissage depuis le store (retour arrière)
  try {
    var existing = JSON.parse(localStorage.getItem("intellitamed_store_v1") || "{}");
    if (existing.onboarding) {
      var ob = existing.onboarding;
      state.profile = ob.profile; state.experience = ob.experience;
      state.projectName = ob.projectName; state.projectDesc = ob.projectDesc;
      state.domain = ob.domain; state.goals = ob.goals || [];
      if (ob.profile) {
        var pc = $(".profile-card[data-profile='" + ob.profile + "']");
        if (pc) pc.classList.add("is-selected");
      }
      if (ob.experience) {
        var ec = $(".exp-option[data-value='" + ob.experience + "']");
        if (ec) ec.classList.add("is-selected");
      }
      if (ob.domain) {
        var dc = $(".domain-chip[data-value='" + ob.domain + "']");
        if (dc) dc.classList.add("is-selected");
      }
      if (nameInput && ob.projectName) nameInput.value = ob.projectName;
      if (descInput && ob.projectDesc) descInput.value = ob.projectDesc;
      if (ob.goals) {
        ob.goals.forEach(function (g) {
          var cb = $(".goal-option input[value='" + g + "']");
          if (cb) cb.checked = true;
        });
      }
    }
  } catch (e) { /* noop */ }

  // Init : détection de l'étape 4 pour le résumé
  document.addEventListener("click", function (e) {
    if (currentStep === totalSteps && e.target.closest("#wizard-next")) { /* noop */ }
  });

  // Afficher le résumé quand on arrive à l'étape 4
  var origGo = goToStep;
  goToStep = function (n) {
    origGo(n);
    if (n === totalSteps) fillSummary();
  };

  goToStep(1);
})();
