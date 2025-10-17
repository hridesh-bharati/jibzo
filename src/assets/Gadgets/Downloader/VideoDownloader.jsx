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

  // Instagram download using services
  const downloadInstagram = async (url) => {
    const services = [
      `https://api.vevioz.com/api/button/mp4/${encodeURIComponent(url)}`,
      `https://api.douyin.wtf/api?url=${encodeURIComponent(url)}`,
      `https://youtube4kdownloader.com/ajax/instagram.php?url=${encodeURIComponent(url)}`
    ];

    for (let service of services) {
      try {
        console.log(`Trying service: ${service}`);
        const response = await fetch(service);
        if (response.ok) {
          const data = await response.json();
          if (data.url || data.videoUrl || data.downloadUrl) {
            return data.url || data.videoUrl || data.downloadUrl;
          }
        }
      } catch (error) {
        console.log(`Service failed: ${service}`);
      }
    }
    throw new Error("All services failed");
  };

  // YouTube download
  const downloadYouTube = async (url) => {
    const services = [
      `https://api.vevioz.com/api/button/mp4/${encodeURIComponent(url)}`,
      `https://yt5s.com/en/api/convert` // POST request needed
    ];

    for (let service of services) {
      try {
        const response = await fetch(service);
        if (response.ok) {
          const data = await response.json();
          return data.url || data.videoUrl;
        }
      } catch (error) {
        console.log(`YouTube service failed: ${service}`);
      }
    }
    throw new Error("YouTube download not available");
  };

  // Main download function
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

      // Instagram
      if (url.includes('instagram.com')) {
        platform = "Instagram";
        downloadUrl = await downloadInstagram(url);
      }
      // YouTube
      else if (url.includes('youtube.com') || url.includes('youtu.be')) {
        platform = "YouTube";
        downloadUrl = await downloadYouTube(url);
      }
      // Direct video files
      else if (url.includes('.mp4') || url.includes('.webm') || url.includes('.ogg')) {
        platform = "Direct Video";
        // Direct download works for these
      }
      // Other social media
      else if (url.includes('facebook.com') || url.includes('tiktok.com')) {
        throw new Error("Use VidMate app for Facebook/TikTok downloads");
      }

      console.log(`📱 Downloading from: ${platform}`);
      console.log(`🔗 Final URL: ${downloadUrl}`);

      // Download the video
      const response = await fetch(downloadUrl);
      
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
      
      if (err.message.includes("Use VidMate app")) {
        setError(`❌ ${err.message}`);
      } else if (url.includes('instagram.com')) {
        setError(`❌ Instagram download failed. Try these solutions:
        1. Use VidMate mobile app
        2. Try different Instagram URL
        3. Use Instagram downloader websites`);
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

  // Working sample URLs
  const sampleUrls = [
    { 
      name: "Test MP4", 
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" 
    },
    { 
      name: "Test WebM", 
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.webm" 
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
        <p className="text-muted">Download Instagram videos and direct links</p>
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

      {/* Why CORS Happens */}
      <div className="card mt-4 border-0 bg-warning bg-opacity-10">
        <div className="card-body">
          <h5 className="card-title">
            <i className="bi bi-info-circle me-2"></i>
            Why Instagram/YouTube Don't Work Directly?
          </h5>
          <p className="mb-2">
            <strong>CORS Policy:</strong> Browsers block cross-origin requests for security.
          </p>
          <div className="row">
            <div className="col-md-6">
              <h6>🚫 Browser Limitations:</h6>
              <ul className="small">
                <li>Can't directly download from Instagram</li>
                <li>Can't directly download from YouTube</li>
                <li>Social media platforms block web downloads</li>
              </ul>
            </div>
            <div className="col-md-6">
              <h6>✅ VidMate Solutions:</h6>
              <ul className="small">
                <li>Uses mobile apps (no CORS)</li>
                <li>Uses backend servers</li>
                <li>Direct network access</li>
                <li>No browser restrictions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Alternative Solutions */}
      <div className="card mt-4 border-0">
        <div className="card-body">
          <h5 className="card-title">
            <i className="bi bi-phone me-2"></i>
            Best Solutions for Social Media Downloads
          </h5>
          <div className="row text-center">
            <div className="col-md-4 mb-3">
              <div className="card border-primary">
                <div className="card-body">
                  <i className="bi bi-phone text-primary fs-2"></i>
                  <h6>VidMate App</h6>
                  <small className="text-muted">Best for Instagram, YouTube</small>
                </div>
              </div>
            </div>
            <div className="col-md-4 mb-3">
              <div className="card border-success">
                <div className="card-body">
                  <i className="bi bi-download text-success fs-2"></i>
                  <h6>SnapTube</h6>
                  <small className="text-muted">YouTube specialist</small>
                </div>
              </div>
            </div>
            <div className="col-md-4 mb-3">
              <div className="card border-info">
                <div className="card-body">
                  <i className="bi bi-instagram text-info fs-2"></i>
                  <h6>Instagram Downloaders</h6>
                  <small className="text-muted">Websites & apps</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}