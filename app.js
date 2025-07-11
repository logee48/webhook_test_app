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

(async () => {
  pdfText = await extractTextFromPDF('./setOfQuestions.pdf'); // Preload PDF once
})();

app.get('/', (req, res) => {
    const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': token } = req.query;
  
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('WEBHOOK VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.status(403).end();
    }
  });

app.post('/', async (req, res) => {
    const body = req.body;

    if (
      body.object &&
      body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    ) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from;
      const msgBody = message.text?.body?.toLowerCase().trim();
  
      console.log(`\nReceived message from ${from}: ${msgBody}`);

  let replyText = '';

  if (msgBody === 'hi' || msgBody === 'hello') {
    replyText = 'Hi, how are you today? 😊';
  } else if (msgBody.includes('how are you')) {
    replyText = 'I’m just a bot, but I’m running smoothly! What about you?';
  } else if (msgBody.includes('thanks') || msgBody.includes('thank you')) {
    replyText = 'You’re welcome! Let me know if you need anything else. 🙌';
  } else {
    // Check if the question is within the PDF context
    const contextCheckPrompt = `Based on the following PDF content, determine if the user's question is related to the topics covered in the PDF. Answer with only "YES" if the question is relevant to the PDF content, or "NO" if it's not related.\n\nPDF Content:\n${pdfText}\n\nUser Question: ${msgBody}\n\nAnswer (YES/NO):`;
    try {
      const contextResponse = await askGemini(contextCheckPrompt, pdfText);
      const isInContext = contextResponse.trim().toUpperCase().includes('YES');
      if (isInContext) {
        // Question is within context, get the answer
        replyText = await askGemini(msgBody, pdfText);
      } else {
        // Question is out of context
        replyText = "Sorry, we can't answer that. If you have any query, please contact us.";
      }
    } catch (error) {
      console.error('Error checking context:', error);
      replyText = "Sorry, we can't answer that. If you have any query, please contact us.";
    }
  }

  // Send reply
  try {
    await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      data: {
        messaging_product: 'whatsapp',
        to: from,
        text: { body: replyText }
      }
    });

    console.log(`Replied to ${from}: ${replyText}`);
  } catch (error) {
    console.error('Error sending reply:', error.response?.data || error.message);
  }
}
res.sendStatus(200);
});

app.listen(port, () => {
    console.log(`\nListening on port ${port}\n`);
  });
