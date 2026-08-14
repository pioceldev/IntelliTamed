/* ============================================================
   IntelliTamed — Assistant IA
   Chat fonctionnel côté frontend, branché sur le backend
   server/server.js qui relaie vers l'API Gemini.
   - POST /api/assistant (proxy serveur, clé API côté backend)
   - GET  /api/health   (état de la connexion)
   En cas de backend injoignable → repli automatique sur des
   réponses simulées (« Mode démo ») pour que la démo reste
   utilisable hors-ligne.
   ============================================================ */

(function () {
  "use strict";

  var STORE_KEY = "intellitamed_assistant_v1";

  /* ============================================================
     REPLI « MODE DÉMO » — utilisé uniquement si le backend
     /api/assistant est injoignable (ouverture en file://, serveur
     arrêté, etc.). En mode connecté, le vrai appel part vers
     server/server.js qui relaie vers l'API Gemini (clé côté serveur).
     ============================================================ */
  function getMockReply(userText) {
    var t = userText.toLowerCase();

    // Déclencheur d'état erreur (pour la démo de l'UI d'erreur)
    if (t.indexOf("erreur") !== -1 || t.indexOf("error") !== -1) {
      throw new Error("Service IA temporairement indisponible (simulation).");
    }

    if (t.indexOf("analyse de march") !== -1 || t.indexOf("tendance") !== -1 || t.indexOf("marché") !== -1) {
      return "Voici mon analyse de marché :\n\n" +
        "• **Secteur Tech B2B** : croissance annuelle de +18%, portée par la demande d'outils SaaS et d'automatisation.\n" +
        "• **Segment porteur** : les PME de 10 à 50 salariés, où la maturité digitale explose.\n" +
        "• **Risque clé** : concurrence forte sur le pricing — différenciez-vous par la valeur démontrée.\n\n" +
        "Je recommande de cibler en priorité les niches sous-servies (fintech réglementaire, e-santé) avant de généraliser.";
    }
    if (t.indexOf("validation") !== -1 || t.indexOf("concept") !== -1 || t.indexOf("viabilit") !== -1) {
      return "Pour valider votre concept, voici le protocole recommandé :\n\n" +
        "1. **Entretiens clients** (10 minimum) pour confirmer le problème.\n" +
        "2. **Landing page de test** avec pré-inscriptions (objectif : 30% de conversion).\n" +
        "3. **Preuve de paiement** : faire pré-commander votre solution à 5 clients pilotes.\n\n" +
        "Votre score de validation actuel est estimé à **68%** — un bon point de départ, mais la preuve client reste à construire.";
    }
    if (t.indexOf("plan") !== -1 || t.indexOf("croissance") !== -1 || t.indexOf("trimestre") !== -1 || t.indexOf("etape") !== -1) {
      return "Voici votre plan de croissance pour le prochain trimestre :\n\n" +
        "**Phase 1 — Fondations (S1-2)** : finaliser le MVP, définir les KPIs (taux d'activation > 40%).\n" +
        "**Phase 2 — Traction (S3-6)** : 3 canaux d'acquisition testés avec un budget de 2 000 €, objectif CAC < 25 €.\n" +
        "**Phase 3 — Scale (S7-12)** : automatiser le funnel, recruter un commercial, viser 120 clients actifs.\n\n" +
        "Je peux générer ce plan dans votre espace « Plan d'action » si vous le souhaitez.";
    }
    if (t.indexOf("pricing") !== -1 || t.indexOf("prix") !== -1 || t.indexOf("tarif") !== -1) {
      return "Concernant votre stratégie de pricing :\n\n" +
        "• **Modèle recommandé** : abonnement par paliers (Starter / Pro / Entreprise) avec un freemium limité.\n" +
        "• **Benchmark secteur** : vos concurrents facturent entre 19 € et 99 €/mois ; un prix de 49 € avec valeur démontrée se justifie.\n" +
        "• **Levier** : la tarification à l'usage augmente le LTV de +15% sur ce segment.\n\n" +
        "Souhaitez-vous que je simule l'impact financier de ces options ?";
    }
    if (t.indexOf("automatiser") !== -1 || t.indexOf("workflow") !== -1) {
      return "Pour automatiser vos tâches répétitives :\n\n" +
        "1. **Audit des processus** : cartographiez les tâches > 2h/semaine.\n" +
        "2. **Outils recommandés** : Zapier ou n8n pour l'orchestration, et l'API de votre stack pour le reste.\n" +
        "3. **Gain estimé** : 10 à 15h libérées par semaine dès le premier mois.\n\n" +
        "Je peux vous générer un workflow type si vous me décrivez votre process actuel.";
    }
    if (t.indexOf("fintech") !== -1 || t.indexOf("concurrent") !== -1) {
      return "Analyse concurrentielle du secteur FinTech :\n\n" +
        "• **Acteurs majeurs** : 3 licornes dominent le marché, mais leur focus est le grand public.\n" +
        "• **Opportunité** : le segment B2B (outils pour entrepreneurs) est sous-servi — traction +30% supérieure au B2C.\n" +
        "• **Différenciation** : positionnez-vous sur la conformité réglementaire automatisée, une douleur forte et mal adressée.";
    }

    return "Merci pour votre question. En tant qu'assistant stratégique, je vous suggère de préciser votre demande " +
      "sur l'un de ces axes :\n\n" +
      "• **Analyse de marché** — tendances et opportunités dans votre secteur\n" +
      "• **Validation de concept** — viabilité de votre idée\n" +
      "• **Plan de croissance** — étapes clés pour les prochains mois\n" +
      "• **Stratégie de pricing** — modèles et benchmarks\n\n" +
      "Plus votre question est précise, plus ma réponse sera actionnable. 🎯";
  }
  /* ============================================================ */

  /* ---------- Données de conversation par défaut ---------- */
  var SEED_HISTORY = {
    "analyse-marche-saas": {
      title: "Analyse de marché SaaS",
      date: "Aujourd'hui",
      messages: [
        { role: "user", text: "Quelles sont les opportunités dans le SaaS pour PME en 2024 ?", time: "09:41" },
        { role: "ai", text: "Le marché SaaS B2B PME affiche une croissance de +18% par an. Les segments les plus porteurs : gestion financière automatisée, outils RH et automatisation des process. L'opportunité principale se situe sur les niches verticales sous-servies, où la concurrence est plus faible et la valeur perçue plus forte.", time: "09:41" }
      ]
    },
    "plan-action-q3": {
      title: "Plan d'action Q3",
      date: "Lundi",
      messages: [
        { role: "user", text: "Établir les étapes clés pour le Q3", time: "16:02" },
        { role: "ai", text: "Voici votre plan Q3 : 1) Finaliser le MVP (semaines 1-4), 2) Lancer la beta avec 50 utilisateurs (semaines 5-8), 3) Mesurer et itérer sur les KPIs d'activation (semaines 9-12). Je peux générer ce plan dans votre espace « Plan d'action ».", time: "16:03" }
      ]
    },
    "validation-fintech": {
      title: "Validation concept FinTech",
      date: "15 Mai",
      messages: [
        { role: "user", text: "Analyse concurrentielle secteur FinTech", time: "11:20" },
        { role: "ai", text: "Le secteur FinTech est dominé par 3 acteurs grand public. Votre angle B2B pour entrepreneurs est différenciant : traction 30% supérieure au B2C. Je recommande de valider par 10 entretiens clients ciblés sur les directeurs financiers de PME.", time: "11:21" }
      ]
    },
    "optimisation-workflow": {
      title: "Optimisation Workflow",
      date: "12 Mai",
      messages: [
        { role: "user", text: "Comment automatiser les tâches répétitives ?", time: "09:05" },
        { role: "ai", text: "Commencez par auditer les tâches de plus de 2h par semaine. Les outils d'orchestration comme n8n ou Zapier couvrent 80% des cas. Gain estimé : 10-15h libérées par semaine dès le premier mois.", time: "09:06" }
      ]
    },
    "strategie-pricing": {
      title: "Stratégie de Pricing",
      date: "8 Mai",
      messages: [
        { role: "user", text: "Modèles d'abonnement pour mon SaaS", time: "14:33" },
        { role: "ai", text: "Le modèle par paliers (Starter/Pro/Entreprise) est le plus efficace sur ce segment. Benchmark : 19 € à 99 €/mois. Un positionnement à 49 € avec valeur démontrée maximise le taux de conversion.", time: "14:34" }
      ]
    }
  };

  /* ---------- État ---------- */
  var currentConversation = "new";
  var conversations = loadConversations();

  function loadConversations() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        // fusion avec les conversations par défaut
        Object.keys(SEED_HISTORY).forEach(function (k) {
          if (!data[k]) data[k] = SEED_HISTORY[k];
        });
        return data;
      }
    } catch (e) { /* noop */ }
    return JSON.parse(JSON.stringify(SEED_HISTORY));
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
        // Backend injoignable ou erreur → repli sur les réponses simulées
        var reply;
        var isError = false;
        try {
          reply = getMockReply(text);
        } catch (e2) {
          reply = e2.message || "Une erreur est survenue.";
          isError = true;
        }
        setTimeout(function () {
          hideTyping();
          if (isError) {
            conv.messages.push({ role: "ai", text: "⚠️ " + reply, time: nowTime(), error: true });
          } else {
            conv.messages.push({ role: "ai", text: reply, time: nowTime() });
          }
          saveConversations();
          renderMessages(conv.messages);
          setBusy(false);
        }, 900 + Math.random() * 700);
      });
  }

  /* ---------- Appel backend Gemini (proxy serveur) ---------- */
  function callGemini(text, history) {
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 30000) : null;

    // Chemin absolu : les pages vivent dans /pages/, l'URL relative
    // « api/assistant » se résoudrait en /pages/api/assistant.
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
          el.title = "Réponses simulées — ajoutez GEMINI_API_KEY dans server/.env";
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

  // Préchargement de l'historique affiché côté serveur (seed)
  // Les conversations par défaut sont fusionnées au chargement.
})();
