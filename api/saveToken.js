import admin from "firebase-admin";
import { readFile } from "fs/promises";

let app;
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    await readFile(new URL('../service-account.json', import.meta.url))
  );

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { token, userId } = req.body;

  if (!token || !userId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const db = admin.database();
    await db.ref(`fcmTokens/${userId}`).set({ token, createdAt: Date.now() });
    return res.status(200).json({ success: true, token });
  } catch (err) {
    console.error("Error saving token:", err);
    return res.status(500).json({ error: err.message });
  }
}
