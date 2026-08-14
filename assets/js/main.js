/* ============================================================
   IntelliTamed — Script principal partagé
   - Injection des composants (sidebar/topbar/footer)
   - Sidebar mobile, menu utilisateur
   - Toasts, modales
   - Rendu auto des graphiques [data-chart]
   - Store localStorage (données de démo persistantes)
   ============================================================ */

(function (global) {
  "use strict";

  var I = global.IntelliTamed;

  document.addEventListener("DOMContentLoaded", function () {
    // 1. Injection des composants partagés
    if (I) I.injectAll();

    // 2. Sidebar mobile
    var sidebar = document.getElementById("sidebar");
    function closeSidebar() {
      if (!sidebar) return;
      sidebar.classList.remove("is-open");
      var ov = document.querySelector(".sidebar-overlay");
      if (ov) ov.hidden = true;
      document.body.style.overflow = "";
    }
    function openSidebar() {
      if (!sidebar) return;
      sidebar.classList.add("is-open");
      var ov = document.querySelector(".sidebar-overlay");
      if (ov) ov.hidden = false;
      document.body.style.overflow = "hidden";
    }
    document.addEventListener("click", function (e) {
      if (e.target.closest("[data-open-sidebar]")) openSidebar();
      if (e.target.closest("[data-close-sidebar]")) closeSidebar();
    });

    // 3. Menu utilisateur
    document.querySelectorAll("[data-user-menu]").forEach(function (menu) {
      var trigger = menu.querySelector(".user-menu-trigger");
      var dropdown = menu.querySelector(".user-menu-dropdown");
      if (!trigger || !dropdown) return;
      trigger.addEventListener("click", function (e) {
        e.stopPropagation();
        var isOpen = !dropdown.hidden;
        dropdown.hidden = isOpen;
        trigger.setAttribute("aria-expanded", String(!isOpen));
      });
      document.addEventListener("click", function (e) {
        if (!menu.contains(e.target)) {
          dropdown.hidden = true;
          trigger.setAttribute("aria-expanded", "false");
        }
      });
    });

    // 4. Toasts
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-toast]");
      if (t) {
        e.preventDefault();
        var msg = t.getAttribute("data-toast");
        var type = t.getAttribute("data-toast-type") || "info";
        showToast(msg, type);
      }
    });

    // 5. Modales [data-modal-open="/#id"] et [data-modal-close]
    document.addEventListener("click", function (e) {
      var opener = e.target.closest("[data-modal-open]");
      if (opener) {
        e.preventDefault();
        var sel = opener.getAttribute("data-modal-open");
        openModal(sel);
        return;
      }
      var closer = e.target.closest("[data-modal-close]");
      if (closer) {
        closeModal(closer.closest(".modal-overlay"));
        return;
      }
      if (e.target.classList && e.target.classList.contains("modal-overlay")) {
        closeModal(e.target);
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay.open").forEach(closeModal);
      }
    });

    // 6. Graphiques auto [data-chart]
    document.querySelectorAll("[data-chart]").forEach(function (el) {
      try {
        var cfg = JSON.parse(el.getAttribute("data-chart") || "{}");
        renderChart(el, cfg);
      } catch (err) {
        console.error("Chart config invalide", err);
      }
    });

    // 7. Navigation "Objectifs" (page non livrée)
    document.querySelectorAll("[data-nav='objectives']").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        showToast("Objectifs — bientôt disponible dans votre espace.", "info");
      });
    });

    // 8. Recherche topbar (démo)
    document.querySelectorAll(".topbar-search input").forEach(function (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          showToast("Recherche « " + input.value + " » — démonstration frontend.", "info");
          input.value = "";
          input.blur();
        }
      });
    });
  });

  /* ---------- Toasts ---------- */
  function showToast(msg, type) {
    type = type || "info";
    var container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    var icons = {
      success: I ? I.icon("check") : "",
      error: I ? I.icon("alert") : "",
      info: I ? I.icon("sparkles") : ""
    };
    var toast = document.createElement("div");
    toast.className = "toast toast-" + type;
    toast.innerHTML = '<span class="toast-icon">' + (icons[type] || icons.info) + "</span><span>" +
      I.esc(msg) + "</span>";
    container.appendChild(toast);
    setTimeout(function () {
      toast.classList.add("is-leaving");
      setTimeout(function () { toast.remove(); }, 250);
    }, 3200);
  }

  /* ---------- Modales ---------- */
  function openModal(sel) {
    var overlay = document.querySelector(sel);
    if (!overlay) return;
    overlay.hidden = false;
    requestAnimationFrame(function () { overlay.classList.add("open"); });
    document.body.style.overflow = "hidden";
  }
  function closeModal(overlay) {
    if (!overlay) return;
    overlay.classList.remove("open");
    setTimeout(function () { overlay.hidden = true; }, 200);
    document.body.style.overflow = "";
  }

  /* ---------- Graphiques ---------- */
  function renderChart(el, cfg) {
    var C = global.IntelliCharts;
    if (!C) return;
    switch (cfg.type) {
      case "line": C.line(el, cfg); break;
      case "bars": C.bars(el, cfg); break;
      case "donut": C.donut(el, cfg); break;
      case "ring": C.ring(el, cfg.percent, cfg); break;
      default: C.line(el, cfg);
    }
  }

  /* ---------- Store (démo, localStorage) ---------- */
  var STORE_KEY = "intellitamed_store_v1";

  var DEFAULTS = {
    profile: {
      firstName: "Jean",
      lastName: "Dupont",
      email: "jean.dupont@intellitamed.io",
      role: "Entrepreneur Tech",
      bio: "Passionné par l'IA et le développement de solutions innovantes pour les entrepreneurs de demain.",
      website: "https://votre-site.com",
      linkedin: "linkedin.com/in/votre-nom",
      avatar: null
    },
    projects: [
      { id: "PRJ-001", name: "Expansion Marché IA Europe", category: "Stratégie", status: "in-progress", priority: "high", progress: 65, team: "4", due: "15 oct 2024" },
      { id: "PRJ-002", name: "Optimisation Supply Chain", category: "Opérations", status: "planned", priority: "medium", progress: 45, team: "6", due: "02 nov 2024" },
      { id: "PRJ-003", name: "Plateforme E-commerce V2", category: "Technologie", status: "late", priority: "high", progress: 40, team: "8", due: "28 sept 2024" },
      { id: "PRJ-004", name: "Refonte Identité Visuelle", category: "Marketing", status: "done", priority: "low", progress: 100, team: "2", due: "10 sept 2024" },
      { id: "PRJ-005", name: "Analyse Prédictive Client", category: "IA / Data", status: "in-progress", priority: "medium", progress: 30, team: "5", due: "20 oct 2024" }
    ],
    tasks: {
      "phase-1": [
        { id: "t1", title: "Analyse comparative des concurrents", desc: "Identifier les 5 principaux concurrents directs et analyser leur proposition de valeur unique (USP).", category: "Stratégique", priority: "high", time: "4h", done: true },
        { id: "t2", title: "Définition du Persona Entrepreneurial", desc: "Créer 3 profils types d'utilisateurs pour la plateforme IntelliTamed.", category: "Opérationnel", priority: "medium", time: "2h", done: true },
        { id: "t3", title: "Vérification de la conformité RGPD", desc: "Audit initial des flux de données pour le traitement des données utilisateurs par l'IA.", category: "Juridique", priority: "high", time: "6h", done: true },
        { id: "t4", title: "Enquête clients — 10 entretiens", desc: "Réaliser 10 entretiens clients pour confirmer le problème et la proposition de valeur.", category: "Opérationnel", priority: "high", time: "8h", done: false }
      ],
      "phase-2": [
        { id: "t5", title: "Sélection de la pile LLM", desc: "Comparer GPT-4, Claude 3 et des modèles open-source locaux pour le moteur d'analyse.", category: "Technique", priority: "high", time: "8h", done: false },
        { id: "t6", title: "Maquettage de l'interface Dashboard", desc: "Concevoir les widgets de visualisation de données pour les entrepreneurs.", category: "Technique", priority: "medium", time: "12h", done: true },
        { id: "t7", title: "Environnement de développement", desc: "Mettre en place le repository, la CI/CD et les environnements de staging.", category: "Technique", priority: "low", time: "4h", done: false }
      ],
      "phase-3": [
        { id: "t8", title: "Développement du MVP", desc: "Développer les fonctionnalités cœur du produit avec les spécifications validées.", category: "Technique", priority: "high", time: "40h", done: false },
        { id: "t9", title: "Tests utilisateurs bêta", desc: "Lancer le programme bêta avec 30 utilisateurs et collecter les retours.", category: "Opérationnel", priority: "medium", time: "10h", done: false }
      ],
      "phase-4": [
        { id: "t10", title: "Campagne de lancement", desc: "Préparer et lancer la campagne marketing multi-canaux.", category: "Marketing", priority: "high", time: "6h", done: false },
        { id: "t11", title: "Préparation du pitch investisseurs", desc: "Construire le pitch deck et répéter la présentation investisseurs.", category: "Stratégique", priority: "high", time: "8h", done: false },
        { id: "t12", title: "Analyse post-lancement", desc: "Mesurer les premiers KPIs et itérer sur le produit.", category: "Data", priority: "medium", time: "4h", done: false }
      ]
    },
    conversations: [],
    watchlist: [],
    onboarding: null
  };

  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
      var data = JSON.parse(raw);
      // fusion avec les défauts
      Object.keys(DEFAULTS).forEach(function (k) {
        if (data[k] === undefined) data[k] = JSON.parse(JSON.stringify(DEFAULTS[k]));
      });
      return data;
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  function saveStore(store) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* stockage indisponible */ }
  }

  function resetStore() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  global.IntelliApp = {
    showToast: showToast,
    openModal: openModal,
    closeModal: closeModal,
    loadStore: loadStore,
    saveStore: saveStore,
    resetStore: resetStore
  };
})(window);
