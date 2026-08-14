/* ============================================================
   IntelliTamed — Administration
   ============================================================ */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var saveBtn = document.getElementById("report-save");
    if (!saveBtn) return;

    saveBtn.addEventListener("click", function () {
      var name = document.getElementById("rep-name").value.trim();
      var frequency = document.getElementById("rep-frequency").value;
      var time = document.getElementById("rep-time").value || "08:00";

      if (!name) {
        if (window.IntelliApp) window.IntelliApp.showToast("Donnez un nom au rapport.", "error");
        return;
      }

      // Ajout dynamique dans la liste des rapports
      var list = document.querySelector(".reports-list");
      if (list) {
        var item = document.createElement("li");
        item.className = "report-item";
        item.innerHTML =
          '<span class="report-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>' +
          '</span>' +
          '<div><strong>' + name.replace(/[<>&"']/g, "") + '</strong>' +
          '<span>' + frequency + ' · ' + time + '</span></div>' +
          '<span class="chip chip-green">Actif</span>';
        list.appendChild(item);
      }

      document.getElementById("rep-name").value = "";
      if (window.IntelliApp) {
        window.IntelliApp.closeModal(document.getElementById("report-modal"));
        window.IntelliApp.showToast("Rapport planifié créé avec succès.", "success");
      }
    });
  });
})();
