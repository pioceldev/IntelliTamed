/* ============================================================
   IntelliTamed — Opportunités
   Marketplace : cartes, filtres, tri, watchlist (localStorage)
   ============================================================ */

(function () {
  "use strict";

  // Aucune donnée statique : les opportunités proviennent UNIQUEMENT
  // de l'API backend (assets/js/api.js → /api/opportunities/).
  // Sans backend ou sans connexion, la page affiche son état vide.
  var OPP_DATA = [];
  var MORE_DATA = [];

  var RISK_ORDER = { "faible": 0, "moyen": 1, "eleve": 2 };
  var WATCH_KEY = "intellitamed_watchlist_v1";

  var allOpps = OPP_DATA.slice();
  var watchlist = loadWatchlist();
  var activeTab = "all";

  function $(sel) { return document.querySelector(sel); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function loadWatchlist() {
    try {
      return JSON.parse(localStorage.getItem(WATCH_KEY) || "[]");
    } catch (e) { return []; }
  }
  function saveWatchlist() {
    try { localStorage.setItem(WATCH_KEY, JSON.stringify(watchlist)); } catch (e) { /* noop */ }
  }

  function categoryIcon(cat) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>';
  }

  // Charge les opportunités du backend Django si connecté (repli sur les données locales sinon)
  function syncOpportunitiesFromApi() {
    if (!window.IntelliAPI || !window.IntelliAPI.getToken()) return;
    var TYPE_MAP = {
      "Emploi": "emploi", "Freelance": "freelance", "Hackathon": "hackathon",
      "Formation": "formation", "Financement": "financement", "Incubateur": "incubateur",
      "Partenariat": "partenariat", "Recherche": "recherche"
    };
    window.IntelliAPI.listOpportunities().then(function (data) {
      if (!data || !data.results || !data.results.length) return;
      // Pré-remplit la watchlist depuis le champ `saved` renvoyé par l'API
      data.results.forEach(function (o) {
        if (o.saved && watchlist.indexOf("opp-api-" + o.id) === -1) watchlist.push("opp-api-" + o.id);
      });
      saveWatchlist();
      updateWatchCount();
      allOpps = data.results.map(function (o) {
        return {
          id: "opp-api-" + o.id,
          title: o.title,
          category: o.category || "Opportunité",
          time: "Publié par " + (o.organization || "IntelliTamed"),
          desc: o.description || "",
          growth: Math.round(20 + Math.random() * 80),
          growthLabel: "+" + Math.round(20 + Math.random() * 80) + "%/an",
          risk: "moyen",
          riskLabel: "Moyen",
          score: Math.round(60 + Math.random() * 35),
          type: TYPE_MAP[o.category] || "partenariat"
        };
      });
      var loadMore = $("#load-more");
      if (loadMore) loadMore.disabled = true;
      renderCards();
    }).catch(function () { /* backend injoignable → données locales */ });
  }

  // Charge la watchlist du backend (si connecté) et fusionne avec le local
  function syncWatchlistFromApi() {
    if (!window.IntelliAPI || !window.IntelliAPI.getToken()) return;
    window.IntelliAPI.listWatchlist().then(function (data) {
      if (!data || !data.results) return;
      var saved = data.results.map(function (w) {
        return "opp-api-" + ((w.opportunity && w.opportunity.id) || w.opportunity_id);
      }).filter(function (id) { return id && id.indexOf("opp-api-") === 0 && id.length > 8; });
      // fusion sans doublons
      saved.forEach(function (id) {
        if (watchlist.indexOf(id) === -1) watchlist.push(id);
      });
      saveWatchlist();
      updateWatchCount();
    }).catch(function () { /* backend injoignable */ });
  }

  function filteredList() {
    var f = currentFilters();
    var list = allOpps.filter(function (o) {
      if (activeTab === "watchlist" && watchlist.indexOf(o.id) === -1) return false;
      if (f.search && (o.title + " " + o.category).toLowerCase().indexOf(f.search) === -1) return false;
      if (f.type && o.type !== f.type) return false;
      if (f.growth && o.growth < parseInt(f.growth, 10)) return false;
      if (f.risk && o.risk !== f.risk) return false;
      return true;
    });

    var sort = $("#market-sort") ? $("#market-sort").value : "score";
    list.sort(function (a, b) {
      if (sort === "growth") return b.growth - a.growth;
      if (sort === "risk") return RISK_ORDER[a.risk] - RISK_ORDER[b.risk];
      return b.score - a.score;
    });
    return list;
  }

  function currentFilters() {
    return {
      search: ($("#market-search") || {}).value ? $("#market-search").value.toLowerCase() : "",
      type: document.querySelector(".filter-chip.is-selected") ? document.querySelector(".filter-chip.is-selected").getAttribute("data-value") : "",
      growth: ($("#filter-growth") || {}).value || "",
      risk: ($("#filter-risk") || {}).value || ""
    };
  }

  function cardHTML(o) {
    var watched = watchlist.indexOf(o.id) !== -1;
    var riskClass = o.risk === "faible" ? "low" : o.risk === "moyen" ? "medium" : "high";
    return '<article class="opp-card" data-id="' + o.id + '">' +
      '<div class="opp-card-top">' +
        '<span class="opp-icon violet">' + categoryIcon(o.category) + '</span>' +
        '<button class="watch-btn' + (watched ? " is-watched" : "") + '" type="button" data-watch="' + o.id + '" aria-label="Ajouter à ma watchlist" aria-pressed="' + watched + '">' +
          '<svg viewBox="0 0 24 24" fill="' + (watched ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
        '</button>' +
      '</div>' +
      '<h3>' + esc(o.title) + '</h3>' +
      '<div class="opp-meta">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
        esc(o.time) +
      '</div>' +
      '<p class="opp-desc">' + esc(o.desc) + '</p>' +
      '<div class="opp-stats">' +
        '<div class="opp-growth"><strong>' + esc(o.growthLabel) + '</strong><span>Croissance</span></div>' +
        '<div class="opp-risk"><strong class="' + riskClass + '">' + esc(o.riskLabel) + '</strong><span>Risque</span></div>' +
        '<div class="opp-score"><strong>' + o.score + '%</strong><span>Compatibilité</span></div>' +
      '</div>' +
      '<div class="opp-actions">' +
        '<button class="btn btn-secondary btn-sm" type="button" data-toast="Opportunité ajoutée à votre analyse.">Exploration complète</button>' +
        '<button class="btn btn-primary btn-sm" type="button" data-toast="Mise en relation lancée — l’assistant vous accompagne.">Saisir</button>' +
      '</div>' +
    '</article>';
  }

  function renderCards() {
    var container = $("#market-cards");
    if (!container) return;
    var list = filteredList();
    container.innerHTML = list.map(cardHTML).join("");

    var empty = list.length === 0;
    if (empty) {
      container.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:48px 24px;text-align:center;">' +
        '<span class="empty-icon" style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:14px;background:var(--light-gray);color:var(--secondary-text);margin-bottom:12px;">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:26px;height:26px;"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></span>' +
        '<h3 style="font-size:18px;font-weight:700;">Aucune opportunité trouvée</h3>' +
        '<p style="font-size:14px;color:var(--secondary-text);">Modifiez vos filtres ou votre recherche pour voir plus de résultats.</p>' +
        '</div>';
    }
    updateWatchCount();
  }

  function updateWatchCount() {
    var el = $("#watch-count");
    if (el) el.textContent = watchlist.length;
  }

  /* ---------- Événements ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    renderCards();
    syncOpportunitiesFromApi();
    syncWatchlistFromApi();

    // Onglets
    document.querySelectorAll(".market-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        activeTab = tab.getAttribute("data-tab");
        document.querySelectorAll(".market-tab").forEach(function (t) {
          var active = t === tab;
          t.classList.toggle("is-active", active);
          t.setAttribute("aria-selected", String(active));
        });
        renderCards();
      });
    });

    // Recherche & tri
    $("#market-search").addEventListener("input", renderCards);
    $("#market-sort").addEventListener("change", renderCards);

    // Watchlist (délégation) — synchronisée avec l'API si connecté
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-watch]");
      if (!btn) return;
      var id = btn.getAttribute("data-watch");
      var idx = watchlist.indexOf(id);
      if (idx === -1) {
        watchlist.push(id);
        if (window.IntelliApp) window.IntelliApp.showToast("Ajouté à votre watchlist ⭐");
      } else {
        watchlist.splice(idx, 1);
        if (window.IntelliApp) window.IntelliApp.showToast("Retiré de votre watchlist.");
      }
      saveWatchlist();
      // Synchronisation serveur
      if (window.IntelliAPI && window.IntelliAPI.getToken() && id.indexOf("opp-api-") === 0) {
        var realId = id.slice("opp-api-".length);
        var wasSaved = idx === -1;
        if (wasSaved) window.IntelliAPI.saveOpportunity(realId).catch(function () { /* noop */ });
        else window.IntelliAPI.unsaveOpportunity(realId).catch(function () { /* noop */ });
      }
      renderCards();
    });

    // Filtres modale
    document.querySelectorAll("#filter-type .filter-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        chip.classList.toggle("is-selected");
      });
    });

    $("#filters-reset").addEventListener("click", function () {
      document.querySelectorAll(".filter-chip.is-selected").forEach(function (c) { c.classList.remove("is-selected"); });
      $("#filter-growth").value = "";
      $("#filter-risk").value = "";
      renderCards();
      if (window.IntelliApp) window.IntelliApp.closeModal(document.getElementById("filters-modal"));
    });

    // Appliquer (fermer la modale et re-rendre)
    document.querySelectorAll("#filters-modal [data-modal-close]").forEach(function (b) {
      b.addEventListener("click", renderCards);
    });

    // Charger plus
    var loadMoreBtn = $("#load-more");
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", function () {
        var before = allOpps.length;
        allOpps = allOpps.concat(MORE_DATA.filter(function (m) {
          return allOpps.indexOf(m) === -1;
        }));
        renderCards();
        if (allOpps.length === before) {
          if (window.IntelliApp) window.IntelliApp.showToast("Toutes les opportunités sont affichées.");
          loadMoreBtn.disabled = true;
        } else {
          if (window.IntelliApp) window.IntelliApp.showToast(allOpps.length - before + " nouvelles opportunités chargées.", "success");
          loadMoreBtn.textContent = "Charger plus d'opportunités";
        }
      });
    }
  });
})();
