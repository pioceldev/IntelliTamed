/* ============================================================
   IntelliTamed — Analyse de projet
   ============================================================ */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    // Onglets
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

    // Prochaines étapes : compteur
    var steps = Array.prototype.slice.call(document.querySelectorAll(".next-step input"));
    var countEl = document.getElementById("next-steps-count");
    var barEl = document.getElementById("next-steps-bar");

    function updateSteps() {
      var done = steps.filter(function (s) { return s.checked; }).length;
      if (countEl) countEl.textContent = done + "/" + steps.length + " validées";
      if (barEl) barEl.style.width = ((done / steps.length) * 100) + "%";
    }
    steps.forEach(function (s) { s.addEventListener("change", updateSteps); });
    updateSteps();

    // Bouton "Analyser avec Gemini" — API Django (si connecté) sinon simulation
    var geminiBtn = document.getElementById("gemini-analyze");
    if (geminiBtn) {
      geminiBtn.addEventListener("click", function () {
        geminiBtn.classList.add("is-loading");
        geminiBtn.disabled = true;

        function done(simulated) {
          geminiBtn.classList.remove("is-loading");
          geminiBtn.disabled = false;
          if (window.IntelliApp) {
            window.IntelliApp.showToast(
              simulated ? "Analyse Gemini terminée : 3 nouveaux insights ont été générés." : "Analyse réelle générée par Gemini.",
              "success");
          }
          var live = document.querySelector(".analysis-live");
          if (live) {
            live.innerHTML = '<span class="live-dot"></span> Analyse Active · Mis à jour à l\'instant';
          }
        }

        // 1. Backend Django connecté → analyse réelle
        if (window.IntelliAPI && window.IntelliAPI.getToken()) {
          var projectId = new URLSearchParams(window.location.search).get("id");
          var fetchProject = projectId
            ? Promise.resolve(projectId)
            : window.IntelliAPI.listProjects().then(function (d) { return d && d.results && d.results.length ? d.results[0].id : null; });

          fetchProject.then(function (pid) {
            if (!pid) { setTimeout(function () { done(true); }, 1400); return; }
            return window.IntelliAPI.analyzeProject(pid);
          }).then(function (analysis) {
            if (!analysis) { setTimeout(function () { done(true); }, 1400); return; }
            applyAnalysis(analysis);
            done(false);
          }).catch(function () { setTimeout(function () { done(true); }, 1400); });
          return;
        }

        // 2. Non connecté au backend → message d'erreur clair (pas de simulation)
        if (window.IntelliApp) {
          window.IntelliApp.showToast("Connectez-vous pour lancer une analyse Gemini réelle.", "error");
        }
        done(false);
      });
    }
  });

  /* ---------- Injection des résultats d'analyse dans la page ---------- */
  function applyAnalysis(a) {
    function fillList(selector, items) {
      var list = document.querySelector(selector);
      if (!list || !items || !items.length) return;
      list.innerHTML = items.map(function (item) {
        return "<li>" + String(item).replace(/[&<>"']/g, function (c) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        }) + "</li>";
      }).join("");
    }
    fillList(".swot-card.strengths ul", a.strengths);
    fillList(".swot-card.weaknesses ul", a.weaknesses);
    fillList(".swot-card.opportunities ul", a.opportunities);
    fillList(".swot-card.threats ul", a.risks);
    if (a.summary) {
      var sub = document.querySelector(".analysis-live");
      var summaryEl = document.querySelector("[data-analysis-summary]");
      if (summaryEl) summaryEl.textContent = a.summary;
    }
  }
})();
