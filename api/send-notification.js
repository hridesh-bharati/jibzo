import admin from 'firebase-admin';

// Firebase Admin Initialize with single service account
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: serviceAccount.database_url || 'https://portfolio-dfe5c-default-rtdb.firebaseio.com'
  });
}

// In-memory store for tokens
const userTokens = new Map();

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { recipientId, senderId, message, chatId, senderName, imageUrl } = req.body;

    if (!recipientId || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'recipientId and message are required' 
      });
    }

    const recipientToken = userTokens.get(recipientId);
    
    if (!recipientToken) {
      return res.status(404).json({ 
        success: false, 
        message: 'Recipient token not found' 
      });
    }

    const notification = {
      title: senderName || 'New Message',
      body: message.length > 100 ? message.substring(0, 100) + '...' : message,
      imageUrl: imageUrl || null
    };

    const messagePayload = {
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { image: notification.imageUrl })
      },
      data: {
        type: 'new_message',
        senderId: senderId || '',
        chatId: chatId || '',
        recipientId: recipientId,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        route: '/messages'
      },
      token: recipientToken,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'messages_channel'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().send(messagePayload);
    
    console.log('Notification sent successfully');
    
    return res.status(200).json({ 
      success: true, 
      message: 'Notification sent successfully'
    });

  } catch (error) {
    console.error('Error sending notification:', error);
    
    if (error.code === 'messaging/registration-token-not-registered') {
      userTokens.delete(recipientId);
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Error sending notification',
      error: error.message 
    });
  }
}