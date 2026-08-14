/* ============================================================
   IntelliTamed — Pont API frontend ↔ backend Django
   - Gestion du token JWT (localStorage, jamais de clé API ici)
   - Helpers fetch (GET/POST/PUT/DELETE + Bearer)
   - Auth : register, login, logout, me, onboarding
   - Assistant : envoi message (conversation persistée)
   - Projets : CRUD + analyse Gemini
   - Repli automatique : si le backend est injoignable, retourne
     null et laisse les pages fonctionner en mode démo (store).
   ============================================================ */
(function (global) {
  "use strict";

  var TOKEN_KEY = "intellitamed_jwt";
  var USER_KEY = "intellitamed_user";

  var API = {
    /* ---------- Token ---------- */
    getToken: function () {
      try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
    },
    setToken: function (token) {
      try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
      } catch (e) { /* stockage indisponible */ }
    },
    getUser: function () {
      try {
        var raw = localStorage.getItem(USER_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    setUser: function (user) {
      try {
        if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
        else localStorage.removeItem(USER_KEY);
      } catch (e) { /* stockage indisponible */ }
    },
    isAuthenticated: function () {
      return !!this.getToken();
    },
    logout: function () {
      this.setToken(null);
      this.setUser(null);
    },

    /* ---------- Helpers fetch ---------- */
    request: function (path, options) {
      options = options || {};
      var headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
      var token = this.getToken();
      if (token) headers["Authorization"] = "Bearer " + token;

      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, options.timeout || 20000);

      return fetch("/api/" + path.replace(/^\//, ""), {
        method: options.method || "GET",
        headers: headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      }).then(function (resp) {
        clearTimeout(timeout);
        if (resp.status === 401 && this.getToken()) {
          // Token expiré : on déconnecte proprement
          this.logout();
        }
        return resp.json().then(function (data) {
          if (!resp.ok) {
            var err = new Error((data && data.detail) || (data && data.error) || "Erreur " + resp.status);
            err.status = resp.status;
            err.data = data;
            throw err;
          }
          return data;
        });
      }.bind(this)).catch(function (err) {
        clearTimeout(timeout);
        if (err.name === "AbortError") err.message = "Le serveur met trop de temps à répondre.";
        throw err;
      });
    },
    // Version « douce » : retourne null au lieu de lever une erreur
    safeRequest: function (path, options) {
      return this.request(path, options).catch(function () { return null; });
    },

    /* ---------- Auth ---------- */
    register: function (payload) {
      return this.request("auth/register", { method: "POST", body: payload, timeout: 15000 });
    },
    login: function (email, password) {
      return this.request("auth/login", {
        method: "POST",
        body: { email: email, password: password },
        timeout: 15000
      }).then(function (data) {
        this.setToken(data.access);
        return data;
      }.bind(this));
    },
    me: function () {
      return this.request("auth/me");
    },
    fetchProfile: function () {
      return this.safeRequest("auth/profile");
    },
    saveProfile: function (profile) {
      return this.request("auth/profile", { method: "PUT", body: profile });
    },
    saveOnboarding: function (payload) {
      return this.request("auth/onboarding", { method: "POST", body: payload });
    },
    requestPasswordReset: function (email) {
      return this.request("auth/password-reset", { method: "POST", body: { email: email } });
    },
    confirmPasswordReset: function (payload) {
      return this.request("auth/password-reset/confirm", { method: "POST", body: payload });
    },

    /* ---------- Assistant ---------- */
    sendMessage: function (message, conversationId, title) {
      return this.request("assistant", {
        method: "POST",
        body: { message: message, conversation_id: conversationId || null, title: title || null },
        timeout: 90000
      });
    },
    listConversations: function () {
      return this.safeRequest("conversations/");
    },
    getConversation: function (id) {
      return this.safeRequest("conversations/" + id + "/");
    },
    deleteConversation: function (id) {
      return this.request("conversations/" + id + "/", { method: "DELETE" });
    },

    /* ---------- Projets ---------- */
    listProjects: function (params) {
      var qs = params ? "?" + new URLSearchParams(params).toString() : "";
      return this.safeRequest("projects/" + qs);
    },
    createProject: function (payload) {
      return this.request("projects/", { method: "POST", body: payload });
    },
    getProject: function (id) {
      return this.safeRequest("projects/" + id + "/");
    },
    updateProject: function (id, payload) {
      return this.request("projects/" + id + "/", { method: "PUT", body: payload });
    },
    deleteProject: function (id) {
      return this.request("projects/" + id + "/", { method: "DELETE" });
    },
    analyzeProject: function (id) {
      return this.request("projects/" + id + "/analyze/", { method: "POST", timeout: 120000 });
    },

    /* ---------- Opportunités / watchlist ---------- */
    listOpportunities: function (params) {
      var qs = params ? "?" + new URLSearchParams(params).toString() : "";
      return this.safeRequest("opportunities/" + qs);
    },
    saveOpportunity: function (id) {
      return this.request("opportunities/" + id + "/save/", { method: "POST" });
    },
    unsaveOpportunity: function (id) {
      return this.request("opportunities/" + id + "/save/", { method: "DELETE" });
    },
    listWatchlist: function () {
      return this.safeRequest("watchlist/");
    },

    /* ---------- Plans d'action ---------- */
    listActionPlans: function () {
      return this.safeRequest("action-plans/");
    },
    getActionPlan: function (id) {
      return this.safeRequest("action-plans/" + id + "/");
    },
    generateActionPlan: function (projectId) {
      return this.request("action-plans/generate/", {
        method: "POST",
        body: { project_id: projectId },
        timeout: 120000
      });
    },
    addActionStep: function (planId, step) {
      return this.request("action-plans/" + planId + "/steps/", { method: "POST", body: step });
    },
    updateActionStep: function (id, step) {
      return this.request("action-steps/" + id + "/", { method: "PATCH", body: step });
    },
    deleteActionStep: function (id) {
      return this.request("action-steps/" + id + "/", { method: "DELETE" });
    },

    /* ---------- Notifications ---------- */
    listNotifications: function () {
      return this.safeRequest("notifications/");
    },
    markNotificationRead: function (id) {
      return this.request("notifications/" + id + "/read/", { method: "POST" });
    },
    markAllNotificationsRead: function () {
      return this.request("notifications/read_all/", { method: "POST" });
    },
    unreadNotificationsCount: function () {
      return this.safeRequest("notifications/unread_count/");
    },

    /* ---------- Administration ---------- */
    adminStats: function () {
      return this.safeRequest("auth/admin/stats");
    },
    adminUsers: function () {
      return this.safeRequest("auth/admin/users");
    },
    adminProjects: function () {
      return this.safeRequest("auth/admin/projects");
    },
    adminCreateOpportunity: function (payload) {
      return this.request("auth/admin/opportunities", { method: "POST", body: payload });
    }
  };

  global.IntelliAPI = API;
})(window);
