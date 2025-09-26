import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { title, message, data = {}, targetUserId } = req.body;

  if (!title || !message) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const payload = {
    app_id: process.env.NOTIFY_APP_ID,       // Vercel env variable
    headings: { en: title },
    contents: { en: message },
    data,
  };

  if (targetUserId) {
    payload.include_external_user_ids = [targetUserId];
  } else {
    payload.included_segments = ["All"]; // All subscribed users (make sure segment exists)
  }

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${process.env.NOTIFY_AUTH_ID}`, // Vercel env variable
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
