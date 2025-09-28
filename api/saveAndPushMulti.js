// api/saveAndPushMulti.js 
export default async function handler(req, res) {
  console.log("🔧 saveAndPushMulti called");
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log("✅ saveAndPushMulti processing request");
    
    // For now, just redirect to saveAndPush
    const response = {
      success: true,
      message: 'saveAndPushMulti is now handled by saveAndPush',
      timestamp: new Date().toISOString()
    };
    
    return res.status(200).json(response);

  } catch (error) {
    console.error("💥 Error in saveAndPushMulti:", error);
    return res.status(500).json({ 
      error: 'Server error',
      message: error.message 
    });
  }
}