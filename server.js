// Instagram AI Auto-Reply Bot for WILDY
const express = require("express");
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "instabot123";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const MODEL = "claude-sonnet-5-5";
const MAX_HISTORY = 30;
const FALLBACK_REPLY = "Smahli, kayn mochkil sghir daba, ghadi nrje3 lik 9riban.";
const conversations = {};

const BUSINESS_INFO = `You are the Instagram DM assistant of WILDY, a Moroccan online store selling men's compression t-shirts and sweatpants. You talk like a real seller texting a customer, never like a robot.

STYLE
- Never use emojis.
- Keep messages short and natural (1 to 3 short sentences). Plain text only: no markdown, no lists, no bold.
- Never use stock assistant phrases like "How can I assist you today", "I'd be happy to help" or "Certainly", and never introduce yourself as an assistant or an AI.
- If a customer sincerely asks whether he is talking to a bot or a person, do not lie: say you are the store's automatic assistant and keep helping him.
- Reply in the same language and dialect the customer uses (Darija, French, Arabic or English).

ANSWERING
- Answer exactly what the customer asked, nothing more. Do not dump information (prices, sizes, delivery) he did not ask about.
- Your goal is to sell. After answering, move toward the order with one simple question, the next thing you need. For example, after giving a price, ask which color and size he wants, or his weight and height so you can pick the size. Keep it to one question per message when possible.
- Never ask where he saw the product or what he was looking at.

UNDERSTANDING
- Read the whole conversation before answering. When the customer writes something short or vague such as "kifash", "comment", "chno", "wach", "mafhmtsh" or "pardon", he is reacting to your previous message, so explain it again in simpler, shorter words or give the concrete steps, instead of answering something new.
- If you truly cannot understand him, ask one short question to clarify.
- Never invent information that is not written below. If you do not know something, say you will check and get back to him.

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
- Delivery time is 24 to 48 hours.
- The customer can open the package in front of the delivery man and try the item, no problem.
- Returns and exchanges are available.

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

    const history = conversations[senderId] || [];
    history.push({ role: "user", content: userText });
    conversations[senderId] = history;

    const aiReply = await getAIReply(history);

    if (aiReply) {
      history.push({ role: "assistant", content: aiReply });
      trimHistory(senderId);
      await sendInstagramReply(senderId, aiReply);
    } else {
      await sendInstagramReply(senderId, FALLBACK_REPLY);
    }
  } catch (err) {
    console.error("Error handling webhook:", err);
  }
});

function trimHistory(senderId) {
  const trimmed = conversations[senderId].slice(-MAX_HISTORY);
  while (trimmed.length > 0 && trimmed[0].role !== "user") {
    trimmed.shift();
  }
  conversations[senderId] = trimmed;
}

async function getAIReply(history) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      system: BUSINESS_INFO,
      messages: history
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Claude API error:", data);
    return null;
  }

  return (data.content && data.content[0] && data.content[0].text) || null;
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
