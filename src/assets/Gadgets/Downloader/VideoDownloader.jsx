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

  // CORS-free download methods
  const handleDownload = async () => {
    if (!url.trim()) {
      setError("❌ Please enter a video URL");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      // Instagram
      if (url.includes('instagram.com')) {
        const downloadUrl = `https://instasave.ink/en/instagram-video-downloader?url=${encodeURIComponent(url)}`;
        window.open(downloadUrl, '_blank');
        await updateDownloadCount("Instagram");
        setSuccess("✅ Opening Instagram downloader...");
      }
      // YouTube
      else if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const downloadUrl = `https://en.y2mate.guru/?url=${encodeURIComponent(url)}`;
        window.open(downloadUrl, '_blank');
        await updateDownloadCount("YouTube");
        setSuccess("✅ Opening YouTube downloader...");
      }
      // TikTok
      else if (url.includes('tiktok.com')) {
        const downloadUrl = `https://snaptik.app/?url=${encodeURIComponent(url)}`;
        window.open(downloadUrl, '_blank');
        await updateDownloadCount("TikTok");
        setSuccess("✅ Opening TikTok downloader...");
      }
      // Facebook
      else if (url.includes('facebook.com') || url.includes('fb.watch')) {
        const downloadUrl = `https://getfbstuff.com/facebook-video-downloader?url=${encodeURIComponent(url)}`;
        window.open(downloadUrl, '_blank');
        await updateDownloadCount("Facebook");
        setSuccess("✅ Opening Facebook downloader...");
      }
      // Direct video files (no CORS issue)
      else if (url.includes('.mp4') || url.includes('.webm') || url.includes('.ogg')) {
        // Direct download - no CORS for same-origin or CORS-enabled URLs
        const response = await fetch(url);
        
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

        await updateDownloadCount("Direct Video");
        setSuccess(`✅ Video downloaded successfully! (${formatFileSize(blob.size)})`);
      }
      // Unsupported
      else {
        throw new Error("Unsupported URL. Try Instagram, YouTube, TikTok, or direct video links.");
      }

      setUrl("");

    } catch (err) {
      console.error("❌ Download error:", err);
      setError(`❌ ${err.message}`);
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

  // Working URLs for testing
  const sampleUrls = [
    { 
      name: "Test MP4", 
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      type: "direct"
    },
    { 
      name: "Test WebM", 
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.webm", 
      type: "direct"
    }
  ];

  return (
    <div className="container-fluid py-4" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-primary mb-2">
          <i className="bi bi-download me-2"></i>
          Video Downloader
        </h1>
        <p className="text-muted">Download videos without CORS errors</p>
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
                placeholder="Paste Instagram, YouTube, TikTok URL or direct video link..."
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
                    Processing...
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
            <small className="text-muted d-block mb-2">Test with working videos:</small>
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
            <div className="alert alert-danger d-flex align-items-center" role="alert">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              <div>{error}</div>
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
      <div className="card mt-4 border-0 bg-light">
        <div className="card-body">
          <h5 className="card-title">
            <i className="bi bi-lightbulb me-2"></i>
            How This Avoids CORS Errors
          </h5>
          <div className="row">
            <div className="col-md-6">
              <h6>✅ Direct Video Links:</h6>
              <ul className="small">
                <li>MP4, WebM, OGG files</li>
                <li>CDN video links</li>
                <li>Cloud storage videos</li>
                <li>No CORS issues</li>
              </ul>
            </div>
            <div className="col-md-6">
              <h6>🔗 Social Media Links:</h6>
              <ul className="small">
                <li>Instagram - Opens downloader site</li>
                <li>YouTube - Opens downloader site</li>
                <li>TikTok - Opens downloader site</li>
                <li>Facebook - Opens downloader site</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Support */}
      <div className="row mt-4 text-center">
        <div className="col-md-3 mb-3">
          <div className="card border-primary">
            <div className="card-body">
              <i className="bi bi-instagram text-primary fs-2"></i>
              <h6>Instagram</h6>
              <small className="text-muted">Reels & Posts</small>
            </div>
          </div>
        </div>
        <div className="col-md-3 mb-3">
          <div className="card border-danger">
            <div className="card-body">
              <i className="bi bi-youtube text-danger fs-2"></i>
              <h6>YouTube</h6>
              <small className="text-muted">Videos & Shorts</small>
            </div>
          </div>
        </div>
        <div className="col-md-3 mb-3">
          <div className="card border-dark">
            <div className="card-body">
              <i className="bi bi-tiktok text-dark fs-2"></i>
              <h6>TikTok</h6>
              <small className="text-muted">Videos</small>
            </div>
          </div>
        </div>
        <div className="col-md-3 mb-3">
          <div className="card border-info">
            <div className="card-body">
              <i className="bi bi-facebook text-info fs-2"></i>
              <h6>Facebook</h6>
              <small className="text-muted">Videos & Reels</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}