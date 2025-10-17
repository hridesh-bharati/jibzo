const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: "Missing 'url' parameter" });
  }

  console.log('Received URL:', url);

  try {
    // Instagram specific handling
    if (url.includes('instagram.com')) {
      return handleInstagramDownload(req, res, url);
    }

    // Generic video download for other URLs
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'video/mp4,video/webm,video/*;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.instagram.com/',
      },
      timeout: 30000
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');

    console.log('Response - Status:', response.status, 'Type:', contentType, 'Size:', contentLength);

    // Check if response is HTML (blocked) or video
    if (contentType && contentType.includes('text/html')) {
      throw new Error('Instagram returned HTML page instead of video. Direct download not possible.');
    }

    const buffer = await response.buffer();
    
    if (buffer.length === 0) {
      throw new Error('Received empty response');
    }

    res.setHeader('Content-Type', contentType || 'video/mp4');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="downloaded_video.mp4"`);
    res.setHeader('Cache-Control', 'no-cache');

    res.send(buffer);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ 
      error: 'Download failed',
      message: error.message,
      type: 'SERVER_ERROR'
    });
  }
};

// Instagram specific handler
async function handleInstagramDownload(req, res, url) {
  try {
    // First, try to get the HTML page to find video URL
    const htmlResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      }
    });

    if (!htmlResponse.ok) {
      throw new Error(`Cannot access Instagram page: ${htmlResponse.status}`);
    }

    const html = await htmlResponse.text();
    
    // Try to find video URL in HTML
    const videoUrlMatch = html.match(/"video_url":"([^"]+)"/) || html.match(/<meta property="og:video" content="([^"]+)"/);
    
    if (videoUrlMatch && videoUrlMatch[1]) {
      let videoUrl = videoUrlMatch[1].replace(/\\u0026/g, '&');
      console.log('Found video URL:', videoUrl);
      
      // Download the actual video
      const videoResponse = await fetch(videoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.instagram.com/',
        }
      });

      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.status}`);
      }

      const videoBuffer = await videoResponse.buffer();
      
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', videoBuffer.length);
      res.setHeader('Content-Disposition', 'attachment; filename="instagram_video.mp4"');
      res.setHeader('Cache-Control', 'no-cache');
      
      res.send(videoBuffer);
    } else {
      throw new Error('Could not find video URL in Instagram page. The video might be private or require login.');
    }

  } catch (error) {
    console.error('Instagram download error:', error);
    res.status(500).json({ 
      error: 'Instagram download failed',
      message: error.message,
      type: 'INSTAGRAM_ERROR'
    });
  }
}