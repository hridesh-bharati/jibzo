// api/save-token.js
// In-memory store for tokens
const userTokens = new Map();

export default async function handler(req, res) {
  // CORS headers - Mobile support
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
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
    const { userId, fcmToken } = req.body;
    
    console.log('💾 Saving token for user:', userId);
    
    if (userId && fcmToken) {
      userTokens.set(userId, fcmToken);
      console.log(`✅ Token saved for user: ${userId}`);
      console.log(`📊 Total tokens stored: ${userTokens.size}`);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Token saved successfully',
        tokensCount: userTokens.size,
        userId: userId
      });
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'userId and fcmToken are required' 
      });
    }
  } catch (error) {
    console.error('❌ Error saving token:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
}