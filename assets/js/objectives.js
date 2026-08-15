/* ============================================================
   IntelliTamed — Objectifs
   Les objectifs sont stockés dans le profil utilisateur (API Django) :
   - GET /api/auth/profile          → goals + ai_preferences
   - PUT /api/auth/profile          → sauvegarde (goals, goals_done)
   Aucune donnée locale : tout est persisté côté serveur.
   ============================================================ */

(function () {
  "use strict";

  function $(sel) { return document.querySelector(sel); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var goals = [];        // liste de chaînes
  var goalsDone = {};    // { "objectif": true }

  /* ---------- Chargement depuis l'API ---------- */
  function load() {
    if (!window.IntelliAPI || !window.IntelliAPI.getToken()) {
      window.location.href = "login.html";
      return;
    }
    window.IntelliAPI.fetchProfile().then(function (profile) {
      if (!profile) { renderEmpty(); return; }
      goals = Array.isArray(profile.goals) ? profile.goals.slice() : [];
      var prefs = profile.ai_preferences || {};
      goalsDone = prefs.goals_done && typeof prefs.goals_done === "object"
        ? prefs.goals_done
        : {};
      render();
    }).catch(function () {
      renderEmpty();
      if (window.IntelliApp) window.IntelliApp.showToast("Impossible de charger vos objectifs.", "error");
    });
  }

  /* ---------- Sauvegarde (PUT profil) ---------- */
  function save() {
    var profile = { goals: goals };
    if (window.IntelliAPI && window.IntelliAPI.fetchProfile) {
      // Récupère le profil actuel pour ne pas écraser les autres champs
      return window.IntelliAPI.fetchProfile().then(function (existing) {
        var payload = existing || {};
        payload.goals = goals;
        payload.ai_preferences = payload.ai_preferences || {};
        payload.ai_preferences.goals_done = goalsDone;
        return window.IntelliAPI.saveProfile(payload);
      });
    }
    return window.IntelliAPI.saveProfile(profile);
  }

  /* ---------- Rendu ---------- */
  function render() {
    var list = $("#obj-list");
    if (!list) return;

    var countSub = $("#obj-count-sub");
    if (countSub) countSub.textContent = goals.length + " objectif" + (goals.length > 1 ? "s" : "");

    if (!goals.length) {
      list.innerHTML = '<p class="text-muted" style="padding:8px 4px;">Aucun objectif pour le moment. Ajoutez-en un ou utilisez les suggestions ci-dessus.</p>';
      renderProgress();
      return;
    }

    list.innerHTML = goals.map(function (g, i) {
      var done = !!goalsDone[g];
      return '<div class="obj-item' + (done ? " is-done" : "") + '" data-index="' + i + '">' +
        '<input type="checkbox" id="obj-cb-' + i + '"' + (done ? " checked" : "") + ' data-toggle="' + i + '">' +
        '<label class="obj-check" for="obj-cb-' + i + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></label>' +
        '<span class="obj-text" data-toggle="' + i + '">' + esc(g) + '</span>' +
        '<button class="obj-del" type="button" data-del="' + i + '" aria-label="Supprimer l\'objectif"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
      '</div>';
    }).join("");

    renderProgress();
  }

  function renderEmpty() {
    var list = $("#obj-list");
    if (list) {
      list.innerHTML = '<p class="text-muted" style="padding:8px 4px;">Aucun objectif pour le moment. Ajoutez-en un ou utilisez les suggestions ci-dessus.</p>';
    }
    renderProgress();
  }

  function renderProgress() {
    var done = goals.filter(function (g) { return goalsDone[g]; }).length;
    var pct = goals.length ? Math.round((done / goals.length) * 100) : 0;
    var text = $("#obj-progress-text");
    if (text) text.textContent = pct + "% des objectifs atteints";
    var detail = $("#obj-progress-detail");
    if (detail) {
      detail.textContent = goals.length
        ? done + "/" + goals.length + " objectif" + (goals.length > 1 ? "s" : "") + " validé" + (done > 1 ? "s" : "")
        : "Ajoutez vos premiers objectifs pour commencer.";
    }
    var ring = $("#obj-ring [data-chart]");
    if (ring) {
      ring.setAttribute("data-chart", '{"type":"ring","percent":' + pct + ',"size":96,"thickness":10}');
      if (window.IntelliCharts) {
        try {
          var cfg = JSON.parse(ring.getAttribute("data-chart"));
          window.IntelliCharts.ring(ring, cfg.percent, cfg);
        } catch (e) { /* ignore */ }
      }
    }
  }

  /* ---------- Actions ---------- */
  function toggleGoal(g) {
    if (goalsDone[g]) delete goalsDone[g];
    else goalsDone[g] = true;
    render();
    save().then(function () {
      if (window.IntelliApp) window.IntelliApp.showToast(goalsDone[g] ? "Objectif validé 🎉" : "Objectif remis en cours.", "success");
    }).catch(function () {
      if (window.IntelliApp) window.IntelliApp.showToast("Erreur lors de la sauvegarde.", "error");
    });
  }

  function deleteGoal(i) {
    var g = goals[i];
    if (g == null) return;
    goals.splice(i, 1);
    delete goalsDone[g];
    render();
    save().then(function () {
      if (window.IntelliApp) window.IntelliApp.showToast("Objectif supprimé.");
    }).catch(function () {
      if (window.IntelliApp) window.IntelliApp.showToast("Erreur lors de la suppression.", "error");
    });
  }

  function addGoal(text) {
    text = text.trim();
    if (!text) return false;
    if (goals.indexOf(text) !== -1) {
      if (window.IntelliApp) window.IntelliApp.showToast("Cet objectif existe déjà.", "error");
      return false;
    }
    goals.push(text);
    render();
    save().then(function () {
      if (window.IntelliApp) window.IntelliApp.showToast("Objectif ajouté.", "success");
    }).catch(function () {
      if (window.IntelliApp) window.IntelliApp.showToast("Erreur lors de l'ajout.", "error");
    });
    return true;
  }

  /* ---------- Événements ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    if (!window.IntelliAPI || !window.IntelliAPI.getToken()) {
      window.location.href = "login.html";
      return;
    }
    load();

    // Ajouter (bouton)
    var addBtn = $("#add-objective");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        $("#obj-input").value = "";
        var err = document.querySelector("[data-error-for='obj-input']");
        if (err) { err.textContent = ""; err.classList.remove("is-visible"); }
        $("#obj-input").classList.remove("is-invalid");
        if (window.IntelliApp) window.IntelliApp.openModal("#obj-modal");
        setTimeout(function () { $("#obj-input").focus(); }, 150);
      });
    }

    // Ajouter (formulaire)
    var form = $("#obj-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var input = $("#obj-input");
        var err = document.querySelector("[data-error-for='obj-input']");
        if (!input.value.trim()) {
          input.classList.add("is-invalid");
          if (err) { err.textContent = "Saisissez un objectif."; err.classList.add("is-visible"); }
          return;
        }
        if (addGoal(input.value)) {
          if (window.IntelliApp) window.IntelliApp.closeModal(document.getElementById("obj-modal"));
        }
      });
    }

    // Suggestions (clique)
    var suggestions = $("#obj-suggestions");
    if (suggestions) {
      suggestions.addEventListener("click", function (e) {
        var chip = e.target.closest("[data-goal]");
        if (!chip) return;
        addGoal(chip.getAttribute("data-goal"));
      });
    }

    // Liste : cocher / supprimer
    var list = $("#obj-list");
    if (list) {
      list.addEventListener("click", function (e) {
        var del = e.target.closest("[data-del]");
        if (del) {
          deleteGoal(parseInt(del.getAttribute("data-del"), 10));
          return;
        }
        var toggle = e.target.closest("[data-toggle]");
        if (toggle) {
          var i = parseInt(toggle.getAttribute("data-toggle"), 10);
          var g = goals[i];
          if (g != null) toggleGoal(g);
        }
      });
      list.addEventListener("change", function (e) {
        var input = e.target.closest("input[data-toggle]");
        if (input) {
          var i = parseInt(input.getAttribute("data-toggle"), 10);
          var g = goals[i];
          if (g != null) toggleGoal(g);
        }
      });
    }
  });
})();
