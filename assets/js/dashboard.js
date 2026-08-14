/* ============================================================
   IntelliTamed — Dashboard
   ============================================================ */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    // Salutation personnalisée : utilisateur JWT puis profil local
    var firstName = "Jean";
    var apiUser = window.IntelliAPI && window.IntelliAPI.getUser ? window.IntelliAPI.getUser() : null;
    if (apiUser && apiUser.first_name) {
      firstName = apiUser.first_name;
    } else {
      try {
        var store = JSON.parse(localStorage.getItem("intellitamed_store_v1") || "{}");
        var profile = store.profile || {};
        firstName = profile.firstName || "Jean";
      } catch (e) { /* noop */ }
    }
    var greeting = document.getElementById("dashboard-greeting");
    if (greeting) greeting.textContent = "Bonjour, " + firstName + " 👋";

    // Tâches mini : cocher met à jour le compteur
    var tasks = Array.prototype.slice.call(document.querySelectorAll("[data-task-item]"));
    var doneEl = document.querySelector("[data-action-done]");
    var progressBar = document.querySelector("[data-action-tasks] .progress-bar");

    function updateTasks() {
      var done = tasks.filter(function (t) { return t.checked; }).length;
      if (doneEl) doneEl.textContent = done;
      if (progressBar) progressBar.style.width = ((done / tasks.length) * 100) + "%";
    }

    tasks.forEach(function (t) {
      t.addEventListener("change", updateTasks);
    });
    updateTasks();
  });

  // Re-rendu des graphiques au redimensionnement (SVG responsive)
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      document.querySelectorAll("[data-chart]").forEach(function (el) {
        var cfg = JSON.parse(el.getAttribute("data-chart") || "{}");
        el.innerHTML = "";
        if (cfg.type === "ring") return; // l'anneau a une taille fixe
        window.IntelliCharts && window.IntelliCharts.line(el, cfg);
      });
    }, 200);
  });
})();
