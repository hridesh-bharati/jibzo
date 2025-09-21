// src\assets\Status\UploadStatus.jsx
import React, { useState } from "react";
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
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState(null);

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
      if (!uid) return toast.error("Not logged in!");

      // Update usersData
      await set(dbRef(db, `usersData/${uid}`), {
        username:
          auth.currentUser.displayName ||
          auth.currentUser.email?.split("@")[0] ||
          "User",
        photoURL: auth.currentUser.photoURL || "icons/avatar.jpg",
      });

      // Save status
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

      toast.success("Status uploaded!");
      setFile(null);
      setUploadType(null);
    } catch (err) {
      console.error(err);
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="unique-wrapper">
      {!file && (
        <div className="text-center text-white">
          <label htmlFor="unique-file" className="unique-circle-btn mb -2">
            <i class="bi bi-cloud-upload-fill text-danger"></i>
          </label>
          <span>Upload</span>
        </div>
      )}
      <input
        type="file"
        id="unique-file"
        accept="image/*,video/*"
        onChange={handleFileChange}
        className="hidden-file-input"
      />

      {file && (
        <div className="unique-preview">
          {uploadType === "image" ? (
            <img
              src={URL.createObjectURL(file)}
              alt="preview"
              className="unique-media"
            />
          ) : (
            <video
              src={URL.createObjectURL(file)}
              className="unique-media"
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
        </div>
      )}

      <ToastContainer />
    </div>
  );
}
