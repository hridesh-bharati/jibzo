import React, { useState } from "react";

export default function VideoDownloader() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleDownload = async () => {
    if (!url.trim()) {
      setError("❌ Please enter a video URL");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      console.log('🔄 Starting download...');
      
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      console.log('🔗 API URL:', proxyUrl);

      const response = await fetch(proxyUrl);
      
      // Check if response is JSON error
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Download failed');
      }

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error("Received empty file");
      }

      // Create download link
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "video.mp4";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      setSuccess(`✅ Video downloaded successfully! (${formatFileSize(blob.size)})`);

    } catch (err) {
      console.error('❌ Download error:', err);
      setError(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={{ padding: "2rem", textAlign: "center", maxWidth: "600px", margin: "0 auto" }}>
      <h2>🎬 Universal Video Downloader</h2>
      
      <input
        type="text"
        placeholder="Paste any video URL here..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        style={{ 
          width: "100%", 
          padding: "1rem", 
          margin: "1rem 0",
          border: error ? "2px solid #dc3545" : success ? "2px solid #28a745" : "2px solid #007bff",
          borderRadius: "8px",
          fontSize: "16px"
        }}
      />
      
      <button 
        onClick={handleDownload} 
        disabled={loading}
        style={{ 
          padding: "1rem 2rem",
          fontSize: "16px",
          backgroundColor: loading ? "#6c757d" : "#007bff",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: loading ? "not-allowed" : "pointer",
          width: "100%"
        }}
      >
        {loading ? "⏳ Downloading..." : "⬇️ Download Video"}
      </button>
      
      {error && (
        <div style={{ 
          color: "#dc3545", 
          marginTop: "1rem",
          padding: "1rem",
          backgroundColor: "#f8d7da",
          borderRadius: "8px",
          border: "1px solid #dc3545"
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {success && (
        <div style={{ 
          color: "#155724", 
          marginTop: "1rem",
          padding: "1rem",
          backgroundColor: "#d4edda",
          borderRadius: "8px",
          border: "1px solid #28a745"
        }}>
          <strong>Success:</strong> {success}
        </div>
      )}

      <div style={{ 
        marginTop: "2rem", 
        fontSize: "0.9rem", 
        color: "#666",
        textAlign: "left",
        padding: "1rem",
        backgroundColor: "#f8f9fa",
        borderRadius: "8px"
      }}>
        <strong>Supported URLs:</strong>
        <ul style={{ paddingLeft: "1.5rem", margin: "0.5rem 0" }}>
          <li>Direct video links (.mp4, .webm, .ogg)</li>
          <li>CDN video URLs</li>
          <li>Cloud storage videos</li>
        </ul>
        <strong>Note:</strong> Some platforms like Instagram, YouTube may not work due to restrictions.
      </div>
    </div>
  );
}