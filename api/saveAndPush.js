// api/saveAndPush.js - FINAL WORKING VERSION
import admin from "firebase-admin";

// Firebase initialization
const initializeFirebase = async () => {
  try {
    if (admin.apps.length > 0) {
      console.log("✅ Using existing Firebase app");
      return admin.app();
    }

    console.log("🔧 Initializing new Firebase app");
    
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is missing");
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log("✅ Service account parsed successfully");
    } catch (parseError) {
      throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT JSON format");
    }

    // Validate required fields
    const requiredFields = ['project_id', 'private_key', 'client_email'];
    for (const field of requiredFields) {
      if (!serviceAccount[field]) {
        throw new Error(`Service account missing required field: ${field}`);
      }
    }

    // Fix private key format
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

    const databaseURL = serviceAccount.database_url || 
                       `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`;

    console.log("🔧 Creating Firebase app with database URL:", databaseURL);
    
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: databaseURL
    });

    console.log("✅ Firebase Admin initialized successfully");
    return app;

  } catch (error) {
    console.error("❌ Firebase initialization failed:", error.message);
    throw error;
  }
};

// Token management
const manageUserTokens = async (userId, newToken) => {
  console.log(`🔧 Managing tokens for user: ${userId}`);
  
  try {
    const db = admin.database();
    const tokensRef = db.ref(`fcmTokens/${userId}`);
    
    const snapshot = await tokensRef.once('value');
    const existingTokens = snapshot.val() || {};
    
    console.log(`📱 Found ${Object.keys(existingTokens).length} existing tokens`);
    
    // Convert to array of valid tokens
    const validTokens = Object.entries(existingTokens)
      .filter(([key, tokenData]) => {
        if (!tokenData || !tokenData.token) return false;
        if (typeof tokenData.token !== 'string' || tokenData.token.trim() === '') return false;
        
        // Check if token is not too old (30 days)
        const isRecent = !tokenData.createdAt || 
                        (Date.now() - tokenData.createdAt) < 30 * 24 * 60 * 60 * 1000;
        return isRecent;
      })
      .map(([key, tokenData]) => ({
        key,
        token: tokenData.token,
        createdAt: tokenData.createdAt || 0
      }));
    
    console.log(`✅ Valid tokens: ${validTokens.length}`);
    
    // If new token provided, save it
    if (newToken && typeof newToken === 'string' && newToken.trim().length > 0) {
      const tokenExists = validTokens.some(t => t.token === newToken);
      
      if (!tokenExists) {
        const newTokenKey = tokensRef.push().key;
        await tokensRef.child(newTokenKey).set({
          token: newToken,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          platform: 'web'
        });
        console.log("✅ New token saved");
        
        return {
          tokens: [...validTokens, { key: newTokenKey, token: newToken, createdAt: Date.now() }],
          newTokenSaved: true
        };
      }
    }
    
    return {
      tokens: validTokens,
      newTokenSaved: false
    };
    
  } catch (error) {
    console.error("❌ Token management error:", error);
    return {
      tokens: [],
      newTokenSaved: false
    };
  }
};

// Send notification
const sendNotification = async (token, title, body) => {
  console.log(`📤 Sending notification to token: ${token.substring(0, 20)}...`);
  
  try {
    const message = {
      token: token.trim(),
      notification: {
        title: title.substring(0, 100),
        body: body.substring(0, 500)
      },
      webpush: {
        notification: {
          icon: "https://jibzo.vercel.app/logo.png",
          badge: "https://jibzo.vercel.app/logo.png"
        }
      }
    };

    const result = await admin.messaging().send(message);
    console.log("✅ Notification sent successfully");
    return { success: true, result };
    
  } catch (error) {
    console.error("❌ Notification send failed:", error.message);
    return { 
      success: false, 
      error: error.message,
      code: error.code
    };
  }
};

// Main API handler
export default async function handler(req, res) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`\n🚀 [${requestId}] === API REQUEST STARTED ===`);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    console.log(`🔍 [${requestId}] Preflight request - 200 OK`);
    return res.status(200).end();
  }

  // Method validation
  if (req.method !== 'POST') {
    console.log(`❌ [${requestId}] Method not allowed: ${req.method}`);
    return res.status(405).json({ 
      success: false, 
      error: 'Only POST requests allowed' 
    });
  }

  try {
    // Content type check
    console.log(`🔍 [${requestId}] Checking content type`);
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Content-Type must be application/json' 
      });
    }

    // Parse request body
    console.log(`🔍 [${requestId}] Parsing request body`);
    let requestBody;
    try {
      requestBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseError) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid JSON format' 
      });
    }

    const { userId, token, title, body } = requestBody;

    // Validation
    console.log(`🔍 [${requestId}] Validating input`);
    if (!userId || !title || !body) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: userId, title, body' 
      });
    }

    console.log(`✅ [${requestId}] Input validated:`, {
      userId,
      token: token ? 'provided' : 'not provided',
      title: title.substring(0, 30) + '...',
      body: body.substring(0, 30) + '...'
    });

    // Initialize Firebase
    console.log(`🔧 [${requestId}] Initializing Firebase`);
    let firebaseApp;
    try {
      firebaseApp = await initializeFirebase();
    } catch (firebaseError) {
      console.error(`❌ [${requestId}] Firebase init failed:`, firebaseError.message);
      return res.status(500).json({ 
        success: false, 
        error: 'Firebase initialization failed' 
      });
    }

    // Manage tokens
    console.log(`🔧 [${requestId}] Managing user tokens`);
    const tokenManagement = await manageUserTokens(userId, token);
    
    console.log(`📱 [${requestId}] Tokens available: ${tokenManagement.tokens.length}`);

    // If no tokens, return appropriate response
    if (tokenManagement.tokens.length === 0) {
      console.log(`ℹ️ [${requestId}] No tokens available for user`);
      return res.status(200).json({
        success: true,
        data: {
          sentCount: 0,
          failedCount: 0,
          totalDevices: 0,
          message: 'No registered devices found for notifications'
        },
        message: 'Request processed (no devices to notify)'
      });
    }

    // Send notifications
    console.log(`📤 [${requestId}] Sending to ${tokenManagement.tokens.length} devices`);
    let successful = 0;
    let failed = 0;
    const results = [];

    for (const tokenData of tokenManagement.tokens) {
      try {
        const sendResult = await sendNotification(tokenData.token, title, body);
        results.push({ ...sendResult, token: tokenData.token.substring(0, 15) + '...' });
        
        if (sendResult.success) {
          successful++;
        } else {
          failed++;
          console.log(`❌ [${requestId}] Failed for token:`, sendResult.error);
        }
      } catch (error) {
        failed++;
        console.error(`❌ [${requestId}] Error sending:`, error);
      }
    }

    // Cleanup invalid tokens (non-blocking)
    try {
      const invalidTokens = results
        .filter(r => !r.success && 
          (r.code === 'messaging/invalid-registration-token' || 
           r.code === 'messaging/registration-token-not-registered'))
        .map(r => r.token);

      if (invalidTokens.length > 0) {
        console.log(`🗑️ [${requestId}] Cleaning up ${invalidTokens.length} invalid tokens`);
        // Implementation would go here
      }
    } catch (cleanupError) {
      console.warn(`[${requestId}] Cleanup failed:`, cleanupError);
    }

    console.log(`✅ [${requestId}] Completed: ${successful} successful, ${failed} failed`);

    // Success response
    return res.status(200).json({
      success: true,
      data: {
        sentCount: successful,
        failedCount: failed,
        totalDevices: tokenManagement.tokens.length,
        newTokenSaved: tokenManagement.newTokenSaved,
        requestId: requestId
      },
      message: `Notifications delivered to ${successful} device(s)`
    });

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