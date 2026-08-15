/* ============================================================
   IntelliTamed — Analyse de projet (100% dynamique via l'API)
   - GET /api/projects/{id}/           → projet
   - GET /api/projects/{id}/analyses/  → analyses précédentes
   - POST /api/projects/{id}/analyze/  → nouvelle analyse Gemini
   Remplit : titre, KPIs, SWOT, recommandations, prochaines étapes.
   ============================================================ */

(function () {
  "use strict";

  function $(sel) { return document.querySelector(sel); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var STATUS_LABELS = {
    idea: "Idée", preparation: "Préparation", development: "Développement",
    launched: "Lancé", growth: "Croissance"
  };

  function projectId() {
    return new URLSearchParams(window.location.search).get("id");
  }

  /* ---------- Chargement initial : projet + analyses ---------- */
  function loadPage() {
    var pid = projectId();

    function emptyState(msg) {
      var title = $(".analysis-header .page-title");
      if (title) title.textContent = "Aucun projet sélectionné";
      var desc = $(".analysis-header .page-description");
      if (desc) desc.textContent = msg || "Sélectionnez un projet dans « Mes Projets » pour afficher son analyse IA.";
      var live = $(".analysis-live");
      if (live) live.innerHTML = '<span class="live-dot"></span> En attente de projet';
    }

    // Pas d'id → prend le premier projet de l'utilisateur
    var fetchId = pid
      ? Promise.resolve(pid)
      : window.IntelliAPI.listProjects().then(function (d) {
          return d && d.results && d.results.length ? d.results[0].id : null;
        });

    fetchId.then(function (id) {
      if (!id) { emptyState(); return; }
      return window.IntelliAPI.getProject(id).then(function (project) {
        renderProjectHeader(project);
        return window.IntelliAPI.getProjectAnalyses(id).then(function (data) {
          var list = (data && data.results) || [];
          if (list && list.length) applyAnalysis(list[0]);
          else emptyAnalysis();
          return project;
        });
      });
    }).catch(function () {
      if (window.IntelliApp) window.IntelliApp.showToast("Impossible de charger l'analyse.", "error");
    });
  }

  /* ---------- En-tête : nom du projet + statut ---------- */
  function renderProjectHeader(p) {
    var title = $(".analysis-header .page-title");
    if (title) title.textContent = p.name || "Projet sans nom";
    var desc = $(".analysis-header .page-description");
    if (desc) {
      desc.textContent = (p.description || "Analyse stratégique générée par l'IA.")
        + " Statut : " + (STATUS_LABELS[p.status] || p.status) + " · Progression : " + (p.progress || 0) + "%.";
    }
    var live = $(".analysis-live");
    if (live) live.innerHTML = '<span class="live-dot"></span> Analyse active · ' + (STATUS_LABELS[p.status] || p.status);
  }

  /* ---------- Aucune analyse : message + zones vides ---------- */
  function emptyAnalysis() {
    var live = $(".analysis-live");
    if (live) live.innerHTML = '<span class="live-dot"></span> Aucune analyse — lancez une analyse Gemini';
    var summary = $("[data-analysis-summary]");
    if (summary) summary.textContent = "Lancez « Analyser avec Gemini » pour générer l'analyse de votre projet.";
    fillList(".swot-card.strengths ul", []);
    fillList(".swot-card.weaknesses ul", []);
    fillList(".swot-card.opportunities ul", []);
    fillList(".swot-card.threats ul", []);
    var insights = $(".insights-grid");
    if (insights) {
      insights.innerHTML = '<p class="text-muted" style="padding:8px 4px;">Aucune recommandation pour le moment. Lancez une analyse pour générer des recommandations IA.</p>';
    }
  }

  /* ---------- Injection d'une analyse dans la page ---------- */
  function applyAnalysis(a) {
    var live = $(".analysis-live");
    if (live) {
      live.innerHTML = '<span class="live-dot"></span> Analyse active · Mis à jour à l\'instant';
    }

    // Résumé
    var summary = $("[data-analysis-summary]");
    if (summary && a.summary) summary.textContent = a.summary;

    // SWOT
    fillList(".swot-card.strengths ul", a.strengths);
    fillList(".swot-card.weaknesses ul", a.weaknesses);
    fillList(".swot-card.opportunities ul", a.opportunities);
    fillList(".swot-card.threats ul", a.risks);

    // KPIs (calculés depuis l'analyse)
    renderKpis(a);

    // Recommandations → insights
    renderInsights(a.recommendations);

    // Prochaines étapes
    renderNextSteps(a.next_steps);
  }

  function fillList(selector, items) {
    var list = document.querySelector(selector);
    if (!list) return;
    if (!items || !items.length) {
      list.innerHTML = '<li class="text-muted">—</li>';
      return;
    }
    list.innerHTML = items.map(function (item) {
      return "<li>" + esc(String(item)) + "</li>";
    }).join("");
  }

  /* ---------- KPIs calculés ---------- */
  function renderKpis(a) {
    var strengths = (a.strengths || []).length;
    var weaknesses = (a.weaknesses || []).length;
    var opps = (a.opportunities || []).length;
    var risks = (a.risks || []).length;
    var total = strengths + weaknesses + opps + risks || 1;
    var validation = Math.round(((strengths + opps) / total) * 100);
    var riskScore = Math.round((risks / total) * 100);

    var v = $(".stat-card .stat-value");
    // Indice de validation (1ère carte)
    var cards = document.querySelectorAll(".grid-stats .stat-card");
    if (cards[0]) {
      var v0 = cards[0].querySelector(".stat-value");
      if (v0) v0.innerHTML = validation + "<small>%</small>";
      var ring = cards[0].querySelector("[data-chart]");
      if (ring) ring.setAttribute("data-chart", '{"type":"ring","percent":' + validation + ',"size":84,"thickness":8}');
      var d0 = cards[0].querySelector(".stat-delta");
      if (d0) d0.textContent = "Forces + Opportunités : " + (strengths + opps) + " points";
    }
    // Score de risque (4ème carte)
    if (cards[3]) {
      var v3 = cards[3].querySelector(".stat-value");
      if (v3) {
        v3.textContent = riskScore <= 33 ? "Faible" : (riskScore <= 66 ? "Modéré" : "Élevé");
        v3.style.color = riskScore <= 33 ? "var(--success)" : (riskScore <= 66 ? "#D97706" : "var(--error)");
      }
      var bar = cards[3].querySelector(".progress-bar");
      if (bar) {
        bar.style.width = riskScore + "%";
        bar.classList.toggle("green", riskScore <= 33);
        bar.style.background = riskScore <= 33 ? "" : (riskScore <= 66 ? "#D97706" : "var(--error)");
      }
      var gauge = cards[3].querySelector(".risk-gauge span");
      if (gauge) gauge.textContent = "Niveau " + Math.min(10, Math.max(1, Math.round(riskScore / 10))) + "/10";
    }
    // Graphiques re-rendus
    if (window.IntelliCharts) {
      document.querySelectorAll("[data-chart]").forEach(function (el) {
        try {
          var cfg = JSON.parse(el.getAttribute("data-chart") || "{}");
          if (window.IntelliApp && window.IntelliApp._renderChart) window.IntelliApp._renderChart(el, cfg);
          else if (window.IntelliCharts) {
            var C = window.IntelliCharts;
            if (cfg.type === "ring") C.ring(el, cfg.percent, cfg);
            else if (cfg.type === "line") C.line(el, cfg);
            else if (cfg.type === "donut") C.donut(el, cfg);
            else if (cfg.type === "bars") C.bars(el, cfg);
          }
        } catch (e) { /* ignore */ }
      });
    }
  }

  /* ---------- Recommandations → cartes insights ---------- */
  function renderInsights(recos) {
    var grid = $(".insights-grid");
    if (!grid) return;
    if (!recos || !recos.length) {
      grid.innerHTML = '<p class="text-muted" style="padding:8px 4px;">Aucune recommandation pour le moment. Lancez une analyse pour générer des recommandations IA.</p>';
      return;
    }
    var badges = ["Priorité Haute", "Nouveau", "Alerte", "Action", "Priorité Haute"];
    var types = ["Insight stratégique", "Recommandation", "Point d'attention", "Action prioritaire", "Insight stratégique"];
    grid.innerHTML = recos.slice(0, 6).map(function (r, i) {
      var badge = badges[i % badges.length];
      var cls = i % 3 === 0 ? " high" : (i % 3 === 2 ? " warn" : "");
      return '<article class="insight-card' + cls + '">' +
        '<div class="insight-head">' +
          '<span class="chip ' + (i % 3 === 0 ? "chip-red" : i % 3 === 2 ? "chip-amber" : "chip-blue") + '">' + badge + '</span>' +
          '<span class="insight-type">' + esc(types[i % types.length]) + '</span>' +
        '</div>' +
        '<p>' + esc(String(r)) + '</p>' +
      '</article>';
    }).join("");
  }

  /* ---------- Prochaines étapes ---------- */
  function renderNextSteps(steps) {
    var container = document.querySelector(".next-steps");
    if (!container) return;
    var progressWrap = container.querySelector(".next-steps-progress");
    if (!steps || !steps.length) {
      if (progressWrap) progressWrap.remove();
      container.innerHTML = '<p class="text-muted" style="padding:8px 4px;">Lancez une analyse pour générer vos prochaines actions prioritaires.</p>';
      return;
    }
    // Conserve le bloc progression s'il existe, sinon en recrée un
    var list = steps.slice(0, 6).map(function (s, i) {
      return '<label class="next-step">' +
        '<input type="checkbox" data-step="' + i + '">' +
        '<span class="next-step-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' +
        '<div><strong>' + esc(String(s)) + '</strong><p>Action générée par l\'IA — cochez quand elle est réalisée.</p></div>' +
        '<span class="chip chip-gray">Étape ' + (i + 1) + '</span>' +
      '</label>';
    }).join("");
    container.innerHTML = list +
      '<div class="next-steps-progress">' +
        '<span id="next-steps-count">0/' + steps.slice(0, 6).length + ' validées</span>' +
        '<div class="progress" style="flex:1;"><div class="progress-bar" id="next-steps-bar" style="width:0%"></div></div>' +
      '</div>';
    bindStepsProgress(container);
  }

  function bindStepsProgress(container) {
    var boxes = Array.prototype.slice.call(container.querySelectorAll(".next-step input"));
    var countEl = container.querySelector("#next-steps-count");
    var barEl = container.querySelector("#next-steps-bar");
    function update() {
      var done = boxes.filter(function (s) { return s.checked; }).length;
      if (countEl) countEl.textContent = done + "/" + boxes.length + " validées";
      if (barEl) barEl.style.width = ((done / boxes.length) * 100) + "%";
    }
    boxes.forEach(function (s) { s.addEventListener("change", update); });
    update();
  }

  /* ---------- Export du rapport (fichier .txt réel) ---------- */
  function initExport() {
    var btn = document.getElementById("export-report");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var title = ($(".analysis-header .page-title") || {}).textContent || "Rapport IntelliTamed";
      var summary = ($("[data-analysis-summary]") || {}).textContent || "";
      var sections = [];
      [".swot-card.strengths", ".swot-card.weaknesses", ".swot-card.opportunities", ".swot-card.threats"].forEach(function (sel) {
        var card = document.querySelector(sel);
        if (!card) return;
        var h = (card.querySelector("h3") || {}).textContent || "";
        var items = Array.prototype.map.call(card.querySelectorAll("li"), function (li) { return "  - " + li.textContent; });
        if (h) sections.push(h.toUpperCase() + "\n" + items.join("\n"));
      });
      var content = "RAPPORT D'ANALYSE — INTELLITAMED\n".repeat(1) +
        "================================\n" +
        "Projet : " + title + "\n" +
        "Généré le : " + new Date().toLocaleString("fr-FR") + "\n\n" +
        "RÉSUMÉ\n" + summary + "\n\n" +
        sections.join("\n\n") + "\n";
      var blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "rapport-" + title.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase() + ".txt";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 100);
      if (window.IntelliApp) window.IntelliApp.showToast("Rapport exporté.", "success");
    });
  }

  /* ---------- Bouton « Analyser avec Gemini » ---------- */
  function initAnalyzeBtn() {
    var geminiBtn = document.getElementById("gemini-analyze");
    if (!geminiBtn) return;

    geminiBtn.addEventListener("click", function () {
      geminiBtn.classList.add("is-loading");
      geminiBtn.disabled = true;

      if (!window.IntelliAPI || !window.IntelliAPI.getToken()) {
        if (window.IntelliApp) window.IntelliApp.showToast("Connectez-vous pour lancer une analyse Gemini réelle.", "error");
        geminiBtn.classList.remove("is-loading");
        geminiBtn.disabled = false;
        return;
      }

      var pid = projectId();
      var fetchId = pid
        ? Promise.resolve(pid)
        : window.IntelliAPI.listProjects().then(function (d) { return d && d.results && d.results.length ? d.results[0].id : null; });

      fetchId.then(function (id) {
        if (!id) {
          geminiBtn.classList.remove("is-loading");
          geminiBtn.disabled = false;
          if (window.IntelliApp) window.IntelliApp.showToast("Créez d'abord un projet pour l'analyser.", "error");
          return;
        }
        return window.IntelliAPI.analyzeProject(id).then(function (analysis) {
          if (!analysis || !analysis.id) throw new Error("Aucune analyse renvoyée.");
          applyAnalysis(analysis);
          if (window.IntelliApp) window.IntelliApp.showToast("Analyse Gemini générée avec succès.", "success");
        });
      }).catch(function (err) {
        if (window.IntelliApp) {
          window.IntelliApp.showToast((err && err.message) || "L'analyse Gemini a échoué. Réessayez dans un instant.", "error");
        }
      }).then(function () {
        geminiBtn.classList.remove("is-loading");
        geminiBtn.disabled = false;
      });
    });
  }

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

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.IntelliAPI || !window.IntelliAPI.getToken()) {
      window.location.href = "login.html";
      return;
    }
    initTabs();
    initAnalyzeBtn();
    initExport();
    loadPage();
  });
})();
