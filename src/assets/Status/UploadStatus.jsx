import React, { useState, useEffect, useRef } from "react";
import { ref as dbRef, push, set, onValue } from "firebase/database";
import { db, auth } from "../../assets/utils/firebaseConfig";
import axios from "axios";
import Compressor from "compressorjs";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./status.css";

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function UploadStatusUnique() {
  const [file, setFile] = useState(null);
  const [uploadType, setUploadType] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dustArray, setDustArray] = useState([]);
  const [done, setDone] = useState(false);
  const [rocketFlying, setRocketFlying] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const [liveStats, setLiveStats] = useState({ views: 0, likes: 0, comments: 0 });
  const [recentStatus, setRecentStatus] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef(null);

  // Live listener for recent status stats
  useEffect(() => {
    if (!auth.currentUser?.uid) return;

    const statusRef = dbRef(db, `statuses/${auth.currentUser.uid}`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const statuses = Object.entries(data)
          .map(([id, status]) => ({ id, ...status }))
          .sort((a, b) => b.timestamp - a.timestamp);
        
        if (statuses.length > 0) {
          const latest = statuses[0];
          setRecentStatus(latest);
          
          // Calculate live stats
          const views = Object.keys(latest.viewers || {}).length;
          const likes = Object.keys(latest.likes || {}).length;
          const comments = Object.keys(latest.comments || {}).length;
          setLiveStats({ views, likes, comments });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time stats updater for the most recent status
  useEffect(() => {
    if (!recentStatus?.id) return;

    const statsRef = dbRef(db, `statuses/${auth.currentUser.uid}/${recentStatus.id}`);
    const unsubscribe = onValue(statsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const views = Object.keys(data.viewers || {}).length;
        const likes = Object.keys(data.likes || {}).length;
        const comments = Object.keys(data.comments || {}).length;
        setLiveStats({ views, likes, comments });
      }
    });

    return () => unsubscribe();
  }, [recentStatus]);

  const createParticles = () => {
    const particles = [];
    for (let i = 0; i < 15; i++) {
      particles.push({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1,
        size: Math.random() * 20 + 10,
        duration: Math.random() * 1 + 1
      });
    }
    return particles;
  };

  const createDust = () => {
    const dusts = [];
    for (let i = 0; i < 7; i++) {
      dusts.push({
        id: i,
        left: Math.random() * 60 - 30,
        delay: Math.random() * 0.5,
      });
    }
    setDustArray(dusts);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Reset states for new upload
    setDone(false);
    setRecentStatus(null);
    setLiveStats({ views: 0, likes: 0, comments: 0 });
    setUploadProgress(0);

    if (selectedFile.type.startsWith("image/")) {
      setUploadType("image");
      new Compressor(selectedFile, {
        quality: 0.7,
        maxWidth: 1080,
        maxHeight: 1920,
        success(result) {
          setFile(result);
        },
        error() {
          toast.warn("Compression failed, using original.");
          setFile(selectedFile);
        },
      });
    } else if (selectedFile.type.startsWith("video/")) {
      setUploadType("video");
      if (selectedFile.size > 50 * 1024 * 1024) { // 50MB limit
        toast.error("Video must be smaller than 50MB");
        return;
      }
      setFile(selectedFile);
    } else {
      toast.error("Only image or video allowed for status.");
    }
  };

  const handleUpload = async () => {
    if (!file) return toast.error("Select a file first!");
    
    setUploading(true);
    createDust();
    setRocketFlying(true);
    setShowParticles(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append("folder", "statuses");

      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
        formData,
        {
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            setUploadProgress(progress);
          }
        }
      );

      const url = res.data.secure_url;
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Not logged in!");

      // Ensure user data exists
      await set(dbRef(db, `usersData/${uid}`), {
        username: auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "User",
        photoURL: auth.currentUser.photoURL || "/icons/avatar.jpg",
        lastActive: Date.now(),
        lastStatus: Date.now()
      }, { merge: true });

      const statusRef = push(dbRef(db, `statuses/${uid}`));
      const statusId = statusRef.key;
      
      const statusData = {
        id: statusId,
        mediaURL: url,
        type: uploadType,
        timestamp: Date.now(),
        userId: uid,
        userName: auth.currentUser.displayName || auth.currentUser.email?.split("@")[0] || "User",
        userPic: auth.currentUser.photoURL || "/icons/avatar.jpg",
        viewers: {},
        likes: {},
        comments: {},
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours from now
      };

      await set(statusRef, statusData);

      // Real-time update for immediate feedback
      setRecentStatus(statusData);

      setTimeout(() => {
        setUploading(false);
        setDustArray([]);
        setFile(null);
        setUploadType(null);
        setRocketFlying(false);
        setShowParticles(false);
        setUploadProgress(0);
        setDone(true);

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        setTimeout(() => setDone(false), 3000);
      }, 1000);

    } catch (err) {
      console.error(err);
      toast.error("Upload failed: " + (err.message || "Unknown error"));
      setUploading(false);
      setDustArray([]);
      setRocketFlying(false);
      setShowParticles(false);
      setUploadProgress(0);
    }
  };

  const calculateTimeLeft = () => {
    if (!recentStatus?.timestamp) return 24;
    const hoursPassed = (Date.now() - recentStatus.timestamp) / (1000 * 60 * 60);
    return Math.max(0, 24 - Math.floor(hoursPassed));
  };

  const particles = createParticles();

  return (
    <div className="unique-wrapper">
      {/* Animated Background */}
      <div className="animated-bg">
        <div className="floating-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>
      </div>

      {recentStatus && (
        <div className="live-stats-panel">
          <div className="stats-container">
            <div className="stats-header">
              <h5>📊 Live Status Stats</h5>
              <div className="time-left">{calculateTimeLeft()}h left</div>
            </div>
            <div className="stats-grid">
              <div className="stat-item">
                <i className="bi bi-eye-fill"></i>
                <span className="stat-number">{liveStats.views}</span>
                <span className="stat-label">Views</span>
              </div>
              <div className="stat-item">
                <i className="bi bi-heart-fill"></i>
                <span className="stat-number">{liveStats.likes}</span>
                <span className="stat-label">Likes</span>
              </div>
              <div className="stat-item">
                <i className="bi bi-chat-fill"></i>
                <span className="stat-number">{liveStats.comments}</span>
                <span className="stat-label">Comments</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Progress Bar */}
      {uploading && (
        <div className="upload-progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <span className="progress-text">{uploadProgress}%</span>
        </div>
      )}

      {/* Magical Particles */}
      {showParticles && (
        <div className="particles-container">
          {particles.map((particle) => (
            <div
              key={particle.id}
              className="particle"
              style={{
                left: `${particle.left}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                animationDelay: `${particle.delay}s`,
                animationDuration: `${particle.duration}s`
              }}
            ></div>
          ))}
        </div>
      )}

      {/* Rocket */}
      <div className={`rocket-container ${rocketFlying ? "fly" : ""}`}>
        <i className="bi bi-rocket-takeoff-fill rocket-icon"></i>
        <div className="rocket-trail"></div>
      </div>

      {/* Upload Area */}
      <div className="upload-area">
        {!file && !done && (
          <>
            <div className="upload-icon mb-4">
              <i className="bi bi-cloud-arrow-up-fill"></i>
            </div>
            <label htmlFor="unique-file" className="unique-circle-btn mb-3">
              <span>📸 Select Media</span>
            </label>
            <p className="text-white opacity-75">Choose an image or video (24h story)</p>
            <small className="text-white opacity-50">Max video size: 50MB</small>
            <input
              ref={fileInputRef}
              type="file"
              id="unique-file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="hidden-file-input"
            />
          </>
        )}

        {/* Preview */}
        {file && !done && (
          <div className="unique-preview">
            {uploadType === "image" ? (
              <img
                src={URL.createObjectURL(file)}
                alt="preview"
                className={`unique-media ${uploading ? "shrink" : ""}`}
              />
            ) : (
              <video
                src={URL.createObjectURL(file)}
                className={`unique-media ${uploading ? "shrink" : ""}`}
                controls
                autoPlay
                muted
              />
            )}

            <button
              className="unique-upload-btn"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Uploading... {uploadProgress}%
                </>
              ) : (
                "🚀 Post Status"
              )}
            </button>

            {/* Dust while uploading */}
            {uploading && (
              <div className="dust-container">
                {dustArray.map((d) => (
                  <img
                    key={d.id}
                    src={URL.createObjectURL(file)}
                    alt="dust"
                    className="dust-media"
                    style={{
                      left: `${d.left}px`,
                      animationDelay: `${d.delay}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Done message */}
        {done && (
          <div className="upload-success">
            <div className="success-icon">
              <i className="bi bi-check-circle-fill"></i>
            </div>
            <h3 className="text-white mt-3">Status Live! 🎉</h3>
            <p className="text-white opacity-75">Your story is now visible to friends</p>
            <div className="live-indicator">
              <span className="pulse-dot"></span>
              LIVE - UPDATING IN REAL-TIME
            </div>
          </div>
        )}
      </div>

      <ToastContainer 
        position="bottom-center"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
}