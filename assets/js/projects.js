/* ============================================================
   IntelliTamed — Mes Projets
   CRUD complet côté frontend (localStorage)
   ============================================================ */

(function () {
  "use strict";

  var STATUS_LABELS = {
    "in-progress": "En cours",
    "planned": "Planifié",
    "late": "En retard",
    "done": "Terminé"
  };
  var STATUS_BADGE = {
    "in-progress": "badge-in-progress",
    "planned": "badge-planned",
    "late": "badge-late",
    "done": "badge-done"
  };
  var PRIORITY_LABELS = { high: "Haute", medium: "Moyenne", low: "Basse" };
  var LANE_ORDER = [
    { key: "planned", label: "Planifié" },
    { key: "in-progress", label: "En cours" },
    { key: "late", label: "En retard" },
    { key: "done", label: "Terminé" }
  ];

  var projects = [];
  var editingId = null;
  var deletingId = null;

  function $(sel) { return document.querySelector(sel); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function loadProjects() {
    var store = window.IntelliApp ? window.IntelliApp.loadStore() : { projects: [] };
    projects = (store.projects || []).slice();
  }
  function persistProjects() {
    var store = window.IntelliApp ? window.IntelliApp.loadStore() : {};
    store.projects = projects;
    if (window.IntelliApp) window.IntelliApp.saveStore(store);
  }

  var CATEGORY_ICONS = {
    "Stratégie": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>',
    "Opérations": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/></svg>',
    "Technologie": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    "Marketing": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h2l2-6 4 12 3-9 2 3h7"/></svg>',
    "IA / Data": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    "Finance": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>'
  };
  var CATEGORY_COLORS = {
    "Stratégie": "", "Opérations": "violet", "Technologie": "amber", "Marketing": "green", "IA / Data": "", "Finance": "violet"
  };

  function iconForCategory(cat) {
    return CATEGORY_ICONS[cat] || CATEGORY_ICONS["Stratégie"];
  }
  function colorForCategory(cat) {
    return CATEGORY_COLORS[cat] || "";
  }

  /* ---------- Filtres ---------- */
  function currentFilters() {
    return {
      search: ($("#project-search") || {}).value ? $("#project-search").value.toLowerCase() : "",
      status: ($("#filter-status") || {}).value || "",
      priority: ($("#filter-priority") || {}).value || ""
    };
  }

  function filteredProjects() {
    var f = currentFilters();
    return projects.filter(function (p) {
      if (f.status && p.status !== f.status) return false;
      if (f.priority && p.priority !== f.priority) return false;
      if (f.search) {
        var hay = (p.name + " " + p.category + " " + p.id).toLowerCase();
        if (hay.indexOf(f.search) === -1) return false;
      }
      return true;
    });
  }

  /* ---------- Rendu tableau ---------- */
  function renderTable() {
    var tbody = $("#projects-tbody");
    var empty = $("#projects-empty");
    if (!tbody) return;
    var list = filteredProjects();

    if (list.length === 0) {
      tbody.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    tbody.innerHTML = list.map(function (p) {
      return '<tr>' +
        '<td data-label="Projet">' +
          '<div class="project-cell">' +
            '<span class="project-icon ' + colorForCategory(p.category) + '">' + iconForCategory(p.category) + '</span>' +
            '<div>' +
              '<a class="project-name" href="project-analysis.html">' + esc(p.name) + '</a>' +
              '<span>' + esc(p.category.toUpperCase()) + ' · ' + esc(p.id) + '</span>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td data-label="Statut"><span class="badge-status ' + STATUS_BADGE[p.status] + '">' + STATUS_LABELS[p.status] + '</span></td>' +
        '<td data-label="Priorité"><span class="priority priority-' + p.priority + '"><span class="priority-dot"></span>' + PRIORITY_LABELS[p.priority] + '</span></td>' +
        '<td data-label="Progression"><div class="progress-cell"><div class="progress"><div class="progress-bar" style="width:' + p.progress + '%"></div></div><span>' + p.progress + '%</span></div></td>' +
        '<td data-label="Équipe"><span class="team-cell"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' + esc(p.team) + '</span></td>' +
        '<td data-label="Échéance"><span class="team-cell"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' + esc(p.due) + '</span></td>' +
        '<td data-label="Actions"><div class="row-actions">' +
          '<button class="btn-icon" type="button" data-edit="' + p.id + '" aria-label="Modifier ' + esc(p.name) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg></button>' +
          '<button class="btn-icon danger" type="button" data-delete="' + p.id + '" aria-label="Supprimer ' + esc(p.name) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
        '</div></td>' +
      '</tr>';
    }).join("");
  }

  /* ---------- Rendu roadmap ---------- */
  function renderRoadmap() {
    var lanes = $("#roadmap-lanes");
    if (!lanes) return;
    var list = filteredProjects();

    lanes.innerHTML = LANE_ORDER.map(function (lane) {
      var items = list.filter(function (p) { return p.status === lane.key; });
      var cards = items.length ? items.map(function (p) {
        return '<div class="roadmap-card" data-edit="' + p.id + '">' +
          '<strong>' + esc(p.name) + '</strong>' +
          '<span>' + esc(p.category) + ' · ' + esc(p.due) + '</span>' +
          '<div class="progress"><div class="progress-bar" style="width:' + p.progress + '%"></div></div>' +
          '<span>' + p.progress + '% · Priorité ' + PRIORITY_LABELS[p.priority] + '</span>' +
        '</div>';
      }).join("") : '<p class="roadmap-empty">Aucun projet</p>';

      return '<div class="roadmap-lane">' +
        '<div class="roadmap-lane-head"><span>' + lane.label + '</span><span class="lane-count">' + items.length + '</span></div>' +
        cards +
      '</div>';
    }).join("");
  }

  /* ---------- Changement de vue ---------- */
  function setView(view) {
    document.querySelectorAll(".view-toggle-btn").forEach(function (b) {
      var active = b.getAttribute("data-view") === view;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-view-panel]").forEach(function (p) {
      p.hidden = p.getAttribute("data-view-panel") !== view;
    });
    if (view === "roadmap") renderRoadmap();
  }

  /* ---------- Modale projet ---------- */
  function openProjectModal(project) {
    editingId = project ? project.id : null;
    var title = $("#project-modal-title");
    var save = $("#project-save");
    if (title) title.textContent = project ? "Modifier le projet" : "Nouveau Projet";
    if (save) save.textContent = project ? "Enregistrer" : "Créer le projet";

    $("#p-name").value = project ? project.name : "";
    $("#p-category").value = project ? project.category : "Stratégie";
    $("#p-status").value = project ? project.status : "in-progress";
    $("#p-priority").value = project ? project.priority : "medium";
    $("#p-progress").value = project ? project.progress : 0;
    $("#p-due").value = project ? project.due : "";
    $("#p-team").value = project ? project.team : 1;

    $("#p-name").classList.remove("is-invalid");
    var err = document.querySelector("[data-error-for='p-name']");
    if (err) { err.textContent = ""; err.classList.remove("is-visible"); }

    if (window.IntelliApp) window.IntelliApp.openModal("#project-modal");
  }

  /* ---------- Événements ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    loadProjects();
    renderTable();
    renderRoadmap();

    // Recherche & filtres
    $("#project-search").addEventListener("input", function () {
      renderTable();
      renderRoadmap();
    });
    $("#filter-status").addEventListener("change", function () { renderTable(); renderRoadmap(); });
    $("#filter-priority").addEventListener("change", function () { renderTable(); renderRoadmap(); });
    $("#clear-filters").addEventListener("click", function () {
      $("#project-search").value = "";
      $("#filter-status").value = "";
      $("#filter-priority").value = "";
      renderTable();
      renderRoadmap();
      if (window.IntelliApp) window.IntelliApp.showToast("Filtres réinitialisés.");
    });

    // Changement de vue
    document.querySelectorAll(".view-toggle-btn").forEach(function (b) {
      b.addEventListener("click", function () { setView(b.getAttribute("data-view")); });
    });

    // Boutons Nouveau Projet
    document.querySelectorAll('[data-modal-open="#project-modal"]').forEach(function (b) {
      b.addEventListener("click", function () { openProjectModal(null); });
    });

    // Formulaire
    $("#project-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var name = $("#p-name").value.trim();
      var errEl = document.querySelector("[data-error-for='p-name']");
      if (!name) {
        $("#p-name").classList.add("is-invalid");
        if (errEl) { errEl.textContent = "Veuillez saisir un nom de projet."; errEl.classList.add("is-visible"); }
        return;
      }

      var data = {
        name: name,
        category: $("#p-category").value,
        status: $("#p-status").value,
        priority: $("#p-priority").value,
        progress: Math.max(0, Math.min(100, parseInt($("#p-progress").value, 10) || 0)),
        due: $("#p-due").value.trim() || "À définir",
        team: $("#p-team").value || "1"
      };

      if (editingId) {
        var idx = projects.findIndex(function (p) { return p.id === editingId; });
        if (idx !== -1) {
          data.id = editingId;
          projects[idx] = data;
        }
        if (window.IntelliApp) window.IntelliApp.showToast("Projet « " + name + " » mis à jour.", "success");
      } else {
        var nextNum = projects.reduce(function (max, p) {
          var n = parseInt((p.id || "PRJ-000").replace("PRJ-", ""), 10) || 0;
          return Math.max(max, n);
        }, 0) + 1;
        data.id = "PRJ-" + ("00" + nextNum).slice(-3);
        projects.push(data);
        if (window.IntelliApp) window.IntelliApp.showToast("Projet « " + name + " » créé avec succès.", "success");
      }

      persistProjects();
      renderTable();
      renderRoadmap();
      if (window.IntelliApp) window.IntelliApp.closeModal(document.getElementById("project-modal"));
    });

    // Délégation : modifier / supprimer
    document.addEventListener("click", function (e) {
      var editBtn = e.target.closest("[data-edit]");
      if (editBtn) {
        var p = projects.find(function (x) { return x.id === editBtn.getAttribute("data-edit"); });
        if (p) openProjectModal(p);
        return;
      }
      var delBtn = e.target.closest("[data-delete]");
      if (delBtn) {
        var d = projects.find(function (x) { return x.id === delBtn.getAttribute("data-delete"); });
        if (d) {
          deletingId = d.id;
          var nameEl = $("#delete-project-name");
          if (nameEl) nameEl.textContent = d.name;
          if (window.IntelliApp) window.IntelliApp.openModal("#delete-modal");
        }
      }
    });

    // Confirmation suppression
    $("#delete-confirm").addEventListener("click", function () {
      if (deletingId) {
        projects = projects.filter(function (p) { return p.id !== deletingId; });
        persistProjects();
        renderTable();
        renderRoadmap();
        if (window.IntelliApp) {
          window.IntelliApp.closeModal(document.getElementById("delete-modal"));
          window.IntelliApp.showToast("Projet supprimé.", "success");
        }
        deletingId = null;
      }
    });
  });
})();
