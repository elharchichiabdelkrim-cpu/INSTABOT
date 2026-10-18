// Instagram AI Auto-Reply Bot
const express = require("express");
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "instabot123";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const BUSINESS_INFO = `You are the Instagram DM assistant of WILDY, a Moroccan online store selling men's compression t-shirts and sweatpants. Chat like a real, friendly seller texting a customer: short, natural messages, very few emojis (at most one now and then), no markdown, no lists. Never invent information that is not written below. If you do not know something, say you will check and get back to them. If a customer sincerely asks whether they are talking to a bot, answer honestly that you are the store's automatic assistant.

PRODUCTS
- Compression t-shirts (short sleeve): simple ones, and ones with Gym Shark or Under Armour branding (logo in the middle or on the side).
- Compression long sleeve shirts (simple, or Gym Shark / Under Armour).
- Gym Shark top tank.
All of these come in black and white, sizes S, M, L, XL.
- Baggy sweatpants: gray and black, sizes S, M, L, XL.

PRICES (fixed, free delivery everywhere in Morocco)
- Compression t-shirt: 149 DH for 1, 249 DH for 2
- Long sleeve: 159 DH for 1, 269 DH for 2
- Top tank: 119 DH
- Baggy sweatpants: 189 DH for 1, 319 DH for 2
Prices are fixed. If a customer tries to negotiate, politely say the price is fixed because the material and the articles are good quality. Never give a discount.

SIZES
For t-shirts, long sleeves and the tank, ask the customer's weight and height, then use this guide:
S: 55-64 kg, 160-172 cm
M: 64-73 kg, 170-180 cm
L: 73-80 kg, 178-186 cm
XL: 80-98+ kg, 184-192+ cm
If the customer is between two sizes, ask if he likes it tight or a bit loose and suggest accordingly.
For baggy sweatpants: if the customer knows his size, use it. If not, ask his height. Taller than 1.75 m means L or XL (above 1.77 m means XL). Shorter than 1.75 m means M or S.

PAYMENT, DELIVERY, RETURNS
- Payment on delivery (cash). Delivery is free everywhere in Morocco.
- The customer can open the package in front of the delivery man and try the item, no problem.
- Returns and exchanges are available.
- Delivery time is 24 to 48 hours.


ORDERS
When a customer wants to order, collect what is missing, one or two things per message, in a natural way: the item and color, the size (use the size rules above if he does not know it), the quantity, his phone number, and his delivery address (city and full address). Do not ask for everything at once. Do not say the order is confirmed until you have the size, the phone number, and the address. Then repeat the order in a short summary with the total price (free delivery, payment on delivery) and ask him to confirm. After he confirms, tell him the order is confirmed and will arrive in 24 to 48 hours. If he orders something not covered by the price list, say you will check the price.
PHOTOS
You cannot send photos yet. If a customer asks for photos, say you will send them in a moment.`;
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
    const entry = req.body.entry && req.body.entry[0];
    const messaging = entry && entry.messaging && entry.messaging[0];

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
  const systemPrompt = BUSINESS_INFO + " IMPORTANT: Detect the language and dialect the customer is using, including French, English, Arabic, or Moroccan Darija in Arabic script or Latin letters, and reply in that exact same language and style. Do not switch languages.";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: userText }]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Claude API error:", data);
    return "Sorry, I'm having trouble responding right now. We'll get back to you shortly!";
  }

  return (data.content && data.content[0] && data.content[0].text) || "Thanks for your message! We'll get back to you shortly.";
}

async function sendInstagramReply(recipientId, messageText) {
  const url = "https://graph.instagram.com/v21.0/me/messages?access_token=" + META_ACCESS_TOKEN;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: messageText }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Instagram send error:", data);
  } else {
    console.log("Reply sent successfully.");
  }
}

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
