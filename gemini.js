// gemini.js
const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function askGemini(question, contextText) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `You are a helpful assistant. Answer based only on the context below.\n\nContext:\n${contextText}\n\nQuestion:\n${question}`;

  const response = await axios.post(endpoint, {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }]
      }
    ]
  }, {
    headers: { 'Content-Type': 'application/json' }
  });

  const reply = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't understand.";
  return reply;
}

module.exports = { askGemini };
