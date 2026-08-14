/* ============================================================
   IntelliTamed — Backend minimal (proxy Gemini)
   ------------------------------------------------------------
   - Sert le frontend statique (index.html, pages/, assets/)
   - POST /api/assistant : appelle l'API Gemini avec un prompt
     système IntelliTamed. La clé API reste côté serveur.
   - GET /api/health : état de la connexion Gemini.

   Démarrage :
     cd server && npm install && cp .env.example .env
     # renseigner GEMINI_API_KEY dans .env
     npm start            -> http://localhost:3000
   ============================================================ */

"use strict";

require("dotenv").config(); // charge server/.env

const path = require("path");
const express = require("express");

/* ---------- Configuration ---------- */
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
// Modèle configurable via l'environnement
// NB : gemini-2.5-flash n'est plus proposé aux nouveaux comptes → défaut gemini-3.6-flash
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const GEMINI_ENDPOINT =
  process.env.GEMINI_ENDPOINT ||
  "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}";

const ROOT_DIR = path.resolve(__dirname, ".."); // racine du frontend

/* ---------- Prompt système (persona de l'assistant) ---------- */
const SYSTEM_PROMPT = [
  "Tu es l'Assistant IntelliTamed, un expert stratégique en entrepreneuriat et venture building.",
  "Tu accompagnes des entrepreneurs, créateurs de projets, freelances et professionnels pour transformer leurs idées en projets concrets.",
  "Règles :",
  "- Réponds toujours en français, de façon concise et structurée (listes, sections courtes).",
  "- Sois actionnable : donne des étapes concrètes, des ordres de grandeur, des priorités.",
  "- Challemge les idées : identifie les risques et les angles morts avec bienveillance.",
  "- Couvre : validation de concept, analyse de marché, business model, pricing, plan d'action, levée de fonds, recrutement.",
  "- Si l'utilisateur demande un plan d'action, propose de le retrouver dans son espace « Plan d'action ».",
  "- N'invente pas de chiffres précis : donne des ordres de grandeur et précise qu'ils doivent être vérifiés.",
  "- Reste professionnel, premium et orienté solutions."
].join("\n");

/* ---------- App Express ---------- */
const app = express();
app.use(express.json({ limit: "256kb" }));

// Servir le frontend statique
app.use(express.static(ROOT_DIR));

/* ---------- GET /api/health ---------- */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    gemini: GEMINI_API_KEY ? "configured" : "missing-key",
    model: GEMINI_MODEL,
    timestamp: new Date().toISOString()
  });
});

/* ---------- POST /api/assistant ---------- */
app.post("/api/assistant", async (req, res) => {
  try {
    const { message, history } = req.body || {};

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Le champ 'message' est requis." });
    }
    if (message.length > 4000) {
      return res.status(400).json({ error: "Message trop long (4000 caractères max)." });
    }
    if (!GEMINI_API_KEY) {
      return res.status(503).json({
        error: "La clé API Gemini n'est pas configurée sur le serveur. Renseignez GEMINI_API_KEY dans server/.env."
      });
    }

    // Construire l'historique (contexte limité aux 12 derniers messages)
    const historyList = Array.isArray(history) ? history.slice(-12) : [];
    const contents = [
      ...historyList.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: String(m.text || "").slice(0, 4000) }]
      })),
      { role: "user", parts: [{ text: message.slice(0, 4000) }] }
    ];

    const url = GEMINI_ENDPOINT
      .replace("{model}", encodeURIComponent(GEMINI_MODEL))
      .replace("{key}", encodeURIComponent(GEMINI_API_KEY));

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
          topP: 0.9
        }
      })
    });

    if (!geminiRes.ok) {
      const body = await geminiRes.text().catch(() => "");
      console.error("[Gemini] Erreur " + geminiRes.status + " :", body.slice(0, 500));
      const message = geminiRes.status === 429
        ? "Quota Gemini dépassé. Réessayez dans quelques instants."
        : "Le service Gemini a renvoyé une erreur (code " + geminiRes.status + ").";
      return res.status(502).json({ error: message });
    }

    const data = await geminiRes.json();
    const reply =
      (data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts.map((p) => p.text || "").join("")) ||
      "";

    if (!reply) {
      return res.status(502).json({ error: "Gemini n'a pas généré de réponse. Réessayez." });
    }

    res.json({ reply, model: GEMINI_MODEL });
  } catch (err) {
    console.error("[server] Erreur /api/assistant :", err.message);
    res.status(500).json({ error: "Erreur interne du serveur." });
  }
});

/* ---------- Démarrage ---------- */
app.listen(PORT, () => {
  console.log("");
  console.log("  ⚡ IntelliTamed server démarré");
  console.log("  → Frontend : http://localhost:" + PORT);
  console.log("  → Health   : http://localhost:" + PORT + "/api/health");
  console.log("  → Gemini   : " + (GEMINI_API_KEY ? "clé configurée (" + GEMINI_MODEL + ")" : "CLÉ MANQUANTE — renseignez GEMINI_API_KEY dans server/.env"));
  console.log("");
});
