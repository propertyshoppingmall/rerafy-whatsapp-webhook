import express from "express";

const app = express();
app.use(express.json());

// ================= CONFIG =================
const VERIFY_TOKEN = "rerafy_verify_123";
const GRAPH_URL = "https://graph.facebook.com/v18.0";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const NUMBERS = {
  client: {
    phone_id: process.env.PHONE_NUMBER_ID, // existing working number
    token: process.env.WHATSAPP_TOKEN
  },
  realtor: {
    phone_id: "1098985376629421", // your new number
    token: process.env.WHATSAPP_TOKEN
  }
};
const SHEET_URL = "https://script.google.com/macros/s/AKfycbx20xcz7tIoNSwoWrCVzAv8g7lpGQJLSmwn-aXJsptiU64uf4SpYBKwGIRSP-LUYdw/exec"; // 🔴 replace

// ================= SEND MESSAGE =================
async function sendMessage(payload, numberType = "client") {

  const config = NUMBERS[numberType];

  const url = `${GRAPH_URL}/${config.phone_id}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  console.log("📩 WhatsApp API Response:", data);

  return data;
}

// ================= SEND TEMPLATE =================
async function sendDynamicTemplate(to, template, variables = [], image = null, numberType = "client") {

  let components = [];

  // 👉 Image header
  if (image) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "image",
          image: { link: image }
        }
      ]
    });
  }

  // 👉 Body variables
  if (variables.length > 0) {
    components.push({
      type: "body",
      parameters: variables.map(v => ({
        type: "text",
        text: v
      }))
    });
  }

  return sendMessage({
  messaging_product: "whatsapp",
  to,
  type: "template",
  template: {
    name: template,
    language: { code: "en" },
    ...(components.length > 0 && { components })
  }
}, numberType);
  }

app.get("/send", async (req, res) => {
  try {
    const { phone, template, image, number } = req.query;
const numberType = number || "client";

    if (!phone || !template) {
      return res.send("❌ Phone & template required");
    }

    // Collect variables dynamically (v1 to v10)
    let variables = [];
    for (let i = 1; i <= 10; i++) {
      const val = req.query[`v${i}`];
      if (val) variables.push(val);
    }

    const response = await sendDynamicTemplate(
  phone,
  template,
  variables,
  image,
  numberType
);

    res.json(response);

  } catch (err) {
    console.error("ERROR:", err);
    res.send(`❌ Error: ${err.message}`);
  }
});

// ================= MEMORY =================
const userState = {};

// ================= SAVE LEAD TO GOOGLE SHEET =================
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
          "Hi 👋 Welcome to *Rerafy™* — a real estate data intelligence platform.\n\n" +
          "We help *buyers, sellers, investors & tenants* make smarter property decisions using *real transaction data* — the same intelligence trusted by serious investors.\n\n" +
          "With Rerafy™, you can:\n" +
          "• Check actual registered prices\n" +
          "• See recent deals within the same project\n" +
          "• Get basic legal & risk insights\n" +
          "• Connect with a strong realtor network\n\n" +
          "All in one place — for faster, more confident decisions.\n\n" +
          "How would you like to proceed?\n\n" +
          "👇 Please choose an option below"
      },
      action: {
        buttons: [
          { type: "reply", reply: { id: "PRICE", title: "Check Project Prices" } },
          { type: "reply", reply: { id: "LEGAL", title: "Check Legal / Risk" } },
          { type: "reply", reply: { id: "EXPERT", title: "Chat with Expert" } }
        ]
      }
    }
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
        "Before you decide, here are some quick answers about *Rerafy™* 👇\n\n" +
        "Reply with a number:\n\n" +
        "1️⃣ What is *Rerafy*?\n" +
        "2️⃣ Why should I use *Rerafy™* before *buying/selling* a property?\n" +
        "3️⃣ Is *Rerafy™* free?\n" +
        "4️⃣ Which locations does *Rerafy™* cover?\n\n" +
        "Just reply with 1, 2, 3 or 4.",
    },
  });
}

// ================= FAQ ANSWERS =================
async function sendFaqAnswer(to, number) {
  let text = "";

  if (number === "1") {
    text =
      "Rerafy™ is a real estate data intelligence platform that helps buyers and sellers make better decisions using real transaction data and a strong realtor network.\n\n" +
      "We help buyers/sellers check actual registered prices, recent deals " +
      "inside the same project and basic legal & risk indicators.\n\n";
  }

  if (number === "2") {
    text =
      "Most buyers decide without seeing the full picture.\n\n" +
      "Rerafy™ helps you compare projects using real transaction data and " +
      "reduces the risk of overpaying.\n\n";
  }

  if (number === "3") {
    text =
      "Yes ✅ Rerafy™ is currently 100% free for buyers.\n\n" +
      "Buyers don’t pay for price insights, transaction data or basic risk checks.\n\n" +
     "The service is offered only to genuine buyers, with some fair-use conditions.\n\n";
  }

  if (number === "4") {
    text =
      "Rerafy™ covers all of Maharashtra.\n\n" +
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

    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    const phoneNumberId = value?.metadata?.phone_number_id;
const REALTOR_NUMBER_ID = "1098985376629421";
const isRealtor = phoneNumberId === REALTOR_NUMBER_ID;

    // ✅ 1. DELIVERY STATUS HANDLER
    if (value?.statuses) {
      const statusObj = value.statuses[0];

      const messageId = statusObj.id;
      const status = statusObj.status;

      await fetch(SHEET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "status_update",
          message_id: messageId,
          status: status
        })
      });

      return res.sendStatus(200);
    }

    // ✅ 2. SAME AS OLD SCRIPT (UNCHANGED)
    const message = value?.messages?.[0];
    if (!message) return res.sendStatus(200);

    const from = message.from;
    const profileName = value?.contacts?.[0]?.profile?.name || "";

    if (!userState[from]) userState[from] = {};

    if (!userState[from].name && profileName) {
      userState[from].name = profileName;
    }

    // 👉 KEEP YOUR OLD BUTTON LOGIC
    // 👉 KEEP YOUR OLD TEXT LOGIC


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

      if (reply.id === "EXPERT") {
        await sendMessage({
          messaging_product: "whatsapp",
          to: from,
          type: "text",
          text: {
            body:
              "You’re now connecting with a human expert 👇\n\n" +
              "Chat directly here:\n" +
              "https://wa.me/917021418331",
          },
        });
        return res.sendStatus(200);
      }

      if (reply.id === "PRICE" || reply.id === "LEGAL") {
        await sendMessage({
          messaging_product: "whatsapp",
          to: from,
          type: "text",
          text: {
            body: "Please share the project name or location you’re checking.",
          },
        });
        return res.sendStatus(200);
      }
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

      // FIRST MESSAGE → WELCOME + FAQ
      if (!userState[from].welcomed && !isRealtor) {
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
