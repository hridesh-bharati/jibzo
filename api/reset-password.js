import admin from "firebase-admin";

if (!admin.apps.length) {
  if (
    !process.env.FIREBASE_TYPE ||
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_PRIVATE_KEY ||
    !process.env.FIREBASE_PRIVATE_KEY_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL
  ) {
    throw new Error("Firebase environment variables are missing!");
  }

  const serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ success: false, message: "Email and new password are required" });
  }

  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password: newPassword });
    return res.status(200).json({ success: true, message: "Password updated successfully!" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to update password" });
  }
}
