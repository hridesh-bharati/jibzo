// api/proxy.js - Updated version
export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).send("Missing 'url' parameter");

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'video/mp4,video/webm,video/*;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Sec-Fetch-Dest': 'video',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site',
      },
      referrer: 'https://www.instagram.com/',
    });

    if (!response.ok) {
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers));
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);

    if (!contentType || !contentType.includes('video')) {
      // If we get HTML instead of video, Instagram is blocking us
      throw new Error('Instagram blocked the request. Got HTML instead of video.');
    }

    const arrayBuffer = await response.arrayBuffer();
    
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", arrayBuffer.byteLength);
    res.setHeader("Content-Disposition", "attachment; filename=instagram_video.mp4");
    res.setHeader("Cache-Control", "no-cache");
    
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ 
      error: "Proxy error: " + err.message,
      details: "Instagram may be blocking this request. Try a different approach."
    });
  }
}