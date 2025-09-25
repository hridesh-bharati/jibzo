import React, { useState, useEffect } from "react";
import { ref as dbRef, push, set } from "firebase/database";
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

  // Dust creation
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

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append("folder", "statuses");

      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
        formData
      );

      const url = res.data.secure_url;
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Not logged in!");

      await set(dbRef(db, `usersData/${uid}`), {
        username:
          auth.currentUser.displayName ||
          auth.currentUser.email?.split("@")[0] ||
          "User",
        photoURL: auth.currentUser.photoURL || "icons/avatar.jpg",
      });

      const statusRef = push(dbRef(db, `statuses/${uid}`));
      await set(statusRef, {
        mediaURL: url,
        type: uploadType,
        timestamp: Date.now(),
        userId: uid,
        userName:
          auth.currentUser.displayName ||
          auth.currentUser.email?.split("@")[0] ||
          "User",
        userPic: auth.currentUser.photoURL || "icons/avatar.jpg",
        viewers: {},
      });

      setUploading(false);
      setDustArray([]);
      setFile(null);
      setUploadType(null);
      setRocketFlying(false);
      setDone(true);

      setTimeout(() => setDone(false), 2000);
    } catch (err) {
      console.error(err);
      toast.error("Upload failed: " + err.message);
      setUploading(false);
      setDustArray([]);
      setRocketFlying(false);
    }
  };

  return (
    <div className="unique-wrapper">
      {/* Rocket */}
      <div className={`rocket-container ${rocketFlying ? "fly" : ""}`}>
        <i className="bi bi-rocket-fill rocket-icon"></i>
      </div>

      {/* File select */}
      {!file && !done && (
        <>
          <label htmlFor="unique-file" className="unique-circle-btn mb-2">
            <span>Select File</span>
          </label>
          <input
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
            />
          )}

          <button
            className="unique-upload-btn"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Post Status"}
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
      {done && <div className="upload-done zoom-fade">Done</div>}

      <ToastContainer />
    </div>
  );
}
