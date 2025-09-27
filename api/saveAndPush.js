// api/saveAndPush.js - FIXED VERSION
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

// Input validation with detailed error messages
const validateRequest = (data) => {
  const errors = [];
  
  if (!data.userId) errors.push("User ID is required");
  if (!data.title) errors.push("Title is required");
  if (!data.body) errors.push("Body is required");
  
  if (data.userId && (typeof data.userId !== 'string' || data.userId.length > 128)) {
    errors.push("User ID must be a string (max 128 characters)");
  }
  
  if (data.title && data.title.length > 100) {
    errors.push("Title too long (max 100 characters)");
  }
  
  if (data.body && data.body.length > 500) {
    errors.push("Body too long (max 500 characters)");
  }
  
  if (data.token && (typeof data.token !== 'string' || !data.token.startsWith('fcm'))) {
    errors.push("Invalid FCM token format");
  }
  
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
};

// Token management with deduplication
const manageUserTokens = async (userId, newToken, clientInfo) => {
  const db = admin.database();
  const tokensRef = db.ref(`fcmTokens/${userId}`);
  
  try {
    const snapshot = await tokensRef.once('value');
    const existingTokens = snapshot.val() || {};
    
    // Convert to array and filter valid tokens
    const validTokens = Object.entries(existingTokens)
      .filter(([key, tokenData]) => 
        tokenData && 
        tokenData.token && 
        tokenData.token.startsWith('fcm') &&
        // Filter tokens older than 30 days
        (!tokenData.createdAt || (Date.now() - tokenData.createdAt) < 30 * 24 * 60 * 60 * 1000)
      )
      .map(([key, tokenData]) => ({
        key,
        token: tokenData.token,
        createdAt: tokenData.createdAt || 0
      }));
    
    // Remove duplicates (keep newest)
    const tokenMap = new Map();
    validTokens.forEach(({ key, token, createdAt }) => {
      if (!tokenMap.has(token) || createdAt > tokenMap.get(token).createdAt) {
        tokenMap.set(token, { key, createdAt });
      }
    });
    
    const uniqueTokens = Array.from(tokenMap.entries()).map(([token, data]) => ({
      token,
      key: data.key
    }));
    
    // Save new token if provided and not exists
    let newTokenSaved = false;
    if (newToken && newToken.startsWith('fcm')) {
      const tokenExists = uniqueTokens.some(t => t.token === newToken);
      
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
        newTokenSaved = true;
        console.log(`✅ New FCM token saved for user ${userId}`);
      }
    }
    
    return {
      tokens: uniqueTokens,
      newTokenSaved,
      totalTokens: uniqueTokens.length
    };
    
  } catch (error) {
    console.error('Error managing user tokens:', error);
    throw new Error('Failed to manage user tokens');
  }
};

// Enhanced notification sender with retry logic
const sendNotificationWithRetry = async (token, title, body, retries = 2) => {
  const message = {
    token: token.trim(),
    notification: {
      title: title.substring(0, 100),
      body: body.substring(0, 500)
    },
    webpush: {
      notification: {
        icon: "https://jibzo.vercel.app/logo.png",
        badge: "https://jibzo.vercel.app/logo.png",
        image: "https://jibzo.vercel.app/logo.png",
        actions: [
          {
            action: 'open',
            title: 'Open App'
          }
        ]
      },
      fcmOptions: {
        link: "https://jibzo.vercel.app"
      }
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title: title.substring(0, 100),
            body: body.substring(0, 500)
          },
          sound: "default",
          badge: 1
        }
      }
    },
    android: {
      notification: {
        sound: "default",
        channel_id: "default",
        icon: "ic_notification",
        color: "#FF0000",
        click_action: "OPEN_APP"
      }
    },
    data: {
      click_action: "OPEN_APP",
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
        // Wait before retry (exponential backoff)
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

// Rate limiting with improved algorithm
const rateLimitMap = new Map();
const RATE_LIMIT_CONFIG = {
  MAX_REQUESTS: 100,
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  CLEANUP_INTERVAL: 60 * 1000 // Clean every minute
};

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const validTimestamps = timestamps.filter(time => now - time < RATE_LIMIT_CONFIG.WINDOW_MS);
    if (validTimestamps.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, validTimestamps);
    }
  }
}, RATE_LIMIT_CONFIG.CLEANUP_INTERVAL);

const checkRateLimit = (ip) => {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_CONFIG.WINDOW_MS;

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }

  const requests = rateLimitMap.get(ip).filter(time => time > windowStart);
  
  if (requests.length >= RATE_LIMIT_CONFIG.MAX_REQUESTS) {
    return false;
  }

  requests.push(now);
  rateLimitMap.set(ip, requests);
  return true;
};

// Main API handler
export default async function handler(req, res) {
  // ✅ FIXED: Declare missing variables at the top
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  // Set response headers
  res.setHeader('Access-Control-Allow-Origin', 'https://jibzo.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Method validation
  if (req.method !== 'POST') {
    // ✅ FIXED: Consistent response format
    return res.status(405).json({
      success: false,
      error: 'METHOD_NOT_ALLOWED',
      message: 'Only POST requests are allowed'
    });
  }

  try {
    console.log(`🚀 [${requestId}] Notification request started`);

    // Rate limiting
    const clientIP = req.headers['x-forwarded-for'] || 
                    req.headers['x-real-ip'] || 
                    req.connection.remoteAddress || 
                    'unknown';

    if (!checkRateLimit(clientIP)) {
      console.warn(`⏰ [${requestId}] Rate limit exceeded for IP: ${clientIP}`);
      // ✅ FIXED: Consistent response format
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.'
      });
    }

    // Content type validation
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      // ✅ FIXED: Consistent response format
      return res.status(400).json({
        success: false,
        error: 'INVALID_CONTENT_TYPE',
        message: 'Content-Type must be application/json'
      });
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseError) {
      // ✅ FIXED: Consistent response format
      return res.status(400).json({
        success: false,
        error: 'INVALID_JSON',
        message: 'Invalid JSON format in request body'
      });
    }

    const { userId, token, title, body } = requestBody;

    // Input validation
    try {
      validateRequest({ userId, token, title, body });
    } catch (validationError) {
      // ✅ FIXED: Consistent response format
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validationError.message
      });
    }

    // Initialize Firebase
    console.log(`⚡ [${requestId}] Initializing Firebase...`);
    await initializeFirebase();

    // Manage user tokens
    const tokenManagement = await manageUserTokens(userId, token, {
      ip: clientIP,
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    if (tokenManagement.totalTokens === 0) {
      // ✅ FIXED: Consistent response format
      return res.status(400).json({
        success: false,
        error: 'NO_VALID_TOKENS',
        message: 'No valid device tokens found for this user'
      });
    }

    console.log(`📱 [${requestId}] Sending to ${tokenManagement.totalTokens} devices`);

    // Send notifications in batches with concurrency control
    const BATCH_SIZE = 10;
    const results = [];

    for (let i = 0; i < tokenManagement.tokens.length; i += BATCH_SIZE) {
      const batch = tokenManagement.tokens.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (tokenData) => {
        const sendResult = await sendNotificationWithRetry(tokenData.token, title, body);
        
        return {
          tokenKey: tokenData.key,
          token: tokenData.token.substring(0, 15) + '...',
          ...sendResult
        };
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults.map(result => 
        result.status === 'fulfilled' ? result.value : {
          tokenKey: 'unknown',
          token: 'unknown',
          success: false,
          error: result.reason?.message || 'Unknown error'
        }
      ));

      // Brief pause between batches
      if (i + BATCH_SIZE < tokenManagement.tokens.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Analyze results
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    // Cleanup invalid tokens
    const invalidTokens = results
      .filter(r => !r.success && 
        (r.code === 'messaging/invalid-registration-token' || 
         r.code === 'messaging/registration-token-not-registered'))
      .map(r => r.tokenKey)
      .filter(key => key && key !== 'unknown');

    if (invalidTokens.length > 0) {
      const db = admin.database();
      const tokensRef = db.ref(`fcmTokens/${userId}`);
      
      const cleanupPromises = invalidTokens.map(async (tokenKey) => {
        try {
          await tokensRef.child(tokenKey).remove();
          console.log(`🗑️ [${requestId}] Removed invalid token: ${tokenKey}`);
          return tokenKey;
        } catch (error) {
          console.error(`[${requestId}] Failed to remove token:`, error);
          return null;
        }
      });

      await Promise.allSettled(cleanupPromises);
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
        invalidTokensRemoved: invalidTokens.length,
        newTokenSaved: tokenManagement.newTokenSaved,
        responseTime: `${responseTime}ms`,
        requestId: requestId
      },
      message: `Notifications delivered to ${successful} device(s)`
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`❌ [${requestId}] Request failed after ${responseTime}ms:`, error);

    // Error response mapping
    const errorMap = {
      'Validation failed': { status: 400, code: 'VALIDATION_ERROR' },
      'FIREBASE_SERVICE_ACCOUNT': { status: 500, code: 'CONFIGURATION_ERROR' },
      'Invalid FIREBASE_SERVICE_ACCOUNT': { status: 500, code: 'CONFIGURATION_ERROR' },
      'Service account': { status: 500, code: 'CONFIGURATION_ERROR' },
      'Failed to manage user tokens': { status: 500, code: 'DATABASE_ERROR' }
    };

    const matchedError = Object.entries(errorMap).find(([key]) => 
      error.message.includes(key)
    );

    const errorInfo = matchedError ? matchedError[1] : { status: 500, code: 'INTERNAL_ERROR' };

    // ✅ FIXED: Consistent error response format
    return res.status(errorInfo.status).json({
      success: false,
      error: errorInfo.code,
      message: error.message || 'An unexpected error occurred',
      requestId: requestId,
      responseTime: `${responseTime}ms`
    });
  }
}