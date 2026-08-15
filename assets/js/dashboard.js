/* ============================================================
   IntelliTamed — Dashboard
   Toutes les données proviennent de l'API Django :
   GET /api/auth/dashboard (stats réelles de l'utilisateur).
   Aucune donnée simulée. Sans connexion → redirection login.
   ============================================================ */

(function () {
  "use strict";

  function $(sel) { return document.querySelector(sel); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function timeAgo(iso) {
    if (!iso) return "";
    var diff = Date.now() - new Date(iso).getTime();
    if (isNaN(diff) || diff < 0) return "";
    var min = Math.floor(diff / 60000);
    if (min < 1) return "À l'instant";
    if (min < 60) return "Il y a " + min + " min";
    var h = Math.floor(min / 60);
    if (h < 24) return "Il y a " + h + " h";
    var d = Math.floor(h / 24);
    if (d === 1) return "Hier";
    if (d < 30) return "Il y a " + d + " jours";
    return new Date(iso).toLocaleDateString("fr-FR");
  }

  function fillStat(name, value) {
    var el = document.querySelector('[data-stat="' + name + '"]');
    if (el) el.textContent = value;
  }
  function fillStatSub(name, value) {
    var el = document.querySelector('[data-stat-sub="' + name + '"]');
    if (el) el.textContent = value;
  }

  function renderActivity(list) {
    var tbody = document.querySelector("[data-activity-list]");
    if (!tbody) return;
    if (!list || !list.length) {
      tbody.innerHTML = '<tr><td><p class="roadmap-empty">Aucune activité récente.</p></td></tr>';
      return;
    }
    tbody.innerHTML = list.map(function (item) {
      var isNotif = item.type === "notification";
      var icon = isNotif
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
      var iconClass = isNotif ? "amber" : "blue";
      var badge = isNotif ? '<span class="badge-status badge-planned">Notification</span>' : '<span class="badge-status badge-in-progress">Mis à jour</span>';
      return '<tr>' +
        '<td><div class="activity-item">' +
          '<span class="activity-icon ' + iconClass + '">' + icon + '</span>' +
          '<div><strong>' + esc(item.title) + '</strong><span>' + esc(item.subtitle || "") + '</span></div>' +
        '</div></td>' +
        '<td>' + badge + '</td>' +
        '<td class="activity-time">' + esc(timeAgo(item.when)) + '</td>' +
      '</tr>';
    }).join("");
  }

  function renderPlan(plan) {
    if (!plan) return;
    var doneEl = document.querySelector("[data-action-done]");
    var totalEl = document.querySelector("[data-action-total]");
    var chip = document.querySelector("[data-plan-chip]");
    var bar = document.querySelector("[data-plan-bar]");
    var list = document.querySelector("[data-action-tasks]");
    if (doneEl) doneEl.textContent = plan.done || 0;
    if (totalEl) totalEl.textContent = plan.total || 0;
    if (chip) chip.textContent = (plan.progress || 0) + "%";
    if (bar) bar.style.width = (plan.progress || 0) + "%";
    if (!list) return;
    if (!plan.steps || !plan.steps.length) {
      list.innerHTML = '<li><p class="roadmap-empty">Aucune étape pour le moment.</p></li>';
      return;
    }
    list.innerHTML = plan.steps.map(function (s) {
      var done = s.status === "done";
      var chipClass = done ? "chip-green" : "chip-blue";
      var chipLabel = done ? "Terminé" : (s.status === "doing" ? "En cours" : "À faire");
      return '<li><label class="task-mini">' +
        '<input type="checkbox" ' + (done ? "checked" : "") + ' disabled>' +
        '<span class="task-mini-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' +
        '<span class="task-mini-text">' + esc(s.title) + '</span>' +
        '<span class="chip ' + chipClass + '">' + chipLabel + '</span>' +
      '</label></li>';
    }).join("");
  }

  function renderInsight(data) {
    var box = document.querySelector("[data-ai-insight]");
    if (!box) return;
    var stats = data.stats || {};
    if (stats.total_projects === 0) {
      box.innerHTML =
        '<p>Vous n\'avez pas encore de projet. <strong>Créez votre premier projet</strong> pour obtenir des analyses IA personnalisées.</p>' +
        '<a class="btn btn-secondary btn-sm" href="projects.html">Créer un projet</a>';
      return;
    }
    var insight = "Votre progression moyenne est de <strong>" + (stats.avg_progress || 0) + "%</strong> sur " +
      "<strong>" + stats.total_projects + " projet" + (stats.total_projects > 1 ? "s" : "") + "</strong>.";
    if (stats.unread_notifications > 0) {
      insight += " Vous avez <strong>" + stats.unread_notifications + " notification" + (stats.unread_notifications > 1 ? "s" : "") + "</strong> à consulter.";
    }
    box.innerHTML =
      '<p>' + insight + '</p>' +
      '<div class="ai-insight-tags">' +
        '<span class="chip chip-blue"><svg class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg> Vue d\'ensemble</span>' +
        '<span>Synthèse calculée depuis vos données réelles</span>' +
      '</div>' +
      '<a class="btn btn-secondary btn-sm" href="project-analysis.html">Voir les recommandations</a>';
  }

  function renderChart(data) {
    var el = document.querySelector("[data-chart-live]");
    if (!el) return;
    // Graphique : progression moyenne par projet (données réelles)
    var charts = window.IntelliCharts;
    if (!charts || !charts.line) return;
    // On récupère les projets depuis l'API pour tracer leur progression
    if (window.IntelliAPI && window.IntelliAPI.getToken()) {
      window.IntelliAPI.listProjects().then(function (d) {
        var projects = (d && d.results) || [];
        if (!projects.length) {
          el.innerHTML = '<p class="roadmap-empty">Aucune donnée de progression à afficher.</p>';
          return;
        }
        var labels = projects.slice(0, 8).map(function (p) {
          return (p.name || "Projet").length > 10 ? (p.name || "Projet").slice(0, 10) + "…" : (p.name || "Projet");
        });
        var dataSeries = projects.slice(0, 8).map(function (p) { return p.progress || 0; });
        var cfg = {
          type: "line", height: 280,
          labels: labels,
          series: [{ name: "Progression", color: "#2563EB", data: dataSeries }]
        };
        el.innerHTML = "";
        charts.line(el, cfg);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Garde : pas connecté → redirection login
    if (!window.IntelliAPI || !window.IntelliAPI.getToken()) {
      window.location.href = "login.html";
      return;
    }

    var apiUser = window.IntelliAPI.getUser();
    if (apiUser && (apiUser.first_name || apiUser.email)) {
      var firstName = apiUser.first_name || apiUser.email.split("@")[0];
      var greeting = document.getElementById("dashboard-greeting");
      if (greeting) greeting.textContent = "Bonjour, " + firstName + " 👋";
    }

    window.IntelliAPI.dashboard().then(function (data) {
      if (!data) return;
      var stats = data.stats || {};

      fillStat("active_projects", stats.active_projects || 0);
      fillStat("avg_progress", stats.avg_progress || 0);
      fillStat("conversations", stats.conversations || 0);
      fillStat("unread_notifications", stats.unread_notifications || 0);

      fillStatSub("active_projects_sub", "▲ " + (stats.total_projects || 0) + " au total");
      fillStatSub("active_projects_detail", "Tous vos projets en cours");
      fillStatSub("avg_progress_sub", "▲ Progression moyenne");
      fillStatSub("conversations_sub", "▲ " + (stats.watchlist || 0) + " dans votre watchlist");
      fillStatSub("notif_sub", "▲ À traiter");

      // Anneau de progression moyenne
      var ringEl = document.querySelector("[data-chart-ring]");
      if (ringEl && window.IntelliCharts && window.IntelliCharts.ring) {
        ringEl.setAttribute("data-percent", String(stats.avg_progress || 0));
        window.IntelliCharts.ring(ringEl, stats.avg_progress || 0, { size: 76, thickness: 7 });
      }

      renderPlan(data.plan);
      renderActivity(data.recent_activity);
      renderInsight(data);
    }).catch(function () {
      fillStatSub("active_projects_sub", "Erreur de chargement");
    });

    renderChart();

    // ---------- Vraies actions ----------
    // « Nouvelle Analyse » : lance l'analyse Gemini du projet le plus avancé
    var newAnalysis = document.getElementById("new-analysis-btn");
    if (newAnalysis) {
      newAnalysis.addEventListener("click", function () {
        if (!window.IntelliAPI || !window.IntelliAPI.getToken()) return;
        newAnalysis.classList.add("is-loading");
        newAnalysis.disabled = true;
        window.IntelliAPI.listProjects().then(function (d) {
          var projects = (d && d.results) || [];
          if (!projects.length) {
            throw new Error("Créez d'abord un projet pour l'analyser.");
          }
          // Projet le plus avancé
          var best = projects.slice().sort(function (a, b) { return (b.progress || 0) - (a.progress || 0); })[0];
          return window.IntelliAPI.analyzeProject(best.id);
        }).then(function () {
          if (window.IntelliApp) window.IntelliApp.showToast("Analyse Gemini générée. Consultez la page Analyse.", "success");
          setTimeout(function () { window.location.href = "project-analysis.html"; }, 900);
        }).catch(function (err) {
          if (window.IntelliApp) window.IntelliApp.showToast((err && err.message) || "Analyse impossible. Réessayez dans un instant.", "error");
        }).then(function () {
          newAnalysis.classList.remove("is-loading");
          newAnalysis.disabled = false;
        });
      });
    }

    // ---------- Analyse d'idée (Gemini) ----------
    var ideaBtn = document.getElementById("idea-analysis-btn");
    if (ideaBtn) {
      ideaBtn.addEventListener("click", function () {
        var modal = document.getElementById("idea-modal");
        if (modal && window.IntelliApp) window.IntelliApp.openModal(modal);
      });
    }

    var ideaForm = document.getElementById("idea-form");
    if (ideaForm) {
      ideaForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var text = document.getElementById("idea-text").value.trim();
        if (!text) {
          if (window.IntelliApp) window.IntelliApp.showToast("Décrivez d'abord votre idée.", "error");
          return;
        }
        var submit = document.getElementById("idea-submit");
        if (submit) { submit.classList.add("is-loading"); submit.disabled = true; submit.textContent = "Analyse en cours…"; }
        window.IntelliAPI.analyzeIdea(text).then(function (data) {
          if (!data) throw new Error("Pas de réponse de l'IA.");
          ideaForm.hidden = true;
          var result = document.getElementById("idea-result");
          result.hidden = false;
          renderIdeaResult(data);
          if (window.IntelliApp) window.IntelliApp.showToast("Analyse de votre idée générée.", "success");
        }).catch(function (err) {
          if (window.IntelliApp) window.IntelliApp.showToast((err && err.message) || "Analyse impossible. Réessayez dans un instant.", "error");
        }).then(function () {
          if (submit) { submit.classList.remove("is-loading"); submit.disabled = false; submit.textContent = "Analyser avec Gemini"; }
        });
      });
    }

    // « Créer un projet depuis cette analyse »
    var toProject = document.getElementById("idea-to-project");
    if (toProject) {
      toProject.addEventListener("click", function () {
        var body = document.getElementById("idea-result-body");
        var data = body && body.__ideaData;
        if (!data) return;
        var name = document.getElementById("idea-text").value.trim().slice(0, 60);
        window.IntelliAPI.createProject({
          name: name || "Nouveau projet",
          description: data.solution || data.problem || "",
          problem: data.problem || "",
          solution: data.solution || "",
          target_audience: data.target_audience || "",
          business_model: data.business_model || "",
          status: "idea",
          progress: 0
        }).then(function () {
          if (window.IntelliApp) window.IntelliApp.showToast("Projet créé à partir de votre analyse.", "success");
          setTimeout(function () { window.location.href = "projects.html"; }, 900);
        }).catch(function (err) {
          if (window.IntelliApp) window.IntelliApp.showToast((err && err.message) || "Création impossible.", "error");
        });
      });
    }

    // « Exporter les données » : télécharge un rapport texte réel
    var exportBtn = document.getElementById("export-data-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        window.IntelliAPI.listProjects().then(function (d) {
          var projects = (d && d.results) || [];
          var lines = projects.map(function (p) {
            return "- " + p.name + " | " + (p.status || "") + " | " + (p.progress || 0) + "%";
          }).join("\n");
          var content = "RAPPORT DES PROJETS — INTELLITAMED\n" +
            "Généré le : " + new Date().toLocaleString("fr-FR") + "\n\n" +
            (lines || "Aucun projet.") + "\n";
          var blob = new Blob([content], { type: "text/plain;charset=utf-8" });
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "rapport-projets-" + new Date().toISOString().slice(0, 10) + ".txt";
          document.body.appendChild(a);
          a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 100);
          if (window.IntelliApp) window.IntelliApp.showToast("Rapport exporté.", "success");
        }).catch(function () {
          if (window.IntelliApp) window.IntelliApp.showToast("Export impossible.", "error");
        });
      });
    }
  });

  /* ---------- Rendu du résultat d'analyse d'idée ---------- */
  function renderIdeaResult(data) {
    var body = document.getElementById("idea-result-body");
    if (!body) return;
    body.__ideaData = data;
    function section(title, content) {
      return '<div class="idea-section"><h4>' + esc(title) + '</h4>' + content + '</div>';
    }
    function list(items) {
      return '<ul class="idea-list">' + (items || []).map(function (i) {
        return '<li><span class="msg-bullet">•</span> ' + esc(i) + '</li>';
      }).join("") + '</ul>';
    }
    body.innerHTML =
      section("Problème", "<p>" + esc(data.problem || "") + "</p>") +
      section("Solution", "<p>" + esc(data.solution || "") + "</p>") +
      section("Public cible", "<p>" + esc(data.target_audience || "") + "</p>") +
      section("Proposition de valeur", "<p>" + esc(data.value_proposition || "") + "</p>") +
      section("Opportunités", list(data.opportunities)) +
      section("Risques", list(data.risks)) +
      section("Concurrence", list(data.competition)) +
      section("Faisabilité", "<p>" + esc(data.feasibility || "") + "</p>") +
      section("Modèle économique", "<p>" + esc(data.business_model || "") + "</p>") +
      section("Recommandations", list(data.recommendations)) +
      section("Prochaines étapes", list(data.next_steps));
  }

  // Re-rendu des graphiques au redimensionnement
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      document.querySelectorAll("[data-chart]").forEach(function (el) {
        var cfg = JSON.parse(el.getAttribute("data-chart") || "{}");
        el.innerHTML = "";
        if (cfg.type === "ring") return;
        window.IntelliCharts && window.IntelliCharts.line(el, cfg);
      });
    }, 200);
  });
})();
