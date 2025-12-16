const express = require("express");
const fetch = require("node-fetch"); // if Node < 18
const app = express();

app.use(express.json());

const VERIFY_TOKEN = "rerafy_verify_123";
const GRAPH_URL = "https://graph.facebook.com/v18.0";
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;

// ---------- WEBHOOK VERIFY ----------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ---------- SEND MESSAGE HELPER ----------
async function sendMessage(payload) {
  const url = `${GRAPH_URL}/${PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ---------- WELCOME MESSAGE ----------
async function sendWelcome(to) {
  return sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text:
          "Hi 👋\nWelcome to Rerafy.\n\n" +
          "We help property buyers make safer decisions using:\n" +
          "• Actual registered transaction prices\n" +
          "• Recent project-wise transactions\n" +
          "• Basic legal & risk indicators\n\n" +
          "How would you like to proceed?",
      },
      action: {
        buttons: [
          { type: "reply", reply: { id: "PRICE", title: "Check Project Prices" } },
          { type: "reply", reply: { id: "LEGAL", title: "Check Legal / Risk" } },
          { type: "reply", reply: { id: "FAQ", title: "FAQs about Rerafy" } },
        ],
      },
    },
  });
}

// ---------- FAQ MENU ----------
async function sendFaqMenu(to) {
  return sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Here are some quick answers 👇" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "FAQ_WHAT", title: "What is Rerafy?" } },
          { type: "reply", reply: { id: "FAQ_WHY", title: "Why use Rerafy?" } },
          { type: "reply", reply: { id: "FAQ_FREE", title: "Is it free & coverage?" } },
        ],
      },
    },
  });
}

// ---------- FAQ ANSWERS ----------
async function sendFaqAnswer(to, type) {
  let text = "";
  if (type === "FAQ_WHAT") {
    text =
      "Rerafy is a buyer-side real estate intelligence service.\n\n" +
      "We help homebuyers verify:\n" +
      "• Actual registered transaction prices\n" +
      "• Recent project-wise transactions\n" +
      "• Basic legal & project risk indicators\n\n" +
      "Would you like to check a specific project?\n" +
      "Please share the project name or location.";
  } else if (type === "FAQ_WHY") {
    text =
      "Most buyers don’t know:\n" +
      "• Real prices at which flats get registered\n" +
      "• Past transactions in the same project\n" +
      "• Basic legal or project risks\n\n" +
      "Rerafy helps you compare projects objectively and reduces the risk of overpaying.\n\n" +
      "Tell us the project name or area you’re considering.";
  } else if (type === "FAQ_FREE") {
    text =
      "Yes ✅ Rerafy is currently 100% free for buyers.\n\n" +
      "Buyers don’t pay for price insights, transaction data or basic risk checks.\n\n" +
      "Coverage:\n" +
      "• All of Maharashtra\n" +
      "• Strong focus on Mumbai, Thane & Navi Mumbai\n\n" +
      "Which project or location are you planning to buy in?";
  }

  return sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

// ---------- WEBHOOK RECEIVE ----------
app.post("/webhook", async (req, res) => {
  try {
    console.log("📩 Incoming:", JSON.stringify(req.body, null, 2));

    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const msg = entry?.messages?.[0];
    if (!msg) return res.sendStatus(200);

    const from = msg.from;

    // Text message (Hi / prefilled)
    if (msg.type === "text") {
      await sendWelcome(from);
    }

    // Button clicks
    if (msg.type === "interactive" && msg.interactive.type === "button_reply") {
      const id = msg.interactive.button_reply.id;

      if (id === "FAQ") await sendFaqMenu(from);
      if (id === "FAQ_WHAT" || id === "FAQ_WHY" || id === "FAQ_FREE") {
        await sendFaqAnswer(from, id);
      }

      if (id === "PRICE" || id === "LEGAL") {
        await sendMessage({
          messaging_product: "whatsapp",
          to: from,
          type: "text",
          text: { body: "Please share the project name or location you’re checking." },
        });
      }
    }

    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.sendStatus(200);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Webhook running");
});
