import axios from "axios";

const CLIENT_ID = process.env.MUSIC_CLIENT_ID;
const CLIENT_SECRET = process.env.MUSIC_CLIENT_SECRET;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  try {
    // Get Spotify access token
    const tokenRes = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({ grant_type: "client_credentials" }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
            "base64"
          )}`,
        },
      }
    );

    const accessToken = tokenRes.data.access_token;

    // Fetch playlist tracks
    const playlistRes = await axios.get(
      "https://api.spotify.com/v1/playlists/37i9dQZF1DX4WYpdgoIcn6/tracks",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const songs = playlistRes.data.items.map((item, index) => ({
      id: index + 1,
      name: item.track.name,
      artist: item.track.artists.map((a) => a.name).join(", "),
      preview_url: item.track.preview_url,
      image: item.track.album.images[0]?.url || "",
    }));

    res.status(200).json(songs);
  } catch (err) {
    console.error("Spotify API error:", err.message);
    res.status(500).json({ error: "Failed to fetch songs" });
  }
}
