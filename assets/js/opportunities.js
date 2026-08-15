/* ============================================================
   IntelliTamed — Opportunités
   Marketplace 100% API : cartes, filtres, tri, watchlist serveur.
   ============================================================ */

(function () {
  "use strict";

  // Aucune donnée statique ni aléatoire : les opportunités proviennent
  // UNIQUEMENT de l'API backend (/api/opportunities/) et le score de
  // compatibilité est calculé côté serveur selon le profil utilisateur.
  var RISK_ORDER = { "faible": 0, "moyen": 1, "eleve": 2 };

  var allOpps = [];
  var watchlist = [];
  var activeTab = "all";

  function $(sel) { return document.querySelector(sel); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function categoryIcon(cat) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>';
  }

  // Charge les opportunités du backend Django (données + score + saved)
  function syncOpportunitiesFromApi() {
    if (!window.IntelliAPI || !window.IntelliAPI.getToken()) {
      window.location.href = "login.html";
      return;
    }
    var TYPE_MAP = {
      "emploi": "emploi", "freelance": "freelance", "hackathon": "hackathon",
      "concours": "hackathon", "formation": "formation", "financement": "financement",
      "incubateur": "incubateur", "partenariat": "partenariat", "recherche": "recherche"
    };
    window.IntelliAPI.listOpportunities().then(function (data) {
      var results = (data && data.results) || [];
      // Pré-remplit la watchlist depuis le champ `saved` renvoyé par l'API
      watchlist = [];
      results.forEach(function (o) {
        if (o.saved) watchlist.push("opp-api-" + o.id);
      });
      updateWatchCount();
      allOpps = results.map(function (o) {
        var cat = o.category || "partenariat";
        return {
          id: "opp-api-" + o.id,
          title: o.title,
          category: cat,
          time: "Publié par " + (o.organization || "IntelliTamed"),
          desc: o.description || "",
          growth: 0,
          growthLabel: "—",
          risk: "moyen",
          riskLabel: "Moyen",
          score: o.score !== undefined ? o.score : 60,
          reasons: o.reasons || [],
          type: TYPE_MAP[cat] || "partenariat"
        };
      });
      renderCards();
      renderRail(results);
    }).catch(function () {
      renderCards();
    });
  }

  // Rail IA : catégories disponibles, score moyen, compteurs — depuis les données réelles
  function renderRail(results) {
    var countEl = $("[data-opp-count]");
    if (countEl) countEl.textContent = results.length;
    var marketCount = $("[data-market-count]");
    if (marketCount) marketCount.textContent = results.length;
    var watchHero = $("[data-watch-count-hero]");
    if (watchHero) watchHero.textContent = watchlist.length;

    // Catégories distinctes (comptées)
    var CATEGORY_LABELS = {
      emploi: "Emploi", freelance: "Freelance", hackathon: "Hackathon", concours: "Concours",
      formation: "Formation", financement: "Financement", incubateur: "Incubateur",
      partenariat: "Partenariat", recherche: "Recherche"
    };
    var counts = {};
    results.forEach(function (o) { counts[o.category] = (counts[o.category] || 0) + 1; });
    var cats = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    var catList = $("[data-cat-list]");
    var catCount = $("[data-cat-count]");
    if (catCount) catCount.textContent = cats.length;
    if (catList) {
      if (!cats.length) {
        catList.innerHTML = "<li>Aucune opportunité disponible.</li>";
      } else {
        var dots = ["blue", "violet", "green", "amber"];
        catList.innerHTML = cats.slice(0, 5).map(function (c, i) {
          return "<li><span class='trend-dot " + (dots[i % dots.length]) + "'></span>" +
            esc(CATEGORY_LABELS[c] || c) + " <strong>(" + counts[c] + ")</strong></li>";
        }).join("");
      }
    }

    // Score moyen
    var scores = results.map(function (o) { return o.score; }).filter(function (s) { return typeof s === "number"; });
    var avg = scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) : 0;
    var railScore = $("[data-rail-score]");
    if (railScore) railScore.textContent = avg + "%";
    var railPct = $("[data-rail-score-pct]");
    if (railPct) railPct.textContent = avg + "%";
    var railBar = $("[data-rail-score-bar]");
    if (railBar) railBar.style.width = avg + "%";
    var railText = $("[data-rail-text]");
    if (railText) {
      railText.textContent = results.length
        ? "Compatibilité moyenne calculée depuis votre profil et les " + results.length + " opportunités actives."
        : "Aucune opportunité ne correspond à votre profil pour le moment.";
    }
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
      if (sort === "risk") return RISK_ORDER[a.risk] - RISK_ORDER[b.risk];
      return b.score - a.score;
    });
    return list;
  }

  function currentFilters() {
    return {
      search: ($("#market-search") || {}).value ? $("#market-search").value.toLowerCase() : "",
      type: document.querySelector(".filter-chip.is-selected") ? document.querySelector(".filter-chip.is-selected").getAttribute("data-value") : "",
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
      (o.reasons && o.reasons.length
        ? '<div class="opp-reasons"><strong>Pourquoi cette opportunité vous correspond :</strong>' +
          o.reasons.map(function (r) { return '<span class="opp-reason">• ' + esc(r) + '</span>'; }).join("") +
          '</div>'
        : '') +
      '<div class="opp-actions">' +
        '<button class="btn btn-secondary btn-sm" type="button" data-explore="' + o.id + '">Exploration complète</button>' +
        '<button class="btn btn-primary btn-sm" type="button" data-apply="' + o.id + '">Saisir</button>' +
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
    syncOpportunitiesFromApi();

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

    // Mettre à jour les données : recharge depuis l'API
    var refreshBtn = $("#refresh-opps");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", function () {
        refreshBtn.classList.add("is-loading");
        refreshBtn.disabled = true;
        syncOpportunitiesFromApi();
        setTimeout(function () {
          refreshBtn.classList.remove("is-loading");
          refreshBtn.disabled = false;
          if (window.IntelliApp) window.IntelliApp.showToast("Opportunités actualisées.", "success");
        }, 800);
      });
    }

    // Actions réelles : exploration complète / saisir
    document.addEventListener("click", function (e) {
      var explore = e.target.closest("[data-explore]");
      if (explore) {
        var oppId = explore.getAttribute("data-explore");
        var opp = allOpps.find(function (o) { return o.id === oppId; });
        if (!opp) return;
        // Sauvegarde dans la watchlist puis ouvre l'assistant pour une analyse détaillée
        var realId = oppId.slice("opp-api-".length);
        var saveP = (window.IntelliAPI && window.IntelliAPI.getToken())
          ? window.IntelliAPI.saveOpportunity(realId).then(function () {
              if (window.IntelliApp) window.IntelliApp.showToast("Opportunité « " + opp.title + " » ajoutée à votre watchlist.", "success");
            }).catch(function () { return null; })
          : Promise.resolve();
        saveP.then(function () {
          // Ouvre l'assistant avec un prompt dédié à cette opportunité
          var prompt = encodeURIComponent("Analyse en détail l'opportunité suivante pour mon profil : " + opp.title + " — " + opp.desc);
          window.location.href = "assistant.html?prompt=" + prompt;
        });
        return;
      }
      var apply = e.target.closest("[data-apply]");
      if (apply) {
        var aId = apply.getAttribute("data-apply");
        var aOpp = allOpps.find(function (o) { return o.id === aId; });
        if (!aOpp) return;
        var prompt2 = encodeURIComponent("Je veux saisir cette opportunité : " + aOpp.title + " — aide-moi à préparer ma candidature (organisation, mes atouts, plan d'attaque).");
        window.location.href = "assistant.html?prompt=" + prompt2;
        return;
      }
    });

    // Watchlist (délégation) — synchronisée avec l'API (jamais localStorage)
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-watch]");
      if (!btn) return;
      var id = btn.getAttribute("data-watch");
      var realId = id.slice("opp-api-".length);
      var idx = watchlist.indexOf(id);
      var wasSaved = idx === -1;
      var api = window.IntelliAPI && window.IntelliAPI.getToken()
        ? (wasSaved ? window.IntelliAPI.saveOpportunity(realId) : window.IntelliAPI.unsaveOpportunity(realId))
        : Promise.resolve();
      api.then(function () {
        if (wasSaved) {
          watchlist.push(id);
          if (window.IntelliApp) window.IntelliApp.showToast("Ajouté à votre watchlist ⭐");
        } else {
          watchlist.splice(idx, 1);
          if (window.IntelliApp) window.IntelliApp.showToast("Retiré de votre watchlist.");
        }
        updateWatchCount();
        renderCards();
      }).catch(function (err) {
        if (window.IntelliApp) window.IntelliApp.showToast("Action impossible : " + ((err && err.message) || "erreur serveur"), "error");
      });
    });

    // Filtres modale
    document.querySelectorAll("#filter-type .filter-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        chip.classList.toggle("is-selected");
      });
    });

    $("#filters-reset").addEventListener("click", function () {
      document.querySelectorAll(".filter-chip.is-selected").forEach(function (c) { c.classList.remove("is-selected"); });
      $("#filter-risk").value = "";
      renderCards();
      if (window.IntelliApp) window.IntelliApp.closeModal(document.getElementById("filters-modal"));
    });

    // Appliquer (fermer la modale et re-rendre)
    document.querySelectorAll("#filters-modal [data-modal-close]").forEach(function (b) {
      b.addEventListener("click", renderCards);
    });


  });
})();
