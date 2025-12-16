const express = require("express");
const app = express();

app.use(express.json());
const SHEET_URL = "https://script.google.com/macros/s/AKfycbwTLPl5oHdfwj3vkFlj7mwan081WkrLb8felUOXx_jAIiIr0nWIltKHV6EpOmcsuLIAEA/exec";

async function saveLead(data) {
  await fetch(SHEET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// ================= CONFIG =================
const VERIFY_TOKEN = "rerafy_verify_123";
const GRAPH_URL = "https://graph.facebook.com/v18.0";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// ================= WEBHOOK VERIFY =================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ================= SEND MESSAGE HELPER =================
async function sendMessage(payload) {
  const url = `${GRAPH_URL}/${PHONE_NUMBER_ID}/messages`;

  console.log("📤 Sending to WhatsApp:", JSON.stringify(payload, null, 2));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  console.log("📥 WhatsApp API response:", data);

  return data;
}

// ================= WELCOME MESSAGE =================
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
          {
            type: "reply",
            reply: { id: "PRICE", title: "Check Project Prices" },
          },
          {
            type: "reply",
            reply: { id: "LEGAL", title: "Check Legal / Risk" },
          },
          {
            type: "reply",
            reply: { id: "FAQ", title: "FAQs about Rerafy" },
          },
        ],
      },
    },
  });
}

// ================= FAQ MENU =================
async function sendFaqMenu(to) {
  return sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text: "Here are some quick answers 👇",
      },
      action: {
        buttons: [
          {
            type: "reply",
            reply: { id: "FAQ_WHAT", title: "What is Rerafy?" },
          },
          {
            type: "reply",
            reply: { id: "FAQ_WHY", title: "Why use Rerafy?" },
          },
          {
            type: "reply",
            reply: { id: "FAQ_FREE", title: "Free & Coverage?" },
          },
        ],
      },
    },
  });
}

// ================= FAQ ANSWERS =================
async function sendFaqAnswer(to, type) {
  let text = "";

  if (type === "FAQ_WHAT") {
    text =
      "Rerafy is a buyer-side real estate intelligence service platform.\n\n" +
      "We help homebuyers verify:\n" +
      "• Actual registered transaction prices\n" +
      "• Recent project-wise transactions\n" +
      "• Basic legal & project risk indicators\n\n" +
      "Would you like to check a specific project?\n" +
      "Please share the project name or location.";
  }

  if (type === "FAQ_WHY") {
    text =
      "Rerafy Provides:\n" +
      "• Real prices at which flats get sold\n" +
      "• Past transactions in the same project\n" +
      "• Basic legal or project risks\n\n" +
      "Rerafy helps you compare projects objectively and reduces the risk of overpaying & risk checks.\n\n" +
      "Tell us the project name or area you’re considering.";
  }

  if (type === "FAQ_FREE") {
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

// ================= WEBHOOK RECEIVE =================
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from;

    // ===============================
    // 1️⃣ BUTTON CLICKS → SAVE TO SHEET
    // ===============================
    if (
      message.type === "interactive" &&
      message.interactive.type === "button_reply"
    ) {
      const id = message.interactive.button_reply.id;
      const title = message.interactive.button_reply.title;

      // ✅ STEP 6B: SAVE BUTTON ACTION
      await saveLead({
        phone: from,
        type: "button",
        button: id,
        message: title,
      });

      // Existing logic
      if (id === "FAQ") {
        await sendFaqMenu(from);
      }

      if (id === "FAQ_WHAT" || id === "FAQ_WHY" || id === "FAQ_FREE") {
        await sendFaqAnswer(from, id);
      }

      if (id === "PRICE" || id === "LEGAL") {
        await sendMessage({
          messaging_product: "whatsapp",
          to: from,
          type: "text",
          text: {
            body: "Please share the project name or location you’re checking.",
          },
        });
      }

      return res.sendStatus(200);
    }

    // ===============================
    // 2️⃣ TEXT MESSAGE → SAVE TO SHEET
    // ===============================
    if (message.type === "text") {

      // ✅ STEP 6A: SAVE TEXT MESSAGE
      await saveLead({
        phone: from,
        type: "text",
        message: message.text.body,
      });

      // Existing logic
      await sendWelcome(from);
      return res.sendStatus(200);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.sendStatus(200);
  }
});



// ================= START SERVER =================
app.listen(process.env.PORT || 3000, () => {
  console.log("Webhook running");
});
