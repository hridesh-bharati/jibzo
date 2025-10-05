// api/send-notification.js
import admin from 'firebase-admin';

// Firebase Admin initialization
const serviceAccount = {
  type: "service_account",
  project_id: "portfolio-dfe5c",
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
};

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://portfolio-dfe5c-default-rtdb.firebaseio.com'
    });
    console.log('✅ Firebase Admin initialized');
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error);
  }
}

// In-memory store for tokens (production mein database use karein)
const userTokens = new Map();

export default async function handler(req, res) {
  // CORS headers - Mobile support ke liye
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Production mein specific domain daalein
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  try {
    const { recipientId, senderId, message, chatId, senderName, imageUrl } = req.body;

    console.log('📨 Received notification request:', { 
      recipientId, 
      senderId, 
      message: message?.substring(0, 50) + '...',
      chatId,
      senderName 
    });

    // Validation
    if (!recipientId || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'recipientId and message are required' 
      });
    }

    // Get token from database (temporary in-memory store)
    const recipientToken = userTokens.get(recipientId);
    
    if (!recipientToken) {
      console.log('❌ Token not found for user:', recipientId);
      return res.status(404).json({ 
        success: false, 
        message: 'Recipient token not found. User might not have enabled notifications.' 
      });
    }

    console.log('✅ Token found for user:', recipientId);

    // Mobile & web compatible notification payload
    const messagePayload = {
      notification: {
        title: `💬 ${senderName || 'Someone'}`,
        body: message.length > 100 ? message.substring(0, 100) + '...' : message,
        icon: '/logo.png',
        image: imageUrl || '/logo.png'
      },
      data: {
        type: 'new_message',
        senderId: senderId || '',
        chatId: chatId || '',
        recipientId: recipientId,
        message: message,
        senderName: senderName || 'Someone',
        imageUrl: imageUrl || '',
        timestamp: new Date().toISOString(),
        click_action: 'OPEN_CHAT' // Important for mobile
      },
      token: recipientToken,
      webpush: {
        headers: {
          Urgency: 'high'
        },
        notification: {
          requireInteraction: false,
          badge: '/logo.png',
          icon: '/logo.png',
          vibrate: [200, 100, 200],
          actions: [
            {
              action: 'open',
              title: '💬 Open Chat'
            }
          ]
        },
        fcm_options: {
          link: `https://your-app.vercel.app/messages/${senderId}`
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'mutable-content': 1
          }
        }
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channel_id: 'messages_channel',
          icon: 'ic_notification',
          click_action: 'OPEN_CHAT'
        }
      }
    };

    console.log('🚀 Sending FCM message...');
    const response = await admin.messaging().send(messagePayload);
    
    console.log('✅ Notification sent successfully to:', recipientId);
    console.log('📱 Message ID:', response);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Notification sent successfully',
      messageId: response
    });

  } catch (error) {
    console.error('❌ Error sending notification:', error);
    
    // Specific error handling
    if (error.code === 'messaging/registration-token-not-registered') {
      userTokens.delete(recipientId);
      console.log(`🗑️ Removed invalid token for user: ${recipientId}`);
      
      return res.status(410).json({ 
        success: false, 
        message: 'Token expired. Please login again.' 
      });
    }
    
    if (error.code === 'messaging/invalid-argument') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid token format' 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Error sending notification',
      error: error.message,
      code: error.code 
    });
  }
}