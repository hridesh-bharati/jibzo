// api/saveAndPush.js - ULTRA SIMPLE WORKING VERSION
import admin from "firebase-admin";

// Simple Firebase init
const initializeFirebase = async () => {
  try {
    if (admin.apps.length > 0) {
      return admin.app();
    }

    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.error("❌ FIREBASE_SERVICE_ACCOUNT missing");
      throw new Error("Firebase configuration missing");
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (error) {
      console.error("❌ Invalid service account JSON");
      throw error;
    }

    // Fix private key
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

    const databaseURL = serviceAccount.database_url || 
                       `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`;

    console.log("🔧 Initializing Firebase with database URL:", databaseURL);
    
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: databaseURL
    });
  } catch (error) {
    console.error("❌ Firebase init failed:", error.message);
    throw error;
  }
};

export default async function handler(req, res) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`\n🚀 [${requestId}] === REQUEST STARTED ===`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    console.log(`🔍 [${requestId}] Preflight - 200 OK`);
    return res.status(200).end();
  }

  // Method check
  if (req.method !== 'POST') {
    console.log(`❌ [${requestId}] Method not allowed: ${req.method}`);
    return res.status(405).json({ 
      success: false, 
      error: 'Only POST requests allowed' 
    });
  }

  try {
    console.log(`🔍 [${requestId}] Step 1: Checking content type`);
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Content-Type must be application/json' 
      });
    }

    console.log(`🔍 [${requestId}] Step 2: Parsing body`);
    let requestBody;
    try {
      requestBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      console.log(`✅ [${requestId}] Body parsed successfully`);
    } catch (parseError) {
      console.error(`❌ [${requestId}] Parse error:`, parseError.message);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid JSON format' 
      });
    }

    const { userId, token, title, body } = requestBody;

    console.log(`🔍 [${requestId}] Step 3: Validating input`);
    console.log(`📦 Received:`, { 
      userId: userId ? `present (${userId.substring(0, 10)}...)` : 'missing',
      token: token ? 'present' : 'null',
      title: title ? `present (${title.substring(0, 20)}...)` : 'missing',
      body: body ? `present (${body.substring(0, 20)}...)` : 'missing'
    });

    // Basic validation
    if (!userId) {
      console.log(`❌ [${requestId}] Missing userId`);
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }
    if (!title) {
      console.log(`❌ [${requestId}] Missing title`);
      return res.status(400).json({ 
        success: false, 
        error: 'Title is required' 
      });
    }
    if (!body) {
      console.log(`❌ [${requestId}] Missing body`);
      return res.status(400).json({ 
        success: false, 
        error: 'Body is required' 
      });
    }

    console.log(`✅ [${requestId}] All validations passed`);

    // Initialize Firebase
    console.log(`🔧 [${requestId}] Step 4: Initializing Firebase`);
    let firebaseApp;
    try {
      firebaseApp = await initializeFirebase();
      console.log(`✅ [${requestId}] Firebase initialized`);
    } catch (firebaseError) {
      console.error(`❌ [${requestId}] Firebase init failed:`, firebaseError.message);
      // Continue with simulated response
      console.log(`ℹ️ [${requestId}] Using simulated mode`);
    }

    // If token is provided, save it to database
    if (token && typeof token === 'string' && token.trim().length > 0) {
      console.log(`💾 [${requestId}] Saving token to database`);
      try {
        const db = admin.database();
        const tokensRef = db.ref(`fcmTokens/${userId}`);
        const newTokenKey = tokensRef.push().key;
        
        await tokensRef.child(newTokenKey).set({
          token: token,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          platform: 'web'
        });
        
        console.log(`✅ [${requestId}] Token saved successfully`);
      } catch (dbError) {
        console.error(`❌ [${requestId}] Token save failed:`, dbError.message);
      }
    }

    // Try to send notification if Firebase is available
    let notificationResult = { success: false, message: 'No Firebase' };
    
    if (firebaseApp) {
      console.log(`📤 [${requestId}] Attempting to send notification`);
      try {
        // Get user's tokens from database
        const db = admin.database();
        const tokensRef = db.ref(`fcmTokens/${userId}`);
        const snapshot = await tokensRef.once('value');
        const tokens = snapshot.val() || {};
        
        const validTokens = Object.values(tokens)
          .filter(t => t && t.token && typeof t.token === 'string' && t.token.trim().length > 0)
          .map(t => t.token);
        
        console.log(`📱 [${requestId}] Found ${validTokens.length} valid tokens`);
        
        if (validTokens.length > 0) {
          // Send to first token (simplified)
          const message = {
            token: validTokens[0],
            notification: {
              title: title.substring(0, 100),
              body: body.substring(0, 500)
            }
          };
          
          const result = await admin.messaging().send(message);
          notificationResult = { success: true, result };
          console.log(`✅ [${requestId}] Notification sent successfully`);
        } else {
          notificationResult = { success: false, message: 'No valid tokens found' };
          console.log(`ℹ️ [${requestId}] No tokens to send notification`);
        }
      } catch (notifError) {
        console.error(`❌ [${requestId}] Notification failed:`, notifError.message);
        notificationResult = { success: false, error: notifError.message };
      }
    }

    // Success response
    const response = {
      success: true,
      data: {
        userId: userId,
        tokenSaved: !!token,
        notificationSent: notificationResult.success,
        message: notificationResult.message || 'Request processed successfully',
        requestId: requestId
      },
      message: notificationResult.success ? 
        'Notification sent successfully' : 
        'Request processed (notification not sent)'
    };

    console.log(`✅ [${requestId}] Sending success response:`, response);
    
    return res.status(200).json(response);

  } catch (error) {
    console.error(`💥 [${requestId}] UNEXPECTED ERROR:`, error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message,
      requestId: requestId
    });
  }
}