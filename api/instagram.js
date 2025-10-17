export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter missing' });
  }

  try {
    // Instagram HTML fetch karo
    const response = await fetch(url);
    const html = await response.text();

    // Video URL extract karo
    const videoUrlMatch = html.match(/"video_url":"([^"]+)"/) || 
                         html.match(/"contentUrl":"([^"]+)"/) ||
                         html.match(/<meta property="og:video" content="([^"]+)"/);

    if (videoUrlMatch && videoUrlMatch[1]) {
      let videoUrl = videoUrlMatch[1].replace(/\\u0026/g, '&');
      
      // Video download karo
      const videoResponse = await fetch(videoUrl);
      const videoBuffer = await videoResponse.arrayBuffer();
      
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', 'attachment; filename="instagram_video.mp4"');
      res.send(Buffer.from(videoBuffer));
    } else {
      throw new Error('Video URL not found');
    }

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to download video', details: error.message });
  }
}