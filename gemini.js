// gemini.js
const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function askGemini(question, contextText) {
  const endpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `
You are a helpful assistant. Answer based only on the context below.

Context:
${contextText}

Question:
${question}
`;

  const response = await axios.post(endpoint, {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  });

  const reply = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't understand.";
  return reply;
}

module.exports = { askGemini };
