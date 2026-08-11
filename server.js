// Instagram AI Auto-Reply Bot
const express = require("express");
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "instabot123";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const BUSINESS_INFO = `
You are a helpful customer service assistant for an Instagram clothing store.
Answer customer questions naturally and helpfully about products, sizing, shipping, and orders.
If you don't know a specific detail (like exact stock or price), say you'll check and get back to them.
Keep replies short and friendly, like a real person texting - not overly formal.
`;

app.get("/", (req, res) => {
  res.send("Instagram bot is running.");
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified.");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const messaging = entry?.messaging?.[0];

    if (!messaging || !messaging.message || messaging.message.is_echo) {
      return;
    }

    const senderId = messaging.sender.id;
    const userText = messaging.message.text;

    if (!userText) return;

    console.log("Incoming message:", userText);

    const aiReply = await getAIReply(userText);
    await sendInstagramReply(senderId, aiReply);

  } catch (err) {
    console.error("Error handling webhook:", err);
  }
});

async function getAIReply(userText) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: ${BUSINESS_INFO}\n\nIMPORTANT: Detect the language and dialect the customer is using (including French, English, Arabic, or Moroccan Darija in Arabic script or Latin letters) and reply in that exact same language and style. Do not switch languages.,
      messages: [{ role: "user", content: userText }],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Claude API error:", data);
    return "Sorry, I'm having trouble responding right now. We'll get back to you shortly!";
  }

  return data.content?.[0]?.text || "Thanks for your message! We'll get back to you shortly.";
}

async function sendInstagramReply(recipientId, messageText) {
  const url = https://graph.facebook.com/v21.0/me/messages?access_token=${META_ACCESS_TOKEN};

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: messageText },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Instagram send error:", data);
  } else {
    console.log("Reply sent successfully.");
  }
}

app.listen(PORT, () => {
  console.log(Server running on port ${PORT});
});
