import React, { useState } from "react";

export default function VideoDownloader() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!url.trim()) return alert("Please enter a video URL");
    setLoading(true);

    try {
      const response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "video.mp4";
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error(err);
      alert("Error downloading video!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "1rem", textAlign: "center" }}>
      <h3>Video Downloader</h3>
      <input
        type="text"
        placeholder="Paste video URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        style={{ width: "80%", padding: "0.5rem", margin: "1rem 0" }}
      />
      <button onClick={handleDownload} disabled={loading}>
        {loading ? "Downloading..." : "Download Video"}
      </button>
    </div>
  );
}
