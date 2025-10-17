// Updated VideoDownloader.jsx
import React, { useState } from "react";

export default function VideoDownloader() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDownload = async () => {
    if (!url.trim()) {
      setError("Please enter a video URL");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Validate Instagram URL
      if (!url.includes('instagram.com')) {
        throw new Error("Please enter a valid Instagram URL");
      }

      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      console.log('Fetching from:', proxyUrl);

      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server response:', response.status, errorText);
        
        if (response.status === 404) {
          throw new Error("Video not found or URL is invalid");
        } else if (response.status === 500) {
          throw new Error("Server error - Instagram may be blocking the request");
        } else {
          throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }
      }

      const contentType = response.headers.get('content-type');
      console.log('Received Content-Type:', contentType);

      if (contentType && contentType.includes('application/json')) {
        // Handle JSON error response
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || 'Unknown error');
      }

      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error("Received empty file");
      }

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "instagram_video.mp4";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

    } catch (err) {
      console.error("Download error:", err);
      setError(err.message || "Error downloading video!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "1rem", textAlign: "center" }}>
      <h3>Instagram Video Downloader</h3>
      <input
        type="text"
        placeholder="Paste Instagram video URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        style={{ 
          width: "80%", 
          padding: "0.5rem", 
          margin: "1rem 0",
          border: error ? "1px solid red" : "1px solid #ccc"
        }}
      />
      <br />
      <button 
        onClick={handleDownload} 
        disabled={loading}
        style={{ padding: "0.5rem 1rem" }}
      >
        {loading ? "Downloading..." : "Download Video"}
      </button>
      
      {error && (
        <div style={{ 
          color: "red", 
          marginTop: "1rem",
          padding: "0.5rem",
          backgroundColor: "#ffe6e6",
          borderRadius: "4px"
        }}>
          {error}
        </div>
      )}
      
      <div style={{ 
        marginTop: "1rem", 
        fontSize: "0.8rem", 
        color: "#666",
        textAlign: "left",
        maxWidth: "400px",
        margin: "1rem auto"
      }}>
      </div>
    </div>
  );
}