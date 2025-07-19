const { extractTextFromPDF } = require('./pdf_reader');
const { askGemini } = require('./gemini');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;
const accessToken = process.env.ACCESS_TOKEN;
const phoneNumberId = process.env.PHONE_NUMBER_ID;

let pdfText = '';
// Preload the PDF content once at startup
(async () => {
  try {
    pdfText = await extractTextFromPDF('./modified_questions.pdf');
    console.log('PDF content loaded.');
  } catch (err) {
    console.error('Failed to load PDF:', err);
  }
})();

// Helper to send WhatsApp messages via Graph API
async function sendWhatsAppMessage(to, body) {
  return axios({
    method: 'POST',
    url: `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    data: {
      messaging_product: 'whatsapp',
      to,
      text: { body },
    },
  });
}

// Webhook verification endpoint
app.get('/', (req, res) => {
  const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('Webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Incoming messages handler
app.post('/', async (req, res) => {
  const entry = req.body.entry?.[0];
  const changes = entry?.changes?.[0];
  const message = changes?.value?.messages?.[0];
  if (!message) {
    return res.sendStatus(200);
  }

  const from = message.from;
  const msgBody = message.text?.body?.toLowerCase().trim() || '';
  console.log(`Received from ${from}: "${msgBody}"`);

  let replyText = '';

  // Humane, brand-aligned quick replies
  if (msgBody === 'hi' || msgBody === 'hello') {
    replyText = `Namaste from OrangUtan Organics 🌱\nPerched at 2,300 m in the Gangotri Valley, we're here to share the true taste of the Himalayas. How can we brighten your day?`;
  } else if (msgBody.includes('how are you')) {
    replyText = `We're flourishing like the alpine blooms at Gangotri! 😊 How can we assist you today?`;
  } else if (msgBody === 'fine') {
    replyText = `Glad to hear you're doing fine! At 2,300 m, our small-holder farmers nurture each seed with care. Would you like to learn about our traceability or geo-seed mapping?`;
  } else if (msgBody.includes('thank you') || msgBody.includes('thanks')) {
    replyText = `You're most welcome! Supporting Gangotri valley farmers means the world to us. Let us know if you'd like to know more about our ethical sourcing.`;
  } else if (['awesome', 'amazing', 'great'].some(word => msgBody.includes(word))) {
    replyText = `That's wonderful to hear! Just like our wild tempering spice—harvested ethically at altitude—your enthusiasm warms our hearts. 😊`;
  } else {
    // Check if the question relates to our preloaded PDF context
    const contextCheckPrompt = `
Based on the following OrangUtan Organics PDF content, is the user's question related to topics covered? 
Answer only "YES" or "NO".

=== PDF CONTENT BEGIN ===
${pdfText}
=== PDF CONTENT END ===

User Question: "${msgBody}"
Answer:
    `;
    try {
      const contextRes = await askGemini(contextCheckPrompt, pdfText);
      const isRelevant = contextRes.trim().toUpperCase().startsWith('YES');
      if (isRelevant) {
        // Fetch a humanized answer from Gemini
        const answer = await askGemini(
          `As a representative of OrangUtan Organics (Gangotri Valley, 2,300 m), answer warmly:\n\nQ: ${msgBody}`,
          pdfText
        );
        replyText = answer;
      } else {
        // Out-of-context fallback
        replyText = `At OrangUtan Organics, we stand against mislabelling and broken traceability. We empower local small‐holders, guarantee genuine Himalayan origin, and protect seeds via geo‐mapping. Feel free to ask about any of these!`;
      }
    } catch (err) {
      console.error('Context check/answer error:', err);
      replyText = `Oops—something went awry! If you need assistance or want to learn about our farmers, traceability, or seed protection, just let me know.`;
    }
  }

  // Send the reply
  try {
    await sendWhatsAppMessage(from, replyText);
    console.log(`Replied to ${from}: "${replyText}"`);
  } catch (err) {
    console.error('Error sending message:', err.response?.data || err.message);
  }

  res.sendStatus(200);
});

// Start server
app.listen(port, () => {
  console.log(`OrangUtan Organics bot listening on port ${port}`);
});
