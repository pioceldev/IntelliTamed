/* ============================================================
   IntelliTamed — Plan d'action
   Phases, tâches, progression — 100% API Django :
   - /api/action-plans + /api/action-steps (persistance)
   - « Générer avec Gemini » crée un plan complet depuis un projet
   Aucune donnée locale : sans connexion → redirection login.
   ============================================================ */

(function () {
  "use strict";

  var PHASES = [
    { id: "phase-1", label: "Phase 1 : Validation du concept", short: "Validation" },
    { id: "phase-2", label: "Phase 2 : Architecture technique", short: "Architecture" },
    { id: "phase-3", label: "Phase 3 : Développement & test", short: "Développement" },
    { id: "phase-4", label: "Phase 4 : Lancement", short: "Lancement" }
  ];

  var PRIORITY_LABELS = { high: "Haute", medium: "Moyenne", low: "Basse" };

  var tasks = {}; // phaseId -> [task]
  var activeTaskId = null;
  var planId = null;   // id du plan côté serveur (null = local)

  function $(sel) { return document.querySelector(sel); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function isApi() {
    return !!(window.IntelliAPI && window.IntelliAPI.getToken());
  }

  /* ---------- État en mémoire (aucun localStorage) ---------- */
  function allTasks() {
    var out = [];
    PHASES.forEach(function (p) { (tasks[p.id] || []).forEach(function (t) { out.push(t); }); });
    return out;
  }

  /* ---------- Synchronisation serveur ---------- */
  function loadFromServer() {
    if (!isApi()) return Promise.resolve(false);
    return window.IntelliAPI.listActionPlans().then(function (data) {
      var plans = (data && data.results) || [];
      if (!plans.length) {
        setServerStatus("no-plan");
        return false;
      }
      var plan = plans[0];
      planId = plan.id;
      setServerStatus("plan", plan);
      tasks = {};
      (plan.steps || []).forEach(function (step) {
        var phase = PHASES.some(function (p) { return p.id === step.phase; }) ? step.phase : "phase-1";
        if (!tasks[phase]) tasks[phase] = [];
        tasks[phase].push({
          id: "srv-" + step.id,
          serverId: step.id,
          title: step.title,
          desc: step.description || "",
          category: step.category || "",
          priority: step.priority || "medium",
          time: step.deadline || "",
          done: step.status === "done"
        });
      });
      renderPhases();
      renderTaskDetail();
      updateProgress();
      return true;
    }).catch(function () {
      return false;
    });
  }

  /* ---------- Bandeau d'état serveur ---------- */
  function setServerStatus(mode, plan) {
    var el = document.getElementById("plan-server-status");
    if (!el) return;
    if (mode === "no-plan") {
      el.hidden = false;
      el.className = "plan-server-status";
      el.innerHTML =
        '<div class="plan-server-info">' +
          '<span class="chip chip-violet">Plan serveur</span>' +
          '<p>Aucun plan d\'action enregistré. Générez un plan stratégique complet avec Gemini depuis votre projet.</p>' +
        '</div>' +
        '<button class="btn btn-primary btn-sm" type="button" id="gen-plan-btn">' +
          '<span class="btn-icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg></span>' +
          'Générer avec Gemini' +
        '</button>';
      var btn = document.getElementById("gen-plan-btn");
      if (btn) btn.addEventListener("click", generateWithGemini);
    } else if (mode === "plan") {
      el.hidden = false;
      el.className = "plan-server-status";
      el.innerHTML =
        '<div class="plan-server-info">' +
          '<span class="chip chip-green">Plan serveur</span>' +
          '<p><strong>' + esc(plan.title || "Plan d'action") + '</strong> — ' +
          (plan.step_count || 0) + ' étapes · progression ' + (plan.progress || 0) + '%</p>' +
        '</div>' +
        '<button class="btn btn-secondary btn-sm" type="button" id="gen-plan-btn">' +
          '<span class="btn-icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg></span>' +
          'Régénérer avec Gemini' +
        '</button>';
      var btn2 = document.getElementById("gen-plan-btn");
      if (btn2) btn2.addEventListener("click", generateWithGemini);
    } else {
      el.hidden = true;
    }
  }

  function generateWithGemini() {
    var btn = document.getElementById("gen-plan-btn");
    if (btn) { btn.disabled = true; btn.classList.add("is-loading"); }
    window.IntelliAPI.listProjects().then(function (data) {
      var projects = (data && data.results) || [];
      if (!projects.length) {
        if (window.IntelliApp) window.IntelliApp.showToast("Créez d'abord un projet pour générer un plan.", "error");
        if (btn) { btn.disabled = false; btn.classList.remove("is-loading"); }
        return;
      }
      return window.IntelliAPI.generateActionPlan(projects[0].id).then(function (plan) {
        planId = plan.id;
        tasks = {};
        (plan.steps || []).forEach(function (step) {
          var phase = PHASES.some(function (p) { return p.id === step.phase; }) ? step.phase : "phase-1";
          if (!tasks[phase]) tasks[phase] = [];
          tasks[phase].push({
            id: "srv-" + step.id,
            serverId: step.id,
            title: step.title,
            desc: step.description || "",
            category: step.category || "",
            priority: step.priority || "medium",
            time: "",
            done: step.status === "done"
          });
        });
        setServerStatus("plan", plan);
        renderPhases();
        renderTaskDetail();
        updateProgress();
        if (window.IntelliApp) window.IntelliApp.showToast("Plan stratégique généré par Gemini 🚀", "success");
      });
    }).catch(function (err) {
      if (window.IntelliApp) window.IntelliApp.showToast((err && err.message) || "Génération impossible.", "error");
    }).then(function () {
      if (btn) { btn.disabled = false; btn.classList.remove("is-loading"); }
    });
  }

  /* ---------- Rendu ---------- */
  function renderPhases() {
    var container = $("#plan-phases");
    if (!container) return;
    var search = ($("#plan-search") || {}).value ? $("#plan-search").value.toLowerCase() : "";

    container.innerHTML = PHASES.map(function (phase) {
      var list = (tasks[phase.id] || []).filter(function (t) {
        if (!search) return true;
        return (t.title + " " + t.category).toLowerCase().indexOf(search) !== -1;
      });
      var total = (tasks[phase.id] || []).length;
      var done = list.filter(function (t) { return t.done; }).length;
      var pct = total ? Math.round((done / total) * 100) : 0;
      var complete = total > 0 && done === total;

      var rows = list.length ? list.map(function (t) {
        return taskRowHTML(phase.id, t);
      }).join("") : '<p class="task-detail-empty" style="padding:16px 0;">Aucune étape dans cette phase.</p>';

      return '<section class="card phase-card">' +
        '<div class="card-header">' +
          '<div class="phase-title' + (complete ? " is-complete" : "") + '">' +
            '<span class="phase-check">' + (complete ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px;"><polyline points="20 6 9 17 4 12"/></svg>' : phase.short.charAt(0)) + '</span>' +
            esc(phase.label) +
          '</div>' +
          '<button class="btn btn-ghost btn-sm phase-details-btn" type="button" data-phase-details="' + phase.id + '">Voir détails</button>' +
        '</div>' +
        '<div class="phase-progress-row">' +
          '<div class="progress"><div class="progress-bar" style="width:' + pct + '%"></div></div>' +
          '<span>' + done + '/' + total + '</span>' +
        '</div>' +
        '<div class="phase-tasks">' + rows + '</div>' +
      '</section>';
    }).join("");
  }

  function taskRowHTML(phaseId, t) {
    var priorityClass = "priority-" + (t.priority || "medium");
    var isActive = t.id === activeTaskId;
    return '<div class="phase-task' + (isActive ? " is-active" : "") + '" data-task="' + t.id + '" data-phase="' + phaseId + '">' +
      '<label class="task-check-label" style="display:flex;">' +
        '<input type="checkbox" data-toggle-done="' + t.id + '"' + (t.done ? " checked" : "") + '>' +
        '<span class="task-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' +
      '</label>' +
      '<div class="task-body' + (t.done ? " is-done" : "") + '">' +
        '<strong>' + esc(t.title) + '</strong>' +
        '<p class="task-desc">' + esc(t.desc || "") + '</p>' +
        '<div class="task-tags">' +
          '<span class="chip chip-gray">' + esc(t.category || "") + '</span>' +
          '<span class="chip chip-blue">' + esc(PRIORITY_LABELS[t.priority] || "") + '</span>' +
          '<span class="task-time"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' + esc(t.time || "") + '</span>' +
        '</div>' +
      '</div>' +
      '<button class="task-del" type="button" data-del-task="' + t.id + '" aria-label="Supprimer la tâche"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
    '</div>';
  }

  /* ---------- Détail de la tâche ---------- */
  function renderTaskDetail() {
    var content = $("#task-detail-content");
    var category = $("#task-detail-category");
    if (!content) return;

    var task = findTask(activeTaskId);
    if (!task) {
      content.innerHTML = '<p class="task-detail-empty">Cliquez sur une étape pour afficher ses actions de validation et sa documentation.</p>';
      if (category) category.textContent = "Sélectionnez une étape";
      return;
    }
    if (category) category.textContent = "Catégorie : " + esc(task.category || "");

    var validations = task.validations || [
      "Réviser les documents sources",
      "Générer le rapport préliminaire",
      "Soumettre pour validation IA"
    ];

    content.innerHTML =
      '<h3 class="task-detail-title">' + esc(task.title) + '</h3>' +
      '<p class="task-detail-desc">' + esc(task.desc || "") + '</p>' +
      '<div class="task-detail-meta">' +
        '<span class="chip chip-gray">' + esc(task.category || "") + '</span>' +
        '<span class="chip chip-blue">Priorité : ' + esc(PRIORITY_LABELS[task.priority] || "") + '</span>' +
        '<span class="chip chip-violet">' + esc(task.time || "") + '</span>' +
      '</div>' +
      '<p class="validation-title">Actions de validation</p>' +
      '<div class="validation-list">' +
        validations.map(function (v, i) {
          return '<label class="validation-item">' +
            '<input type="checkbox" data-validation>' +
            '<span class="validation-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' +
            '<span>' + esc(v) + '</span>' +
          '</label>';
        }).join("") +
      '</div>' +
      '<div class="task-detail-actions">' +
        '<a class="btn btn-secondary" href="assistant.html?prompt=' + encodeURIComponent("Aide-moi à réaliser l'étape « " + task.title + " » de mon plan d'action (" + (task.category || "stratégique") + "). Donne-moi un plan d'actions concret.") + '">Documentation IA</a>' +
        '<button class="btn btn-primary" type="button" data-mark-done="' + task.id + '">' + (task.done ? "Marquer comme à faire" : "Marquer comme terminée") + '</button>' +
      '</div>';
  }

  function findTask(id) {
    var found = null;
    PHASES.forEach(function (p) {
      (tasks[p.id] || []).forEach(function (t) {
        if (t.id === id) found = t;
      });
    });
    return found;
  }

  function phaseOfTask(id) {
    var found = null;
    PHASES.forEach(function (p) {
      (tasks[p.id] || []).forEach(function (t) {
        if (t.id === id) found = p.id;
      });
    });
    return found;
  }

  /* ---------- Progression globale ---------- */
  function updateProgress() {
    var all = allTasks();
    var done = all.filter(function (t) { return t.done; }).length;
    var remaining = all.length - done;
    var pct = all.length ? Math.round((done / all.length) * 100) : 0;

    var doneEl = $("#plan-done-count");
    var remainingEl = $("#plan-remaining-count");

    if (doneEl) doneEl.textContent = done;
    if (remainingEl) remainingEl.textContent = remaining;

    // Mettre à jour l'anneau (recréer)
    var ringContainer = document.querySelector(".plan-ring > [data-chart]");
    if (ringContainer) {
      ringContainer.innerHTML = "";
      if (window.IntelliCharts) window.IntelliCharts.ring(ringContainer, pct, { size: 88, thickness: 9 });
    }

    // Milestone
    var remainingToMilestone = Math.max(0, 3 - done);
    var milestoneText = $("#milestone-text");
    if (milestoneText) {
      if (remainingToMilestone === 0) {
        milestoneText.innerHTML = "Félicitations ! Vous avez débloqué <strong>l'analyse de marché avancée</strong>.";
      } else {
        milestoneText.innerHTML = "Terminez encore <strong>" + remainingToMilestone + " tâche" + (remainingToMilestone > 1 ? "s" : "") + "</strong> pour débloquer l'analyse de marché avancée.";
      }
    }
    var milestoneBar = $("#milestone-bar");
    if (milestoneBar) {
      var progressToMilestone = Math.min(100, Math.round((done / 3) * 100));
      milestoneBar.style.width = progressToMilestone + "%";
    }
  }

  /* ---------- Sync serveur des mutations ---------- */
  function syncStepToggle(task, done) {
    if (planId && task.serverId && window.IntelliAPI) {
      window.IntelliAPI.updateActionStep(task.serverId, { status: done ? "done" : "todo" })
        .catch(function () { /* silencieux : la prochaine synchro repartira du serveur */ });
    }
  }
  function syncStepDelete(task) {
    if (task.serverId && window.IntelliAPI) {
      window.IntelliAPI.deleteActionStep(task.serverId).catch(function () { /* noop */ });
    }
  }
  function syncStepCreate(task, phaseId) {
    if (planId && window.IntelliAPI) {
      window.IntelliAPI.addActionStep(planId, {
        title: task.title,
        description: task.desc || "",
        category: task.category || "",
        priority: task.priority || "medium",
        phase: phaseId
      }).then(function (step) {
        if (step && step.id) task.serverId = step.id;
      }).catch(function () { /* noop */ });
    }
  }

  /* ---------- Événements ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    // Garde : pas connecté → redirection login (données 100% serveur)
    if (!isApi()) {
      window.location.href = "login.html";
      return;
    }

    loadFromServer().then(function (loaded) {
      if (!loaded) {
        renderPhases();
        renderTaskDetail();
        updateProgress();
      }
    });

    var search = $("#plan-search");
    if (search) search.addEventListener("input", renderPhases);

    // Bouton « Générer avec Gemini » de la barre d'outils
    var toolbarBtn = document.getElementById("toolbar-gen-btn");
    if (toolbarBtn) toolbarBtn.addEventListener("click", generateWithGemini);

    // Clic sur une tâche : sélectionner + détail
    document.addEventListener("click", function (e) {
      var taskEl = e.target.closest("[data-task]");
      if (taskEl && !e.target.closest("[data-toggle-done]") && !e.target.closest("[data-del-task]")) {
        activeTaskId = taskEl.getAttribute("data-task");
        renderPhases();
        renderTaskDetail();
        return;
      }

      // Détails d'une phase : sélectionne la première étape de la phase
      var phaseDetails = e.target.closest("[data-phase-details]");
      if (phaseDetails) {
        var pid = phaseDetails.getAttribute("data-phase-details");
        var first = (tasks[pid] || [])[0];
        if (first) {
          activeTaskId = first.id;
          renderPhases();
          renderTaskDetail();
        }
        return;
      }

      // Suppression
      var delBtn = e.target.closest("[data-del-task]");
      if (delBtn) {
        e.stopPropagation();
        var id = delBtn.getAttribute("data-del-task");
        var phase = phaseOfTask(id);
        if (phase && tasks[phase]) {
          var removed = tasks[phase].filter(function (t) { return t.id === id; })[0];
          tasks[phase] = tasks[phase].filter(function (t) { return t.id !== id; });
          if (removed) syncStepDelete(removed);
          if (activeTaskId === id) activeTaskId = null;
          renderPhases();
          renderTaskDetail();
          updateProgress();
          if (window.IntelliApp) window.IntelliApp.showToast("Étape supprimée.");
        }
        return;
      }

      // Marquer terminée (depuis le détail)
      var markBtn = e.target.closest("[data-mark-done]");
      if (markBtn) {
        var t = findTask(markBtn.getAttribute("data-mark-done"));
        if (t) {
          t.done = !t.done;
          syncStepToggle(t, t.done);
          renderPhases();
          renderTaskDetail();
          updateProgress();
          if (window.IntelliApp) {
            window.IntelliApp.showToast(t.done ? "Étape marquée comme terminée 🎉" : "Étape remise à faire.", "success");
          }
        }
        return;
      }
    });

    // Cocher / décocher (délégation change)
    document.addEventListener("change", function (e) {
      var cb = e.target.closest("[data-toggle-done]");
      if (!cb) return;
      var id = cb.getAttribute("data-toggle-done");
      var t = findTask(id);
      if (t) {
        t.done = cb.checked;
        syncStepToggle(t, t.done);
        renderPhases();
        renderTaskDetail();
        updateProgress();
      }
    });

    // Ajout d'une étape
    var taskForm = $("#task-form");
    if (taskForm) {
      taskForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var title = $("#t-title").value.trim();
        var errEl = document.querySelector("[data-error-for='t-title']");
        if (!title) {
          $("#t-title").classList.add("is-invalid");
          if (errEl) { errEl.textContent = "Veuillez saisir un titre."; errEl.classList.add("is-visible"); }
          return;
        }
        $("#t-title").classList.remove("is-invalid");
        if (errEl) { errEl.textContent = ""; errEl.classList.remove("is-visible"); }

        var phaseId = $("#t-phase").value;
        if (!tasks[phaseId]) tasks[phaseId] = [];
        var newTask = {
          id: "t" + Date.now(),
          title: title,
          desc: $("#t-desc").value.trim(),
          category: $("#t-category").value,
          priority: $("#t-priority").value,
          time: $("#t-time").value.trim() || "2h",
          done: false
        };
        tasks[phaseId].push(newTask);
        syncStepCreate(newTask, phaseId);
        renderPhases();
        updateProgress();
        if (window.IntelliApp) {
          window.IntelliApp.closeModal(document.getElementById("task-modal"));
          window.IntelliApp.showToast("Étape ajoutée au plan.", "success");
        }
        $("#t-title").value = "";
        $("#t-desc").value = "";
        $("#t-time").value = "";
      });
    }
  });
})();
