// netlify/functions/gemini.js

/** @type {import('@netlify/functions').Handler} */
exports.handler = async (event, context) => {
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

  const userPrompt = payload.prompt?.trim();
  if (!userPrompt) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing 'prompt' field" }),
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
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const result = await model.generateContent(userPrompt);
    const responseText = await result.response.text();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({ answer: responseText }),
    };
  } catch (err) {
    console.error("⚡ Gemini request failed:", err);
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Gemini API error", details: err.message }),
    };
  }
};