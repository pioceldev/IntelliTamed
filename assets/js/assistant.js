/* ============================================================
   IntelliTamed — Assistant IA
   Chat 100% connecté au backend Django (backend/) qui relaie
   vers l'API Gemini (clé côté serveur, jamais dans le frontend).
   - POST /api/assistant          (message → réponse Gemini)
   - GET  /api/conversations/     (historique serveur)
   - GET  /api/conversations/{id} (messages d'une conversation)
   - DELETE /api/conversations/{id}
   Aucune réponse simulée, aucun localStorage :
   sans connexion → redirection login.
   ============================================================ */

(function () {
  "use strict";

  /* ---------- État (mémoire seulement, rien en localStorage) ---------- */
  var currentConversation = "new";          // clé locale : "new" ou "srv-{id}"
  var conversations = {};                   // { "new": {...}, "srv-3": {...} }
  var serverLoaded = false;

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
    (list || []).forEach(function (m) {
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
        var conv = conversations[currentConversation];
        var lastUser = null;
        if (conv && conv.messages) {
          for (var j = conv.messages.length - 1; j >= 0; j--) {
            if (conv.messages[j].role === "user") { lastUser = conv.messages[j]; break; }
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

  function hideSuggestions() {
    if (suggestionsEl) suggestionsEl.style.display = "none";
  }
  function showSuggestions() {
    if (suggestionsEl) suggestionsEl.style.display = "";
  }

  /* ---------- Envoi (100% API Django → Gemini) ---------- */
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

    window.IntelliAPI.sendMessage(text, conv.serverId || null, conv.title || null)
      .then(function (data) {
        hideTyping();
        if (!data || !data.reply) {
          throw new Error("Gemini n'a pas renvoyé de réponse.");
        }
        // La conversation locale « new » devient une conversation serveur :
        // on supprime la clé locale pour éviter le doublon dans l'historique.
        if (data.conversation_id) {
          var srvKey = "srv-" + data.conversation_id;
          var localKey = currentConversation;
          if (localKey !== srvKey && conversations[localKey] === conv) {
            delete conversations[localKey];
          }
          conv.serverId = data.conversation_id;
          currentConversation = srvKey;
        }
        conv.messages.push({ role: "ai", text: data.reply, time: nowTime() });
        renderMessages(conv.messages);
        setBusy(false);
        if (chatTitle && conv.title) chatTitle.textContent = conv.title;
        // Recharge l'historique serveur pour rester synchronisé (titre, dates, messages)
        loadServerConversations().then(function () {
          if (data.conversation_id) {
            // La version serveur fait foi : on reprend la conversation fraîchement chargée
            var fresh = conversations["srv-" + data.conversation_id];
            if (fresh) {
              currentConversation = "srv-" + data.conversation_id;
              renderMessages(fresh.messages || []);
              if (chatTitle) chatTitle.textContent = fresh.title || conv.title || "Conversation";
            }
            updateHistory();
          }
        });
        checkGeminiStatus();
      })
      .catch(function (err) {
        hideTyping();
        var msg = "Le service IA est momentanément indisponible. Vérifiez que le serveur est démarré " +
          "(cd backend && python manage.py runserver) et que la clé Gemini est configurée dans backend/.env.";
        if (err && err.message && err.message.indexOf("indisponible") === -1) {
          msg = "⚠️ " + (err.message || msg);
        }
        conv.messages.push({ role: "ai", text: msg, time: nowTime(), error: true });
        renderMessages(conv.messages);
        setBusy(false);
        checkGeminiStatus();
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
          el.textContent = "Gemini non configuré";
          el.classList.add("demo");
          el.title = "Ajoutez GEMINI_API_KEY dans backend/.env";
        }
      })
      .catch(function () {
        if (timer) clearTimeout(timer);
        el.textContent = "Backend injoignable";
        el.classList.add("demo");
        el.title = "Démarrez le backend : cd backend && python manage.py runserver";
      });
  }

  /* ---------- Historique serveur (seule source de vérité) ---------- */
  function loadServerConversations() {
    if (!window.IntelliAPI || !window.IntelliAPI.getToken()) return Promise.resolve();
    return window.IntelliAPI.listConversations().then(function (data) {
      var list = (data && data.results) || [];
      var pending = list.map(function (conv) {
        return window.IntelliAPI.getConversation(conv.id).then(function (detail) {
          if (!detail || !detail.messages || !detail.messages.length) return;
          var key = "srv-" + conv.id;
          var sortDate = (conv.updated_at || conv.created_at || "").replace("T", " ").slice(0, 16);
          conversations[key] = {
            serverId: conv.id,
            title: conv.title || "Conversation",
            date: (conv.updated_at || conv.created_at || "").slice(0, 10),
            sortDate: sortDate,
            messages: detail.messages.map(function (m) {
              return {
                role: m.role === "model" ? "ai" : "user",
                text: m.content || "",
                time: (m.created_at || "").slice(11, 16)
              };
            })
          };
        });
      });
      return Promise.all(pending).then(function () {
        serverLoaded = true;
        updateHistory();
      });
    }).catch(function () { /* backend injoignable */ });
  }

  /* ---------- Historique (rendu, trié du plus récent au plus ancien) ---------- */
  function sortConversations() {
    return Object.keys(conversations).filter(function (id) {
      var c = conversations[id];
      return c && c.messages && c.messages.length > 0;
    }).sort(function (a, b) {
      var ca = conversations[a];
      var cb = conversations[b];
      var ta = ca.sortDate || ca.date || "";
      var tb = cb.sortDate || cb.date || "";
      return tb.localeCompare(ta);
    });
  }

  function updateHistory() {
    if (!historyList) return;
    historyList.innerHTML = "";
    sortConversations().forEach(function (id) {
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

      var del = document.createElement("button");
      del.type = "button";
      del.className = "history-del";
      del.setAttribute("data-del-conv", id);
      del.setAttribute("aria-label", "Supprimer la conversation");
      del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      li.appendChild(del);
      historyList.appendChild(li);
    });

    var count = document.getElementById("history-count");
    if (count) count.textContent = String(historyList.children.length);
  }

  /* ---------- Suppression de conversation (serveur + mémoire) ---------- */
  function deleteConversation(id) {
    var conv = conversations[id];
    if (!conv) return;
    var remove = function () {
      delete conversations[id];
      if (currentConversation === id) newConversation(true);
      else updateHistory();
      if (window.IntelliApp) window.IntelliApp.showToast("Conversation supprimée.");
    };
    if (conv.serverId && window.IntelliAPI && window.IntelliAPI.getToken()) {
      window.IntelliAPI.deleteConversation(conv.serverId)
        .then(remove)
        .catch(function () { remove(); });
    } else {
      remove();
    }
  }

  /* ---------- Menu options de conversation ---------- */
  function initChatOptions() {
    var btn = document.getElementById("chat-options-btn");
    var menu = document.getElementById("chat-options-menu");
    if (!btn || !menu) return;

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("click", function () { menu.hidden = true; });

    var optNew = document.getElementById("opt-new-chat");
    if (optNew) optNew.addEventListener("click", function () { newConversation(); });

    var optDel = document.getElementById("opt-delete-chat");
    if (optDel) optDel.addEventListener("click", function () {
      var id = currentConversation;
      var conv = conversations[id];
      if (conv && conv.messages && conv.messages.length > 0) {
        if (confirm("Supprimer cette conversation ?")) deleteConversation(id);
      } else {
        if (window.IntelliApp) window.IntelliApp.showToast("Cette conversation est vide.", "info");
      }
    });
  }

  /* ---------- Nouvelle discussion ---------- */
  function newConversation(skipFocus) {
    currentConversation = "new";
    conversations["new"] = { title: "", date: "Aujourd'hui", messages: [] };
    chatTitle.textContent = "Nouvelle discussion";
    showSuggestions();
    renderMessages([]);
    updateHistory();
    if (input && !skipFocus) input.focus();
  }

  /* ---------- Événements ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    // Garde : pas connecté → redirection login
    if (!window.IntelliAPI || !window.IntelliAPI.getToken()) {
      window.location.href = "login.html";
      return;
    }

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

    if (historyList) {
      historyList.addEventListener("click", function (e) {
        var del = e.target.closest(".history-del");
        if (!del) return;
        e.stopPropagation();
        deleteConversation(del.getAttribute("data-del-conv"));
      });
    }

    // Initialisation : nouvelle discussion + historique serveur
    newConversation(true);
    updateHistory();
    checkGeminiStatus();
    loadServerConversations();
    initChatOptions();

    // Prompt pré-rempli depuis une autre page (ex: opportunités → assistant)
    var urlPrompt = new URLSearchParams(window.location.search).get("prompt");
    if (urlPrompt && input) {
      input.value = urlPrompt;
      autoResize();
      setTimeout(function () { form.dispatchEvent(new Event("submit", { cancelable: true })); }, 400);
    }
  });

  function autoResize() {
    if (!input) return;
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  }

})();
