import fetch from 'node-fetch';

export default async function handler(req, res) {
  console.log('🚀 Video Downloader API Called');
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Only GET method allowed' });
  }

  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: "Video URL parameter missing" });
  }

  console.log('🎯 Downloading:', url);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'video/mp4,video/webm,video/*;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.google.com/'
      }
    });

    console.log('📊 Response Status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.buffer();
    
    if (buffer.length === 0) {
      throw new Error('Received empty response');
    }

    // Determine filename
    let filename = 'video.mp4';
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const lastPart = pathname.split('/').pop();
      if (lastPart && lastPart.includes('.')) {
        filename = lastPart;
      }
    } catch (e) {
      // Use default filename
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    res.send(buffer);

  } catch (error) {
    console.error('❌ Download Error:', error);
    res.status(500).json({ 
      error: 'Video download failed',
      message: error.message,
      suggestion: 'Try a direct video URL or check if the video is accessible'
    });
  }
}