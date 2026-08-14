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

    // Bouton "Analyser avec Gemini" — simulation d'analyse
    var geminiBtn = document.getElementById("gemini-analyze");
    if (geminiBtn) {
      geminiBtn.addEventListener("click", function () {
        geminiBtn.classList.add("is-loading");
        geminiBtn.disabled = true;
        setTimeout(function () {
          geminiBtn.classList.remove("is-loading");
          geminiBtn.disabled = false;
          if (window.IntelliApp) {
            window.IntelliApp.showToast("Analyse Gemini terminée : 3 nouveaux insights ont été générés.", "success");
          }
          // Mise à jour simulée de l'horodatage
          var live = document.querySelector(".analysis-live");
          if (live) {
            live.innerHTML = '<span class="live-dot"></span> Analyse Active · Mis à jour à l\'instant';
          }
        }, 1800);
      });
    }
  });
})();
