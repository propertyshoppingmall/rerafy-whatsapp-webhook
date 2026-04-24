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

  console.log("🚀 Sending from:", numberType);

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
    const { phone, template, image } = req.query;

       // 🔥 STRICT CONTROL (FINAL)
if (!req.query.number) {
  return res.send("❌ number param missing");
}

let numberRaw = req.query.number.toString().trim().toLowerCase();

if (numberRaw !== "client" && numberRaw !== "realtor") {
  return res.send("❌ invalid number type");
}

const numberType = numberRaw;

// DEBUG
console.log("👉 Incoming number:", req.query.number);
console.log("👉 Final numberType:", numberType);

    // ❗ REQUIRED CHECK
    if (!phone || !template) {
      return res.send("❌ Phone & template required");
    }

    // VARIABLES
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
async function saveLead(data, numberType = "client") {
  await fetch(SHEET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: data.phone || "",
      name: data.name || "",
      type: data.type || "",
      button: data.button || "",
      message: data.message || "",
      phone_number_id: numberType   // 🔥 KEY FIX
    }),
  });
}


// ================= WELCOME MESSAGE =================
async function sendWelcome(to, numberType = "client") {
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
          { type: "reply", reply: { id: "PRICE", title: "Project Prices Check" } },
          { type: "reply", reply: { id: "LEGAL", title: "Legal Check" } },
          { type: "reply", reply: { id: "EXPERT", title: "Talk to Expert" } }
        ]
      }
    }
  }, numberType);
}

// ================= FAQ MENU =================
async function sendFaqNumbers(to, numberType = "client") {
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
        }
  }, numberType);
}

// ================= FAQ ANSWERS =================
async function sendFaqAnswer(to, number, numberType = "client") {
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
}, numberType);

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
    const numberType = isRealtor ? "realtor" : "client";

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
    // ❌ Ignore messages triggered by your own API (campaign/template)

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

  if (!userState[from].welcomed && !isRealtor) {
    userState[from].welcomed = true;

    await sendWelcome(from, numberType);
    await sendFaqNumbers(from, numberType);
  }

  const reply = message.interactive.button_reply;

  await saveLead({
    phone: from,
    name: userState[from]?.name || "",
    type: "button",
    button: reply.id,
    message: reply.title,
  }, numberType);

  // ✅ EXISTING LOGIC ONLY

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
    }, numberType);
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
    }, numberType);
    return res.sendStatus(200);
  }

  return res.sendStatus(200);
}
// ================= TEMPLATE BUTTON HANDLING =================
else if (message.type === "button") {

  // 🔥 ADD THIS (FIX)
  if (!userState[from].welcomed && !isRealtor) {
    userState[from].welcomed = true;

    await sendWelcome(from, numberType);
    await sendFaqNumbers(from, numberType);
  }

  const payload = (message.button?.payload || "").toUpperCase().trim();
  const text = (message.button?.text || "").toLowerCase().trim();

  await saveLead({
    phone: from,
    name: userState[from]?.name || "",
    type: "button",
    button: payload,
    message: text,
  }, numberType);

  // 🔥 YOUR BUTTONS

  if (payload === "JOIN_COMMUNITY" || text === "join community") {
    await sendMessage({
      messaging_product: "whatsapp",
      to: from,
      type: "text",
      text: {
        body:
          "Join our Realtors Network 👇\n\n" +
          "https://chat.whatsapp.com/xxxxx\n\n" +
          "Reply JOINED after entering."
      }
    }, numberType);
    return res.sendStatus(200);
  }

  if (payload === "VIEW_LISTINGS" || text === "view more listings") {
    await sendMessage({
      messaging_product: "whatsapp",
      to: from,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text:
            "Here are latest listings 👇\n\n" +
            "https://whatsapp.com/channel/xxxxx"
        },
        action: {
          buttons: [
            { type: "reply", reply: { id: "SHOW", title: "Show Deals" } },
            { type: "reply", reply: { id: "EXPERT", title: "Talk to Expert" } }
          ]
        }
      }
    }, numberType);
    return res.sendStatus(200);
  }

  if (payload === "CALL_NOW" || text === "call now") {
    await sendMessage({
      messaging_product: "whatsapp",
      to: from,
      type: "text",
      text: {
        body:
          "Connect instantly with our team 👇\n\n" +
          "https://wa.me/917021418331\n\n" +
          "Or reply here with your requirement."
      }
    }, numberType);
    return res.sendStatus(200);
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
}, numberType);

      // FIRST MESSAGE → WELCOME + FAQ
      if (!userState[from].welcomed && !isRealtor) {
  userState[from].welcomed = true;

  await sendWelcome(from, numberType);
await sendFaqNumbers(from, numberType);

  return res.sendStatus(200);
}

      // FAQ number replies
      if (["1", "2", "3", "4"].includes(text)) {
        await sendFaqAnswer(from, text, numberType);
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
