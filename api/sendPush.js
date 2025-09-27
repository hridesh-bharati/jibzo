import admin from "firebase-admin";
import { readFile } from "fs/promises";

let app;
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    await readFile(new URL('../service-account.json', import.meta.url))
  );

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { token, title, body } = req.body;

  if (!token || !title || !body) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const message = {
    token,
    notification: { title, body },
    webpush: {
      notification: {
        icon: "https://jibzo.vercer.app/logo.png",
        click_action: "https://jibzo.vercer.app",
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("✅ Notification sent:", response);
    res.status(200).json({ success: true, response });
  } catch (err) {
    console.error("❌ Failed to send:", err);
    res.status(500).json({ error: err.message });
  }
}
