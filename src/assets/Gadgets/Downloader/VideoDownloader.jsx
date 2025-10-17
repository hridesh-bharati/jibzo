import React, { useState } from "react";
import { db } from "../../utils/firebaseConfig";
import { ref, set, get, onValue } from "firebase/database";

export default function VideoDownloader() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [downloadHistory, setDownloadHistory] = useState([]);

  // Supported platforms
  const supportedPlatforms = [
    { name: "Instagram", domains: ["instagram.com", "instagr.am"] },
    { name: "YouTube", domains: ["youtube.com", "youtu.be"] },
    { name: "Facebook", domains: ["facebook.com", "fb.watch"] },
    { name: "Twitter", domains: ["twitter.com", "x.com"] },
    { name: "TikTok", domains: ["tiktok.com"] },
    { name: "Dailymotion", domains: ["dailymotion.com"] },
    { name: "Vimeo", domains: ["vimeo.com"] },
    { name: "Likee", domains: ["likee.video"] },
    { name: "SnackVideo", domains: ["snackvideo.com"] },
    { name: "MX Player", domains: ["mxplayer.in"] }
  ];

  // Detect platform from URL
  const detectPlatform = (url) => {
    for (let platform of supportedPlatforms) {
      if (platform.domains.some(domain => url.includes(domain))) {
        return platform.name;
      }
    }
    return "Direct Video";
  };

  // Update download count in Firebase
  const updateDownloadCount = async (platform) => {
    try {
      const countRef = ref(db, `downloadStats/${platform}/count`);
      const snapshot = await get(countRef);
      const currentCount = snapshot.exists() ? snapshot.val() : 0;
      await set(countRef, currentCount + 1);
      
      // Add to history
      const historyRef = ref(db, `downloadHistory`);
      const historySnapshot = await get(historyRef);
      const currentHistory = historySnapshot.exists() ? historySnapshot.val() : [];
      const newHistory = [
        {
          url: url,
          platform: platform,
          timestamp: new Date().toISOString(),
          filename: getFileName(url)
        },
        ...currentHistory.slice(0, 9) // Keep last 10
      ];
      await set(historyRef, newHistory);
    } catch (error) {
      console.error("Error updating download count:", error);
    }
  };

  // Extract filename from URL
  const getFileName = (url) => {
    try {
      const urlObj = new URL(url);
      let filename = urlObj.pathname.split('/').pop();
      if (!filename || !filename.includes('.')) {
        filename = `video_${Date.now()}.mp4`;
      }
      return filename;
    } catch {
      return `video_${Date.now()}.mp4`;
    }
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
      const platform = detectPlatform(url);
      console.log(`📱 Detected Platform: ${platform}`);

      let downloadUrl = url;

      // For social media platforms, use download service
      if (platform !== "Direct Video") {
        downloadUrl = await getDownloadLink(url, platform);
      }

      console.log("🔗 Download URL:", downloadUrl);

      // Download the video
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      
      if (blob.size === 0) {
        throw new Error("Received empty file");
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

      // Update stats
      await updateDownloadCount(platform);
      
      setSuccess(`✅ ${platform} video downloaded successfully! (${formatFileSize(blob.size)})`);
      
      // Add to local history
      setDownloadHistory(prev => [{
        url: url,
        platform: platform,
        timestamp: new Date().toLocaleString(),
        size: formatFileSize(blob.size)
      }, ...prev.slice(0, 4)]);

      setUrl(""); // Clear input after successful download

    } catch (err) {
      console.error("❌ Download error:", err);
      setError(`❌ Download failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Get download link from service (you can replace with your own API)
  const getDownloadLink = async (url, platform) => {
    // Using free video downloader APIs
    const services = [
      `https://api.vevioz.com/api/button/mp4/${encodeURIComponent(url)}`,
      `https://api.douyin.wtf/api?url=${encodeURIComponent(url)}`,
      `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`
    ];

    for (let service of services) {
      try {
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

    throw new Error(`Could not get download link for ${platform}`);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Sample URLs for quick testing
  const sampleUrls = [
    { name: "Instagram Reel", url: "https://www.instagram.com/reel/Cx9J8kioe6P/" },
    { name: "YouTube Short", url: "https://youtube.com/shorts/ABC123" },
    { name: "TikTok Video", url: "https://www.tiktok.com/@user/video/123456" },
    { name: "Facebook Video", url: "https://fb.watch/abc123/" }
  ];

  return (
    <div className="container-fluid py-4" style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-primary mb-2">
          <i className="bi bi-download me-2"></i>
          Universal Video Downloader
        </h1>
        <p className="text-muted">Download videos from Instagram, YouTube, TikTok, and 100+ other platforms</p>
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
                placeholder="Paste Instagram, YouTube, TikTok, Facebook, etc. link here..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                style={{ borderRight: 'none' }}
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
            <small className="text-muted d-block mb-2">Try with sample URLs:</small>
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

      {/* Supported Platforms */}
      <div className="card mt-4 border-0">
        <div className="card-body">
          <h5 className="card-title">
            <i className="bi bi-check-circle text-success me-2"></i>
            Supported Platforms
          </h5>
          <div className="row">
            {supportedPlatforms.map((platform, index) => (
              <div key={index} className="col-6 col-md-4 col-lg-3 mb-2">
                <div className="d-flex align-items-center">
                  <i className="bi bi-check text-success me-2"></i>
                  <small>{platform.name}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Download History */}
      {downloadHistory.length > 0 && (
        <div className="card mt-4 border-0">
          <div className="card-body">
            <h5 className="card-title">
              <i className="bi bi-clock-history me-2"></i>
              Recent Downloads
            </h5>
            <div className="list-group list-group-flush">
              {downloadHistory.map((item, index) => (
                <div key={index} className="list-group-item d-flex justify-content-between align-items-center">
                  <div>
                    <small className="fw-bold text-primary">{item.platform}</small>
                    <br />
                    <small className="text-muted">{item.url.substring(0, 50)}...</small>
                  </div>
                  <div className="text-end">
                    <small className="text-muted">{item.timestamp}</small>
                    <br />
                    <small className="text-success">{item.size}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Features */}
      <div className="row mt-4 text-center">
        <div className="col-md-4 mb-3">
          <div className="card border-0 bg-light">
            <div className="card-body">
              <i className="bi bi-lightning-charge text-warning fs-2"></i>
              <h6>Fast Download</h6>
              <small className="text-muted">High-speed video downloading</small>
            </div>
          </div>
        </div>
        <div className="col-md-4 mb-3">
          <div className="card border-0 bg-light">
            <div className="card-body">
              <i className="bi bi-shield-check text-success fs-2"></i>
              <h6>Safe & Secure</h6>
              <small className="text-muted">No ads, no malware</small>
            </div>
          </div>
        </div>
        <div className="col-md-4 mb-3">
          <div className="card border-0 bg-light">
            <div className="card-body">
              <i className="bi bi-phone text-primary fs-2"></i>
              <h6>All Platforms</h6>
              <small className="text-muted">Works on all devices</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}