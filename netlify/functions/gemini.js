// netlify/functions/gemini.js
// Multi-turn chat with Gemini – accepts a conversation history array.

/** @type {import('@netlify/functions').Handler} */
exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed – use POST" }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  // Accept either { history: [...] } (multi-turn) or { prompt: "..." } (legacy single-turn)
  const history = payload.history; // array of { role, parts }
  const legacyPrompt = payload.prompt?.trim();

  if (!history && !legacyPrompt) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing 'history' or 'prompt' field" }),
    };
  }

  const { GoogleGenerativeAI } = require("@google/generative-ai");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY not set in environment");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server mis-configuration" }),
    };
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // System instruction: short, plain-text Hebrew for TTS
  const systemInstruction =
    "אתה עוזר קולי חכם באתר של נעם גבאי, מורה פרטי למתמטיקה (גבאי מתמטיקה). " +
    "ענה תמיד בעברית, בטון חברותי ובגובה העיניים. " +
    "אורך התשובה: משפט אחד עד שלושה משפטים בלבד, כי התשובה מושמעת בקול (Text-To-Speech). " +
    "פורמט: טקסט פשוט בלבד! אסור להשתמש ב-Markdown, כוכביות (**), תבליטים, רשימות או סימנים מיוחדים. " +
    "אם תלמיד שואל על שעות פנויות או קביעת שיעור בלי לציין תאריך, שאל אותו באופן טבעי לאיזה יום הוא מתכוון.";

  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash",
    systemInstruction,
  });

  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    let responseText;

    if (history && Array.isArray(history) && history.length > 0) {
      // ── Multi-turn chat mode ──
      // The last entry in history must be the current user message.
      // Everything before it is the prior conversation context.
      const lastEntry = history[history.length - 1];
      const priorHistory = history.slice(0, -1);

      const chat = model.startChat({ history: priorHistory });
      const userMessage =
        lastEntry.parts?.map((p) => p.text).join("\n") || "";
      const result = await chat.sendMessage(userMessage);
      responseText = result.response.text();
    } else {
      // ── Legacy single-turn fallback ──
      const result = await model.generateContent(legacyPrompt);
      responseText = result.response.text();
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ answer: responseText }),
    };
  } catch (err) {
    console.error("⚡ Gemini request failed:", err);
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Gemini API error", details: err.message }),
    };
  }
};
