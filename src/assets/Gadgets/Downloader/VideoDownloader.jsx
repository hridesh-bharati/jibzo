import React, { useState } from "react";
import { db } from "../../utils/firebaseConfig";
import { ref, set, get, onValue } from "firebase/database";


export default function UniversalDownloader() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Supported platforms display ke liye
  const supportedPlatforms = [
    "Instagram", "YouTube", "Facebook", "Twitter", 
    "TikTok", "Dailymotion", "Vimeo", "Likee",
    "SnackVideo", "MX Player", "Josh", "Roposo"
  ];

  // Update download count in Firebase
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

  // Extract filename from URL
  const getFileName = (url) => {
    try {
      let filename = url.split("/").pop().split("?")[0];
      if (!filename || !filename.includes('.')) {
        filename = `video_${Date.now()}.mp4`;
      }
      return filename;
    } catch {
      return `video_${Date.now()}.mp4`;
    }
  };

  // Detect platform from URL
  const detectPlatform = (url) => {
    if (url.includes('instagram.com')) return "Instagram";
    if (url.includes('youtube.com') || url.includes('youtu.be')) return "YouTube";
    if (url.includes('facebook.com') || url.includes('fb.watch')) return "Facebook";
    if (url.includes('tiktok.com')) return "TikTok";
    if (url.includes('twitter.com') || url.includes('x.com')) return "Twitter";
    if (url.includes('likee.video')) return "Likee";
    if (url.includes('snackvideo.com')) return "SnackVideo";
    return "Other Platform";
  };

  // Main download function - DIRECT DOWNLOAD (VidMate Style)
  const handleDownload = async () => {
    if (!url.trim()) {
      setError("❌ Please enter a video URL");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const platform = detectPlatform(url);
      console.log(`📱 Downloading from: ${platform}`);

      // DIRECT DOWNLOAD - No proxy
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}. Try a different URL.`);
      }

      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error("Received empty file. Video might be restricted.");
      }

      // Create download
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = getFileName(url);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      // Update Firebase stats
      await updateDownloadCount(platform);
      
      setSuccess(`✅ ${platform} video downloaded successfully! (${formatFileSize(blob.size)})`);
      setUrl(""); // Clear input

    } catch (err) {
      console.error("❌ Download error:", err);
      
      if (url.includes('instagram.com') || url.includes('youtube.com')) {
        setError(`❌ ${detectPlatform(url)} videos require app download. Try VidMate app for better results.`);
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

  // Sample URLs for testing
  const sampleUrls = [
    { name: "MP4 Video", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" },
    { name: "WebM Video", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.webm" },
    { name: "Sample Video", url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4" }
  ];

  return (
    <div className="container-fluid py-4" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-primary mb-2">
          <i className="bi bi-download me-2"></i>
          Video Downloader
        </h1>
        <p className="text-muted">Download videos from direct links</p>
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
                placeholder="Paste direct video URL here..."
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
            <small className="text-muted d-block mb-2">Try with sample videos:</small>
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

      {/* Supported Platforms Info */}
      <div className="card mt-4 border-0">
        <div className="card-body">
          <h5 className="card-title">
            <i className="bi bi-info-circle text-primary me-2"></i>
            How to Use
          </h5>
          <div className="row">
            <div className="col-md-6">
              <h6>✅ Direct Links Work:</h6>
              <ul className="small">
                <li>MP4, WebM, OGG files</li>
                <li>CDN video links</li>
                <li>Cloud storage videos</li>
                <li>Direct file URLs</li>
              </ul>
            </div>
            <div className="col-md-6">
              <h6>❌ Social Media Need App:</h6>
              <ul className="small">
                <li>Instagram - Use VidMate app</li>
                <li>YouTube - Use SnapTube app</li>
                <li>TikTok - Use TikTok Downloader</li>
                <li>Facebook - Use FB Downloader</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="row mt-4 text-center">
        <div className="col-md-4 mb-3">
          <div className="card border-0 bg-light">
            <div className="card-body">
              <i className="bi bi-lightning-charge text-warning fs-2"></i>
              <h6>Fast</h6>
              <small className="text-muted">Quick downloads</small>
            </div>
          </div>
        </div>
        <div className="col-md-4 mb-3">
          <div className="card border-0 bg-light">
            <div className="card-body">
              <i className="bi bi-shield-check text-success fs-2"></i>
              <h6>Safe</h6>
              <small className="text-muted">No ads</small>
            </div>
          </div>
        </div>
        <div className="col-md-4 mb-3">
          <div className="card border-0 bg-light">
            <div className="card-body">
              <i className="bi bi-phone text-primary fs-2"></i>
              <h6>Simple</h6>
              <small className="text-muted">Easy to use</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}