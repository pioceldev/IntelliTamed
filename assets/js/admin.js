/* ============================================================
   IntelliTamed — Administration
   Connecté à l'API Django (staff uniquement) :
   - /api/auth/admin/stats   → KPIs + donut abonnements
   - /api/auth/admin/users   → tableau « Utilisateurs récents »
   - /api/auth/admin/projects → compteurs projets
   Sans session staff : les valeurs restent neutres.
   ============================================================ */

(function () {
  "use strict";

  var PRICES = { starter: 0, pro: 49, enterprise: 899 };
  var PLAN_LABELS = { starter: "Starter", pro: "Pro", enterprise: "Entreprise" };

  function $(sel) { return document.querySelector(sel); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function isStaffSession() {
    return !!(window.IntelliAPI && window.IntelliAPI.getToken());
  }

  function fmtEUR(n) {
    return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  }

  /* ---------- KPIs ---------- */
  function fillKPIs(stats) {
    var cards = document.querySelectorAll(".grid-stats .stat-card");
    if (!cards.length) return;

    var mrr = (stats.subscriptions || []).reduce(function (sum, s) {
      return sum + (s.count || 0) * (PRICES[s.plan] || 0);
    }, 0);

    var values = [
      { el: cards[0].querySelector(".stat-value"), text: fmtEUR(mrr) },
      { el: cards[1].querySelector(".stat-value"), text: String(stats.active_users || 0) },
      { el: cards[2].querySelector(".stat-value"), text: String(stats.ai_requests || 0) },
      { el: cards[3].querySelector(".stat-value"), text: String(stats.new_users_30d || 0) }
    ];
    values.forEach(function (v) {
      if (v.el) v.el.textContent = v.text;
    });

    // Sous-texte des deltas : valeurs réelles
    var deltas = cards[0].querySelector(".stat-delta");
    if (deltas) {
      deltas.textContent = (stats.subscriptions || []).map(function (s) {
        return (PLAN_LABELS[s.plan] || s.plan) + " ×" + (s.count || 0);
      }).join(" · ") || "Aucun abonnement";
      deltas.className = "stat-delta";
    }
  }

  /* ---------- Tableau utilisateurs récents ---------- */
  function fillUsers(users) {
    var table = document.querySelector(".transactions-table");
    var tbody = table ? table.querySelector("tbody") : null;
    if (!tbody) return;
    // Titre de la carte contenant le tableau → « Utilisateurs récents »
    var card = table.closest(".card");
    var title = card ? card.querySelector(".card-title") : null;
    if (!users || !users.length) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center;color:#64748B;padding:28px 0;">' +
        "Aucun utilisateur enregistré pour l'instant.</td></tr>";
      return;
    }
    tbody.innerHTML = users.slice(0, 8).map(function (u) {
      var initials = ((u.first_name || "")[0] || "") + ((u.last_name || "")[0] || "");
      initials = initials || (u.email || "?").slice(0, 2).toUpperCase();
      var name = (u.first_name + " " + u.last_name).trim() || u.email;
      var date = (u.date_joined || "").slice(0, 10);
      return "<tr>" +
        '<td><span class="tx-id">#' + u.id + "</span></td>" +
        '<td><div class="tx-user"><span class="avatar avatar-sm">' + esc(initials) + "</span><span>" + esc(name) + "</span></div></td>" +
        "<td>" + esc(u.role || "entrepreneur") + "</td>" +
        "<td>" + (u.projects_count || 0) + " projet(s)</td>" +
        '<td><span class="badge-status ' + (u.is_active ? "badge-done" : "badge-late") + '">' + (u.is_active ? "Actif" : "Inactif") + "</span></td>" +
      "</tr>";
    }).join("");
    if (title && title.textContent.indexOf("Transactions") !== -1) {
      title.textContent = "Utilisateurs Récents";
    }
  }

  /* ---------- Donut distribution des plans ---------- */
  function fillDonut(stats) {
    var container = document.querySelector(".plan-distribution [data-chart]");
    if (!container) return;
    var subs = stats.subscriptions || [];
    var total = subs.reduce(function (s, x) { return s + (x.count || 0); }, 0);
    if (!total) {
      container.innerHTML = '<p style="text-align:center;color:#64748B;padding:40px 0;font-size:13px;">Aucun abonnement actif.</p>';
      return;
    }
    var colors = { starter: "#CBD5E1", pro: "#2563EB", enterprise: "#7C3AED" };
    var segments = subs.map(function (s) {
      return {
        label: PLAN_LABELS[s.plan] || s.plan,
        value: Math.round((s.count / total) * 100),
        color: colors[s.plan] || "#2563EB"
      };
    });
    container.innerHTML = "";
    if (window.IntelliCharts) {
      window.IntelliCharts.donut(container, {
        size: 170,
        centerLabel: String(total),
        centerSub: "abonnements",
        segments: segments
      });
    }
  }

  /* ---------- Graphiques réels ---------- */
  function fillCharts(stats) {
    var charts = document.querySelectorAll(".admin-main [data-chart]");
    if (!charts.length) return;

    // 1. Croissance du revenu : MRR estimé par plan (données réelles des abonnements)
    var revChart = charts[0];
    var subs = stats.subscriptions || [];
    if (revChart) {
      if (!subs.length) {
        revChart.innerHTML = '<p style="text-align:center;color:#64748B;padding:60px 0;font-size:13px;">Aucun revenu enregistré pour l\'instant.</p>';
      } else if (window.IntelliCharts) {
        revChart.innerHTML = "";
        window.IntelliCharts.line(revChart, {
          type: "line", height: 280,
          labels: subs.map(function (s) { return PLAN_LABELS[s.plan] || s.plan; }),
          series: [{
            name: "MRR estimé (€)",
            color: "#2563EB",
            data: subs.map(function (s) { return (s.count || 0) * (PRICES[s.plan] || 0); })
          }]
        });
      }
    }

    // 2. Charge du moteur IA : répartition par type de requête
    var iaChart = charts[1];
    var byType = stats.requests_by_type || [];
    var labels = { assistant: "Assistant", analyze: "Analyse", action_plan: "Plan", recommend: "Recommandations" };
    if (iaChart) {
      if (!byType.length) {
        iaChart.innerHTML = '<p style="text-align:center;color:#64748B;padding:60px 0;font-size:13px;">Aucune requête IA pour l\'instant.</p>';
      } else if (window.IntelliCharts) {
        iaChart.innerHTML = "";
        window.IntelliCharts.line(iaChart, {
          type: "line", height: 240, area: true,
          labels: byType.map(function (t) { return labels[t.request_type] || t.request_type; }),
          series: [{ name: "Requêtes", color: "#7C3AED", data: byType.map(function (t) { return t.count || 0; }) }]
        });
      }
    }
  }

  /* ---------- Chargement ---------- */
  function loadAll() {
    if (!isStaffSession()) return;
    Promise.all([
      window.IntelliAPI.adminStats(),
      window.IntelliAPI.adminUsers()
    ]).then(function (res) {
      var stats = res[0] || {};
      var users = (res[1] && res[1].results) || [];
      fillKPIs(stats);
      fillUsers(users);
      fillDonut(stats);
      fillCharts(stats);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    loadAll();

    // Bouton Exporter → export CSV réel des stats
    var exportBtn = document.querySelector('.page-actions .btn-secondary');
    if (exportBtn && window.IntelliAPI) {
      exportBtn.addEventListener("click", function () {
        window.IntelliAPI.adminStats().then(function (stats) {
          if (!stats) return;
          var rows = [
            ["métrique", "valeur"],
            ["utilisateurs", stats.users],
            ["utilisateurs_actifs", stats.active_users],
            ["nouveaux_30j", stats.new_users_30d],
            ["projets", stats.projects],
            ["requetes_ia", stats.ai_requests],
            ["opportunites", stats.opportunities],
            ["plans_action", stats.action_plans]
          ];
          var csv = rows.map(function (r) { return r.join(","); }).join("\n");
          var blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "intellitamed-admin.csv";
          document.body.appendChild(a);
          a.click();
          a.remove();
          if (window.IntelliApp) window.IntelliApp.showToast("Export CSV généré.", "success");
        });
      });
    }

    // Rapport planifié : ajout dynamique (déjà en place)
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

      var list = document.querySelector(".reports-list");
      if (list) {
        var item = document.createElement("li");
        item.className = "report-item";
        item.innerHTML =
          '<span class="report-icon">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>' +
          "</span>" +
          "<div><strong>" + name.replace(/[<>&"']/g, "") + "</strong>" +
          "<span>" + frequency + " · " + time + "</span></div>" +
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
