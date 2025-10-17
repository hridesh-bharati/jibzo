export default async function handler(req, res) {
  res.json({ 
    message: '✅ Universal Video Downloader API is working!',
    status: 'active',
    timestamp: new Date().toISOString(),
    features: [
      'Supports YouTube, Vimeo, Facebook, Twitter, Instagram',
      'Supports direct video links (.mp4, .webm, .ogg)',
      'Automatic filename detection',
      'CORS enabled'
    ]
  });
}