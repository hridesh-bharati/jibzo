// Example for Vercel Serverless Function
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { appId, authKey, title, message, data = {}, targetUserId } = req.body;

  if (!appId || !authKey || !title || !message) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const payload = {
    app_id: appId,
    headings: { en: title },
    contents: { en: message },
    data,
  };

  if (targetUserId) payload.include_external_user_ids = [targetUserId];
  else payload.included_segments = ["Subscribed Users"];

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
