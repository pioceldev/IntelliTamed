/* ============================================================
   IntelliTamed — Assistant IA
   Chat fonctionnel branché sur l'API Django (backend/) qui relaie
   vers l'API Gemini (clé côté serveur, jamais dans le frontend).
   - POST /api/assistant (conversation persistée + contexte)
   - GET  /api/health   (état de la connexion)
   Aucune réponse simulée : en cas de backend injoignable, un
   message d'erreur clair est affiché.
   ============================================================ */

(function () {
  "use strict";

  var STORE_KEY = "intellitamed_assistant_v1";

  /* ============================================================
     Aucune réponse simulée : les réponses viennent UNIQUEMENT du
     backend (API Django → Gemini). Si le backend est injoignable,
     un message d'erreur clair est affiché à l'utilisateur.
     ============================================================ */

  /* ---------- État ---------- */
  var currentConversation = "new";
  var conversations = loadConversations();

  function loadConversations() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        // L'historique ne contient que les conversations réelles de l'utilisateur
        Object.keys(data).forEach(function (k) {
          if (!data[k] || !data[k].messages || data[k].messages.length === 0) delete data[k];
        });
        return data;
      }
    } catch (e) { /* noop */ }
    return {};
  }

  function saveConversations() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(conversations)); } catch (e) { /* noop */ }
  }

  /* ---------- DOM ---------- */
  var messagesEl = document.getElementById("chat-messages");
  var suggestionsEl = document.getElementById("chat-suggestions");
  var form = document.getElementById("chat-form");
  var input = document.getElementById("chat-input");
  var chatTitle = document.getElementById("chat-title");
  var sendBtn = form ? form.querySelector(".chat-send-btn") : null;
  var historyList = document.getElementById("history-list");

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function markdownLight(text) {
    // Convertit **gras** et les listes simples en HTML
    var out = esc(text);
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    out = out.replace(/(?:^|\n)• /g, "\n<span class='msg-bullet'>•</span> ");
    out = out.replace(/(?:^|\n)(\d+)\. /g, "\n<span class='msg-bullet'>$1.</span> ");
    return out.replace(/\n/g, "<br>");
  }

  function nowTime() {
    var d = new Date();
    return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  }

  function renderMessages(list) {
    messagesEl.innerHTML = "";
    list.forEach(function (m) {
      messagesEl.appendChild(buildMessageEl(m));
    });
    scrollBottom();
  }

  function buildMessageEl(m) {
    var wrap = document.createElement("div");
    var isUser = m.role === "user";
    wrap.className = "msg " + (isUser ? "msg-user" : "msg-ai") + (m.error ? " msg-error" : "");

    var avatar = document.createElement("span");
    avatar.className = "msg-avatar";
    avatar.innerHTML = isUser
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>';

    var body = document.createElement("div");
    body.className = "msg-body";

    var bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.innerHTML = markdownLight(m.text);

    var time = document.createElement("span");
    time.className = "msg-time";
    time.textContent = m.time || nowTime();

    body.appendChild(bubble);
    body.appendChild(time);

    if (m.error) {
      var retry = document.createElement("button");
      retry.type = "button";
      retry.className = "msg-retry";
      retry.textContent = "↻ Réessayer";
      retry.addEventListener("click", function () {
        // relance avec le dernier message utilisateur
        var lastUser = null;
        for (var i = messagesEl.querySelectorAll(".msg").length - 1; i >= 0; i--) { /* noop */ }
        if (conversations[currentConversation] && conversations[currentConversation].messages) {
          var msgs = conversations[currentConversation].messages;
          for (var j = msgs.length - 1; j >= 0; j--) {
            if (msgs[j].role === "user") { lastUser = msgs[j]; break; }
          }
        }
        if (lastUser) sendMessage(lastUser.text);
      });
      body.appendChild(retry);
    }

    wrap.appendChild(avatar);
    wrap.appendChild(body);
    return wrap;
  }

  function showTyping() {
    var wrap = document.createElement("div");
    wrap.className = "msg msg-ai";
    wrap.id = "typing-indicator";
    wrap.innerHTML =
      '<span class="msg-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg></span>' +
      '<div class="msg-body"><div class="msg-bubble"><span class="typing-dots"><span></span><span></span><span></span></span></div></div>';
    messagesEl.appendChild(wrap);
    scrollBottom();
  }

  function hideTyping() {
    var t = document.getElementById("typing-indicator");
    if (t) t.remove();
  }

  function scrollBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setBusy(busy) {
    if (sendBtn) sendBtn.disabled = busy;
    if (input) input.disabled = busy;
  }

  /* ---------- Envoi ---------- */
  function sendMessage(text) {
    text = text.trim();
    if (!text) return;

    if (!conversations[currentConversation]) {
      conversations[currentConversation] = { title: "", date: "Aujourd'hui", messages: [] };
    }
    var conv = conversations[currentConversation];
    if (!conv.messages) conv.messages = [];
    if (conv.messages.length === 0) {
      conv.title = text.length > 34 ? text.slice(0, 34) + "…" : text;
    }
    conv.messages.push({ role: "user", text: text, time: nowTime() });

    hideSuggestions();
    renderMessages(conv.messages);
    updateHistory();

    setBusy(true);
    showTyping();

    // Historique envoyé au backend (sans les messages d'erreur)
    var history = conv.messages
      .filter(function (m) { return !m.error; })
      .map(function (m) { return { role: m.role, text: m.text }; });

    callGemini(text, history)
      .then(function (reply) {
        hideTyping();
        conv.messages.push({ role: "ai", text: reply, time: nowTime() });
        saveConversations();
        renderMessages(conv.messages);
        setBusy(false);
        checkGeminiStatus();
      })
      .catch(function (err) {
        // Backend injoignable ou erreur → message d'erreur clair (pas de réponse simulée)
        var msg = "Le service IA est momentanément indisponible. Vérifiez que le serveur est démarré " +
          "(cd backend && python manage.py runserver) et que la clé Gemini est configurée dans backend/.env.";
        if (err && err.message && err.message.indexOf("indisponible") === -1) {
          msg = "⚠️ " + (err.message || msg);
        }
        setTimeout(function () {
          hideTyping();
          conv.messages.push({ role: "ai", text: msg, time: nowTime(), error: true });
          saveConversations();
          renderMessages(conv.messages);
          setBusy(false);
          checkGeminiStatus();
        }, 400);
      });
  }

  /* ---------- Appel backend Gemini ----------
     Priorité : API Django (si token JWT présent) — la conversation est
     persistée côté serveur (conversation_id).
     Repli : proxy Node server/server.js (sans auth).
     Dernier recours (catch dans sendMessage) : réponses simulées. */
  function callGemini(text, history) {
    var conv = conversations[currentConversation];

    // 1. Backend Django : token JWT disponible
    if (window.IntelliAPI && window.IntelliAPI.getToken()) {
      return window.IntelliAPI.sendMessage(text, conv ? conv.serverId : null, conv ? conv.title : null)
        .then(function (data) {
          if (!data || !data.reply) {
            throw new Error("Gemini n'a pas renvoyé de réponse.");
          }
          // On mémorise l'id serveur de la conversation pour garder le contexte
          if (conv && data.conversation_id && conv.serverId !== data.conversation_id) {
            conv.serverId = data.conversation_id;
            saveConversations();
          }
          return data.reply;
        });
    }

    // 2. Proxy Node (sans auth) : historique envoyé tel quel
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 30000) : null;

    return fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller ? controller.signal : undefined,
      body: JSON.stringify({ message: text, history: history || [] })
    })
      .then(function (res) {
        return res.json().catch(function () {
          throw new Error("Réponse serveur invalide (" + res.status + ")");
        }).then(function (data) {
          if (!res.ok) {
            throw new Error((data && data.error) || "Erreur serveur (" + res.status + ")");
          }
          if (!data || !data.reply) {
            throw new Error("Gemini n'a pas renvoyé de réponse.");
          }
          return data.reply;
        });
      })
      .finally(function () {
        if (timer) clearTimeout(timer);
      });
  }

  /* ---------- État de la connexion Gemini ---------- */
  function checkGeminiStatus() {
    var el = document.getElementById("ai-status");
    if (!el) return;

    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 15000) : null;

    fetch("/api/health", { signal: controller ? controller.signal : undefined })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (timer) clearTimeout(timer);
        if (data && data.gemini === "configured") {
          el.textContent = "Gemini connecté";
          el.classList.remove("demo");
          el.title = "Réponses générées par " + (data.model || "Gemini");
        } else {
          el.textContent = "Mode démo";
          el.classList.add("demo");
          el.title = "Réponses simulées — ajoutez GEMINI_API_KEY dans backend/.env ou server/.env";
        }
      })
      .catch(function () {
        if (timer) clearTimeout(timer);
        el.textContent = "Mode démo";
        el.classList.add("demo");
        el.title = "Backend injoignable — réponses simulées";
      });
  }

  function hideSuggestions() {
    if (suggestionsEl) suggestionsEl.style.display = "none";
  }

  function showSuggestions() {
    if (suggestionsEl) suggestionsEl.style.display = "";
  }

  /* ---------- Historique ---------- */
  function updateHistory() {
    if (!historyList) return;
    historyList.innerHTML = "";
    Object.keys(conversations).forEach(function (id) {
      var conv = conversations[id];
      if (!conv || !conv.messages || conv.messages.length === 0) return;
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "history-item" + (id === currentConversation ? " is-active" : "");
      btn.setAttribute("data-conversation", id);

      var first = conv.messages[0];
      var preview = first ? first.text : "";
      btn.innerHTML =
        "<strong>" + esc(conv.title || "Conversation") + "</strong>" +
        "<span>" + esc(preview.length > 40 ? preview.slice(0, 40) + "…" : preview) + "</span>" +
        "<small>" + esc(conv.date || "") + "</small>";

      btn.addEventListener("click", function () {
        if (id === currentConversation) return;
        currentConversation = id;
        if (!conv.messages) conv.messages = [];
        chatTitle.textContent = conv.title || "Conversation";
        if (conv.messages.length === 0) showSuggestions();
        else hideSuggestions();
        renderMessages(conv.messages);
        updateHistory();
      });
      li.appendChild(btn);
      historyList.appendChild(li);
    });

    var count = document.getElementById("history-count");
    if (count) count.textContent = String(historyList.children.length);
  }

  /* ---------- Nouvelle discussion ---------- */
  function newConversation() {
    currentConversation = "new";
    conversations[currentConversation] = { title: "", date: "Aujourd'hui", messages: [] };
    saveConversations();
    chatTitle.textContent = "Nouvelle discussion";
    showSuggestions();
    renderMessages([]);
    updateHistory();
    input.focus();
  }

  /* ---------- Événements ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var text = input.value;
        input.value = "";
        autoResize();
        sendMessage(text);
      });
    }

    if (input) {
      input.addEventListener("input", autoResize);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          form.dispatchEvent(new Event("submit", { cancelable: true }));
        }
      });
    }

    // Suggestions
    document.querySelectorAll("[data-prompt]").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var p = chip.getAttribute("data-prompt");
        if (input) input.value = p;
        autoResize();
        form.dispatchEvent(new Event("submit", { cancelable: true }));
      });
    });

    var newBtn = document.getElementById("new-chat-btn");
    if (newBtn) newBtn.addEventListener("click", newConversation);

    // Initialisation
    if (currentConversation === "new") {
      var stored = conversations["new"];
      if (stored && stored.messages && stored.messages.length > 0) {
        hideSuggestions();
        renderMessages(stored.messages);
        chatTitle.textContent = stored.title || "Nouvelle discussion";
      }
    }
    updateHistory();
    checkGeminiStatus();
  });

  function autoResize() {
    if (!input) return;
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  }

})();
