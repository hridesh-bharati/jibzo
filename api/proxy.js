// api/proxy.js
export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).send("Missing 'url' parameter");

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch video");

    const arrayBuffer = await response.arrayBuffer();
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", "attachment; filename=video.mp4");
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(500).send("Proxy error: " + err.message);
  }
}
