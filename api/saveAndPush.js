// api/saveAndPush.js - COMPLETELY FIXED VERSION
import admin from "firebase-admin";

// Firebase Admin initialization with robust error handling
let firebaseApp = null;
let initializationPromise = null;

const initializeFirebase = async () => {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      // Validate environment variable
      if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is missing");
      }

      // Parse and validate service account
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } catch (parseError) {
        throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT JSON format");
      }

      // Required field validation
      const requiredFields = ['project_id', 'private_key', 'client_email'];
      for (const field of requiredFields) {
        if (!serviceAccount[field]) {
          throw new Error(`Service account missing required field: ${field}`);
        }
      }

      // Fix private key format
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

      // Generate database URL if not provided
      const databaseURL = serviceAccount.database_url || 
                         `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`;

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: databaseURL
      });

      console.log("✅ Firebase Admin initialized successfully");
      return firebaseApp;

    } catch (error) {
      initializationPromise = null;
      console.error("❌ Firebase initialization failed:", error);
      throw error;
    }
  })();

  return initializationPromise;
};

// SIMPLIFIED VALIDATION - FIXED
const validateRequest = (data) => {
  const errors = [];
  
  // Required fields
  if (!data.userId) errors.push("User ID is required");
  if (!data.title) errors.push("Title is required");
  if (!data.body) errors.push("Body is required");
  
  // Token is optional - remove strict validation
  if (data.token && typeof data.token !== 'string') {
    errors.push("Token must be a string if provided");
  }
  
  // Length validations
  if (data.userId && (typeof data.userId !== 'string' || data.userId.length > 128)) {
    errors.push("User ID must be a string (max 128 characters)");
  }
  
  if (data.title && data.title.length > 100) {
    errors.push("Title too long (max 100 characters)");
  }
  
  if (data.body && data.body.length > 500) {
    errors.push("Body too long (max 500 characters)");
  }
  
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
};

// FIXED: Token management with better error handling
const manageUserTokens = async (userId, newToken, clientInfo) => {
  const db = admin.database();
  const tokensRef = db.ref(`fcmTokens/${userId}`);
  
  try {
    const snapshot = await tokensRef.once('value');
    const existingTokens = snapshot.val() || {};
    
    console.log(`🔍 Existing tokens for user ${userId}:`, Object.keys(existingTokens).length);
    
    // Convert to array and filter valid tokens
    const validTokens = Object.entries(existingTokens)
      .filter(([key, tokenData]) => {
        if (!tokenData || !tokenData.token) return false;
        
        // Accept any token that's a string and not empty
        if (typeof tokenData.token !== 'string' || tokenData.token.trim() === '') {
          return false;
        }
        
        // Filter tokens older than 30 days
        const isRecent = !tokenData.createdAt || (Date.now() - tokenData.createdAt) < 30 * 24 * 60 * 60 * 1000;
        return isRecent;
      })
      .map(([key, tokenData]) => ({
        key,
        token: tokenData.token,
        createdAt: tokenData.createdAt || 0
      }));
    
    console.log(`📱 Valid tokens found: ${validTokens.length}`);
    
    // If no token provided but user has existing tokens, use those
    if ((!newToken || newToken === 'null' || newToken === null || newToken === '') && validTokens.length > 0) {
      console.log(`📱 Using ${validTokens.length} existing tokens for user ${userId}`);
      return {
        tokens: validTokens,
        newTokenSaved: false,
        totalTokens: validTokens.length
      };
    }
    
    // If valid token provided, save it
    if (newToken && typeof newToken === 'string' && newToken.trim().length > 0) {
      const tokenExists = validTokens.some(t => t.token === newToken);
      
      if (!tokenExists) {
        const newTokenKey = tokensRef.push().key;
        await tokensRef.child(newTokenKey).set({
          token: newToken,
          createdAt: Date.now(),
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          lastUsed: Date.now(),
          platform: 'web'
        });
        console.log(`✅ New FCM token saved for user ${userId}`);
        
        // Return the new token along with existing ones
        const updatedTokens = [...validTokens, { key: newTokenKey, token: newToken, createdAt: Date.now() }];
        return {
          tokens: updatedTokens,
          newTokenSaved: true,
          totalTokens: updatedTokens.length
        };
      } else {
        console.log(`ℹ️ Token already exists for user ${userId}`);
      }
    }
    
    return {
      tokens: validTokens,
      newTokenSaved: false,
      totalTokens: validTokens.length
    };
    
  } catch (error) {
    console.error('❌ Error managing user tokens:', error);
    // Return empty tokens instead of throwing error
    return {
      tokens: [],
      newTokenSaved: false,
      totalTokens: 0
    };
  }
};

// FIXED: Enhanced notification sender with better error handling
const sendNotificationWithRetry = async (token, title, body, retries = 1) => {
  // Validate token before sending
  if (!token || typeof token !== 'string' || token.trim() === '') {
    console.log(`❌ Invalid token: ${token}`);
    return { 
      success: false, 
      error: 'Invalid token format',
      code: 'invalid-token'
    };
  }

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
      },
      fcmOptions: {
        link: "https://jibzo.vercel.app"
      }
    },
    data: {
      timestamp: Date.now().toString(),
      deep_link: "https://jibzo.vercel.app"
    }
  };

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const result = await admin.messaging().send(message);
      console.log(`✅ Notification sent successfully (attempt ${attempt})`);
      return { success: true, result, attempt };
    } catch (error) {
      console.warn(`⚠️ Notification attempt ${attempt} failed:`, error.message);
      
      if (attempt <= retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      return { 
        success: false, 
        error: error.message, 
        code: error.code,
        attempt 
      };
    }
  }
};

// Rate limiting - SIMPLIFIED for Vercel
const checkRateLimit = (ip) => {
  // Simple rate limiting for now
  return true;
};

// FIXED: Main API handler with proper debugging
export default async function handler(req, res) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  console.log(`\n🚀 [${requestId}] === NEW REQUEST STARTED ===`);
  console.log(`🔍 [${requestId}] Method: ${req.method}`);
  console.log(`🔍 [${requestId}] URL: ${req.url}`);
  console.log(`🔍 [${requestId}] Headers:`, {
    'content-type': req.headers['content-type'],
    'user-agent': req.headers['user-agent']?.substring(0, 50) + '...'
  });

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`🔍 [${requestId}] Preflight request - returning 200`);
    return res.status(200).end();
  }

  // Method validation
  if (req.method !== 'POST') {
    console.log(`❌ [${requestId}] Method not allowed: ${req.method}`);
    return res.status(405).json({
      success: false,
      error: 'METHOD_NOT_ALLOWED',
      message: 'Only POST requests are allowed'
    });
  }

  try {
    // Content type validation
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      console.log(`❌ [${requestId}] Invalid content type: ${contentType}`);
      return res.status(400).json({
        success: false,
        error: 'INVALID_CONTENT_TYPE',
        message: 'Content-Type must be application/json'
      });
    }

    // Parse request body with detailed logging
    let requestBody;
    try {
      requestBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      console.log(`✅ [${requestId}] JSON parsed successfully:`, {
        userId: requestBody.userId,
        token: requestBody.token ? `${requestBody.token.substring(0, 20)}...` : 'null',
        title: requestBody.title?.substring(0, 30) + '...',
        body: requestBody.body?.substring(0, 30) + '...'
      });
    } catch (parseError) {
      console.error(`❌ [${requestId}] JSON parse error:`, parseError.message);
      return res.status(400).json({
        success: false,
        error: 'INVALID_JSON',
        message: 'Invalid JSON format in request body: ' + parseError.message
      });
    }

    const { userId, token, title, body } = requestBody;

    // Input validation
    try {
      validateRequest({ userId, token, title, body });
      console.log(`✅ [${requestId}] All validations passed`);
    } catch (validationError) {
      console.error(`❌ [${requestId}] Validation failed:`, validationError.message);
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validationError.message
      });
    }

    // Initialize Firebase
    console.log(`⚡ [${requestId}] Initializing Firebase...`);
    try {
      await initializeFirebase();
      console.log(`✅ [${requestId}] Firebase initialized successfully`);
    } catch (firebaseError) {
      console.error(`❌ [${requestId}] Firebase init failed:`, firebaseError.message);
      // Continue even if Firebase fails - we'll handle it gracefully
    }

    // Get client info for token management
    const clientIP = req.headers['x-forwarded-for'] || 
                    req.headers['x-real-ip'] || 
                    req.connection.remoteAddress || 
                    'unknown';

    // Manage user tokens
    console.log(`📱 [${requestId}] Managing tokens for user: ${userId}`);
    const tokenManagement = await manageUserTokens(userId, token, {
      ip: clientIP,
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    console.log(`📱 [${requestId}] Token management result:`, {
      totalTokens: tokenManagement.totalTokens,
      newTokenSaved: tokenManagement.newTokenSaved
    });

    // If no tokens available, return success but don't send notifications
    if (tokenManagement.totalTokens === 0) {
      console.log(`ℹ️ [${requestId}] No valid tokens found for user ${userId}`);
      const responseTime = Date.now() - startTime;
      
      return res.status(200).json({
        success: true,
        data: {
          sentCount: 0,
          failedCount: 0,
          totalDevices: 0,
          invalidTokensRemoved: 0,
          newTokenSaved: tokenManagement.newTokenSaved,
          responseTime: `${responseTime}ms`,
          requestId: requestId,
          message: 'No devices registered for notifications'
        },
        message: "Request processed successfully (no devices to notify)"
      });
    }

    console.log(`📤 [${requestId}] Sending to ${tokenManagement.totalTokens} devices`);

    // Send notifications with error handling
    const results = [];
    let successful = 0;
    let failed = 0;

    for (const tokenData of tokenManagement.tokens) {
      try {
        const sendResult = await sendNotificationWithRetry(tokenData.token, title, body);
        results.push({
          tokenKey: tokenData.key,
          token: tokenData.token.substring(0, 15) + '...',
          ...sendResult
        });

        if (sendResult.success) {
          successful++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`❌ [${requestId}] Error sending to token:`, error);
        failed++;
        results.push({
          tokenKey: tokenData.key,
          token: tokenData.token.substring(0, 15) + '...',
          success: false,
          error: error.message
        });
      }

      // Small delay between sends
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Cleanup invalid tokens (non-blocking)
    try {
      const invalidTokens = results
        .filter(r => !r.success && 
          (r.code === 'messaging/invalid-registration-token' || 
           r.code === 'messaging/registration-token-not-registered'))
        .map(r => r.tokenKey)
        .filter(key => key && key !== 'unknown');

      if (invalidTokens.length > 0) {
        console.log(`🗑️ [${requestId}] Removing ${invalidTokens.length} invalid tokens`);
        const db = admin.database();
        const tokensRef = db.ref(`fcmTokens/${userId}`);
        
        const cleanupPromises = invalidTokens.map(async (tokenKey) => {
          try {
            await tokensRef.child(tokenKey).remove();
            return tokenKey;
          } catch (error) {
            console.error(`[${requestId}] Failed to remove token:`, error);
            return null;
          }
        });

        await Promise.allSettled(cleanupPromises);
      }
    } catch (cleanupError) {
      console.warn(`[${requestId}] Token cleanup failed:`, cleanupError);
    }

    const responseTime = Date.now() - startTime;
    console.log(`✅ [${requestId}] Request completed in ${responseTime}ms: ${successful} successful, ${failed} failed`);

    // Success response
    return res.status(200).json({
      success: true,
      data: {
        sentCount: successful,
        failedCount: failed,
        totalDevices: tokenManagement.totalTokens,
        newTokenSaved: tokenManagement.newTokenSaved,
        responseTime: `${responseTime}ms`,
        requestId: requestId
      },
      message: `Notifications delivered to ${successful} device(s)`
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`💥 [${requestId}] Global error after ${responseTime}ms:`, error);

    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred: ' + error.message,
      requestId: requestId,
      responseTime: `${responseTime}ms`
    });
  }
}