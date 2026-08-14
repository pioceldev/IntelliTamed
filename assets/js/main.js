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

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

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

    // 2bis. Déconnexion (JWT) — clic sur [data-logout]
    document.addEventListener("click", function (e) {
      var logout = e.target.closest("[data-logout]");
      if (!logout) return;
      e.preventDefault();
      if (window.IntelliAPI) window.IntelliAPI.logout();
      window.location.href = "login.html";
    });

    // 2ter. Notifications (cloche topbar → API)
    initNotifications();

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
          showToast("Recherche « " + input.value + " ».", "info");
          input.value = "";
          input.blur();
        }
      });
    });
  });

  /* ---------- Notifications ---------- */
  function initNotifications() {
    var menu = document.querySelector("[data-notif-menu]");
    if (!menu) return;
    var trigger = menu.querySelector(".notif-trigger");
    var dropdown = menu.querySelector(".notif-dropdown");
    var list = menu.querySelector(".notif-list");
    var badge = menu.querySelector(".notif-badge");

    function render(items) {
      if (!list) return;
      var unread = (items || []).filter(function (n) { return !n.read; }).length;
      if (badge) {
        badge.hidden = unread === 0;
        badge.textContent = unread > 9 ? "9+" : String(unread);
      }
      if (!items || !items.length) {
        list.innerHTML = '<p class="notif-empty">Aucune notification.</p>';
        return;
      }
      list.innerHTML = (items || []).map(function (n) {
        return '<div class="notif-item' + (n.read ? " is-read" : "") + '" data-notif-id="' + n.id + '" role="button">' +
          '<span class="notif-dot"></span>' +
          '<div><strong>' + esc(n.title) + '</strong><p>' + esc(n.content || "") + '</p>' +
          '<small>' + esc((n.created_at || "").slice(0, 10)) + '</small></div>' +
        '</div>';
      }).join("");
    }

    function load() {
      if (!window.IntelliAPI || !window.IntelliAPI.getToken()) return;
      window.IntelliAPI.listNotifications().then(function (data) {
        render((data && data.results) || []);
      });
    }

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      var isOpen = !dropdown.hidden;
      dropdown.hidden = isOpen;
      trigger.setAttribute("aria-expanded", String(!isOpen));
      if (!isOpen) load();
    });
    document.addEventListener("click", function (e) {
      if (!menu.contains(e.target)) {
        dropdown.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
      }
    });

    // Marquer une notification comme lue
    list.addEventListener("click", function (e) {
      var item = e.target.closest("[data-notif-id]");
      if (!item) return;
      var id = item.getAttribute("data-notif-id");
      if (window.IntelliAPI) {
        window.IntelliAPI.markNotificationRead(id).then(function () {
          item.classList.add("is-read");
          load();
        }).catch(function () { /* noop */ });
      }
    });

    // Tout marquer lu
    var readAll = menu.querySelector(".notif-read-all");
    if (readAll) {
      readAll.addEventListener("click", function (e) {
        e.stopPropagation();
        if (window.IntelliAPI) {
          window.IntelliAPI.markAllNotificationsRead().then(function () { load(); });
        }
      });
    }

    load();
  }

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
    // I (IntelliTamed) peut être absent sur les pages auth (login/signup) → échappement minimal
    var safeMsg = (I && I.esc) ? I.esc(msg) : String(msg).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
    toast.innerHTML = '<span class="toast-icon">' + (icons[type] || icons.info) + "</span><span>" +
      safeMsg + "</span>";
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

  // Données initiales VIDE — plus aucune donnée statique/démo.
  // Les pages se remplissent via l'API (assets/js/api.js) ;
  // en l'absence de backend, elles affichent leurs états vides.
  var DEFAULTS = {
    profile: {
      firstName: "",
      lastName: "",
      email: "",
      role: "",
      bio: "",
      website: "",
      linkedin: "",
      avatar: null
    },
    projects: [],
    tasks: {},
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
