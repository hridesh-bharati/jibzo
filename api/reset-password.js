import admin from "firebase-admin";

if (!admin.apps.length) {
  try {
    const serviceAccountJSON = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!serviceAccountJSON) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is missing!");
    }

    const serviceAccount = JSON.parse(serviceAccountJSON);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`,
    });
    
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
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
    console.log('Attempting password reset for:', email);
    
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password: newPassword });
    
    console.log('Password updated successfully for:', email);
    return res.status(200).json({ success: true, message: "Password updated successfully!" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to update password" 
    });
  }
}