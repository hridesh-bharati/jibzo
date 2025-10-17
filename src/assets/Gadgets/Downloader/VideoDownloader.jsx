import React, { useState } from "react";
import { db } from "../../utils/firebaseConfig";
import { ref, set, get } from "firebase/database";

export default function UniversalDownloader() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Update download count
  const updateDownloadCount = async (platform) => {
    try {
      const countRef = ref(db, `downloadStats/${platform}/count`);
      const snapshot = await get(countRef);
      const currentCount = snapshot.exists() ? snapshot.val() : 0;
      await set(countRef, currentCount + 1);
    } catch (error) {
      console.error("Error updating download count:", error);
    }
  };

  // Direct download function
  const handleDownload = async () => {
    if (!url.trim()) {
      setError("❌ Please enter a video URL");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      let downloadUrl = url;
      let platform = "Direct";

      // Instagram - Use our API
      if (url.includes('instagram.com')) {
        platform = "Instagram";
        downloadUrl = `/api/instagram?url=${encodeURIComponent(url)}`;
      }
      // Direct video files
      else if (url.includes('.mp4') || url.includes('.webm') || url.includes('.ogg')) {
        platform = "Direct Video";
        // Direct download works
      }
      // Other platforms - show message
      else if (url.includes('youtube.com') || url.includes('tiktok.com') || url.includes('facebook.com')) {
        throw new Error(`Use VidMate app for ${platform} downloads`);
      }
      else {
        throw new Error("Unsupported URL format");
      }

      console.log(`📱 Downloading from: ${platform}`);
      console.log(`🔗 Download URL: ${downloadUrl}`);

      // Download the video
      const response = await fetch(downloadUrl);
      
      // Handle JSON errors
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || 'Download failed');
      }

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error("Received empty file");
      }

      // Create download
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `video_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      // Update Firebase stats
      await updateDownloadCount(platform);
      
      setSuccess(`✅ ${platform} video downloaded successfully! (${formatFileSize(blob.size)})`);
      setUrl("");

    } catch (err) {
      console.error("❌ Download error:", err);
      
      if (err.message.includes("VidMate")) {
        setError(`❌ ${err.message}`);
      } else if (url.includes('instagram.com')) {
        setError(`❌ Instagram download failed. Try these:
        • Use Instagram mobile app
        • Try different Instagram URL
        • Use Instagram downloader apps`);
      } else {
        setError(`❌ Download failed: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Working URLs
  const sampleUrls = [
    { 
      name: "Test MP4", 
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
    },
    { 
      name: "Test WebM", 
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.webm"
    },
    { 
      name: "Instagram Test", 
      url: "https://www.instagram.com/reel/Cx9J8kioe6P/"
    }
  ];

  return (
    <div className="container-fluid py-4" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-primary mb-2">
          <i className="bi bi-download me-2"></i>
          Direct Video Downloader
        </h1>
        <p className="text-muted">No external sites - Direct downloads only</p>
      </div>

      {/* Main Download Card */}
      <div className="card shadow-lg border-0">
        <div className="card-body p-4">
          {/* URL Input */}
          <div className="mb-3">
            <label className="form-label fw-bold">Paste Video URL</label>
            <div className="input-group">
              <input
                type="text"
                className="form-control form-control-lg"
                placeholder="Paste Instagram URL or direct video link..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button 
                className="btn btn-primary px-4"
                onClick={handleDownload}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <i className="bi bi-download me-2"></i>
                    Download
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Sample Links */}
          <div className="mb-3">
            <small className="text-muted d-block mb-2">Test with these URLs:</small>
            <div className="d-flex flex-wrap gap-2">
              {sampleUrls.map((sample, index) => (
                <button
                  key={index}
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => setUrl(sample.url)}
                >
                  {sample.name}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="alert alert-danger" role="alert">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {error.split('\n').map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
          
          {success && (
            <div className="alert alert-success d-flex align-items-center" role="alert">
              <i className="bi bi-check-circle-fill me-2"></i>
              <div>{success}</div>
            </div>
          )}
        </div>
      </div>

      {/* How It Works */}
      <div className="card mt-4 border-0 bg-success bg-opacity-10">
        <div className="card-body">
          <h5 className="card-title text-success">
            <i className="bi bi-shield-check me-2"></i>
            No External Sites - Direct Download
          </h5>
          <p className="mb-0">
            <strong>Instagram:</strong> Uses server-side API (no CORS)
            <br />
            <strong>Direct Videos:</strong> Direct download (no CORS)
            <br />
            <strong>Other Platforms:</strong> Recommended to use mobile apps
          </p>
        </div>
      </div>
    </div>
  );
}