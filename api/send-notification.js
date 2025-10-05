import admin from 'firebase-admin';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://portfolio-dfe5c-default-rtdb.firebaseio.com'
  });
}

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
    const { recipientId, senderId, message, chatId, senderName } = req.body;

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

    // Instagram jaise notification payload
    const messagePayload = {
      notification: {
        title: `💬 ${senderName || 'Someone'}`,
        body: message.length > 50 ? message.substring(0, 50) + '...' : message,
        icon: '/logo.png',
        image: '/logo.png',
        click_action: 'https://your-app.vercel.app'
      },
      data: {
        type: 'new_message',
        senderId: senderId || '',
        chatId: chatId || '',
        recipientId: recipientId,
        url: `/messages/${senderId}`,
        timestamp: new Date().toISOString()
      },
      token: recipientToken,
      webpush: {
        headers: {
          Urgency: 'high'
        },
        notification: {
          requireInteraction: true,
          badge: '/logo.png',
          icon: '/logo.png',
          actions: [
            {
              action: 'open',
              title: 'Open Chat'
            }
          ]
        },
        fcm_options: {
          link: `https://your-app.vercel.app/messages/${senderId}`
        }
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channel_id: 'messages_channel',
          click_action: 'OPEN_CHAT'
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
      }
    };

    const response = await admin.messaging().send(messagePayload);
    
    console.log('✅ Notification sent successfully to:', recipientId);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Notification sent successfully'
    });

  } catch (error) {
    console.error('❌ Error sending notification:', error);
    
    if (error.code === 'messaging/registration-token-not-registered') {
      userTokens.delete(recipientId);
      console.log(`🗑️ Removed invalid token for user: ${recipientId}`);
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Error sending notification',
      error: error.message 
    });
  }
}