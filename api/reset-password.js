import admin from "firebase-admin";

if (!admin.apps.length) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable");
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method Not Allowed" });

  const { email, newPassword } = req.body;
  if (!email || !newPassword) return res.status(400).json({ success: false, message: "Email and password required" });

  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password: newPassword });
    res.status(200).json({ success: true, message: "Password updated successfully!" });
  } catch (err) {
    console.error("Reset password error:", err);

    let message = "Failed to update password";
    if (err.code === "auth/user-not-found") message = "User not found";
    if (err.code === "auth/invalid-password") message = "Password is invalid";

    res.status(500).json({ success: false, message, error: err?.message || err });
  }
}
