import express from "express";

const app = express();
app.use(express.json());

// ================= CONFIG =================
const VERIFY_TOKEN = "rerafy_verify_123";
const GRAPH_URL = "https://graph.facebook.com/v18.0";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const SHEET_URL = "https://script.google.com/macros/s/AKfycbXXXX/exec"; // <-- replace

// ================= MEMORY =================
const userState = {};

// ================= SAVE LEAD =================
async function saveLead(data) {
  await fetch(SHEET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: data.phone || "",
      name: data.name || "",
      type: data.type || "",
      button: data.button || "",
      message: data.message || "",
    }),
  });
}

// ================= SEND MESSAGE =================
async function sendMessage(payload) {
  const url = `${GRAPH_URL}/${PHONE_NUMBER_ID}/messages`;

  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
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
          "Hi 👋 Welcome to Rerafy.\n\n" +
          "We help property buyers make smarter decisions using real transaction data — " +
          "the same kind of data large investors rely on.\n\n" +
          "With Rerafy, you can:\n" +
          "• Check actual registered prices\n" +
          "• See recent deals in the same project\n" +
          "• Understand basic legal & risk signals\n\n" +
          "How would you like to proceed?",
      },
      action: {
        buttons: [
          { type: "reply", reply: { id: "PRICE", title: "Check Project Prices" } },
          { type: "reply", reply: { id: "LEGAL", title: "Check Legal / Risk" } },
          {
            type: "cta_url",
            cta_url: {
              link: "https://wa.me/917021418331",
              title: "Chat with Expert",
            },
          },
        ],
      },
    },
  });
}

// ================= FAQ MENU =================
async function sendFaqNumbers(to) {
  return sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: {
      body:
        "Before you decide, here are some quick answers about Rerafy 👇\n\n" +
        "Reply with a number:\n\n" +
        "1️⃣ What is Rerafy?\n" +
        "2️⃣ Why should I use Rerafy before buying a property?\n" +
        "3️⃣ Is Rerafy free?\n" +
        "4️⃣ Which locations does Rerafy cover?\n\n" +
        "Just reply with 1, 2, 3 or 4.",
    },
  });
}

// ================= FAQ ANSWERS =================
async function sendFaqAnswer(to, number) {
  let text = "";

  if (number === "1") {
    text =
      "Rerafy is a buyer-side real estate intelligence service.\n\n" +
      "We help property buyers check actual registered prices, recent deals " +
      "inside the same project and basic legal & risk indicators.\n\n";
  }

  if (number === "2") {
    text =
      "Most buyers decide without seeing the full picture.\n\n" +
      "Rerafy helps you compare projects using real transaction data and " +
      "reduces the risk of overpaying.\n\n";
  }

  if (number === "3") {
    text =
      "Yes ✅ Rerafy is currently 100% free for buyers.\n\n" +
      "Buyers don’t pay for price insights, transaction data or basic risk checks.\n\n";
  }

  if (number === "4") {
    text =
      "Rerafy covers all of Maharashtra.\n\n" +
      "Strong focus areas:\n" +
      "• Mumbai\n" +
      "• Thane\n" +
      "• Navi Mumbai\n\n";
  }

  text +=
    "If you want, share the project name or location you’re exploring and I’ll help you check it.";

  return sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

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

// ================= WEBHOOK RECEIVE =================
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from;
    const profileName = entry?.contacts?.[0]?.profile?.name || "";

    // Init state
    if (!userState[from]) {
      userState[from] = {};
    }

    // Capture profile name once
    if (!userState[from].name && profileName) {
      userState[from].name = profileName;
    }

    // ================= BUTTON HANDLING =================
    if (message.type === "interactive") {
      const reply = message.interactive.button_reply;

      await saveLead({
        phone: from,
        name: userState[from]?.name || "",
        type: "button",
        button: reply.id,
        message: reply.title,
      });

      if (reply.id === "PRICE" || reply.id === "LEGAL") {
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

    // ================= TEXT HANDLING =================
    if (message.type === "text") {
      const text = message.text.body.trim();

      await saveLead({
        phone: from,
        name: userState[from]?.name || "",
        type: "text",
        message: text,
      });

      // 🔥 FIRST MESSAGE → WELCOME FIRST, THEN FAQ
      if (!userState[from].welcomed) {
        userState[from].welcomed = true;

        await sendWelcome(from);
        await sendFaqNumbers(from);

        return res.sendStatus(200);
      }

      // FAQ number replies
      if (["1", "2", "3", "4"].includes(text)) {
        await sendFaqAnswer(from, text);
        return res.sendStatus(200);
      }

      return res.sendStatus(200);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    res.sendStatus(200);
  }
});

// ================= START SERVER =================
app.listen(process.env.PORT || 3000, () => {
  console.log("Webhook running");
});
