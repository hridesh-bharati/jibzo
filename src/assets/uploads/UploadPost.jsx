// src/components/Gallery/UploadPost.jsx
import React, { useState, useRef } from "react";
import { ref as dbRef, push } from "firebase/database";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Compressor from "compressorjs";
import { BsImage, BsUpload, BsHash, BsFileEarmarkPdf, BsCameraVideo } from "react-icons/bs";

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function UploadPost() {
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadType, setUploadType] = useState(null);
  const fileInputRef = useRef();
  const currentUser = auth.currentUser;
  const storage = getStorage();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (uploadType === "image") {
      new Compressor(selectedFile, {
        quality: 0.75,
        maxWidth: 1920,
        maxHeight: 1080,
        success(result) {
          setFile(result);
        },
        error() {
          toast.warn("Image compression failed — using original file");
          setFile(selectedFile);
        },
      });
    } else {
      setFile(selectedFile);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Please select a file.");
    if (!caption.trim()) return toast.error("Please enter a caption.");

    setUploading(true);
    setProgress(0);

    try {
      let fileUrl = "";

      if (uploadType === "pdf") {
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
          formData.append("folder", "pdfs");

          const res = await axios.post(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`,
            formData,
            {
              onUploadProgress: (event) => {
                if (event.total) {
                  setProgress(Math.round((event.loaded * 100) / event.total));
                }
              },
            }
          );
          fileUrl = res.data.secure_url;
        } catch (cloudErr) {
          const storagePath = `pdfs/${Date.now()}_${file.name}`;
          const fileRef = storageRef(storage, storagePath);
          await uploadBytes(fileRef, file);
          fileUrl = await getDownloadURL(fileRef);
        }
      } else {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        formData.append("folder", uploadType === "image" ? "images" : "videos");

        const res = await axios.post(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
          formData,
          {
            onUploadProgress: (event) => {
              if (event.total) {
                setProgress(Math.round((event.loaded * 100) / event.total));
              }
            },
          }
        );
        fileUrl = res.data.secure_url;
      }

      await push(dbRef(db, "galleryImages"), {
        src: fileUrl,
        caption: caption.trim(),
        timestamp: Date.now(),
        type: uploadType,
        source: uploadType === "pdf" ? "firebase" : "cloudinary",
        user:
          currentUser?.displayName ||
          (currentUser?.email ? currentUser.email.split("@")[0] : "Guest User"),
        userId: currentUser?.uid || "guest_" + Date.now(),
        userPic: currentUser?.photoURL || "icons/avatar.jpg",
      });

      toast.success("File uploaded successfully!");
      setFile(null);
      setCaption("");
      setProgress(100);
      if (fileInputRef.current) fileInputRef.current.value = null;
      setUploadType(null);
    } catch (err) {
      console.error(err);
      toast.error("Upload failed: " + (err?.message || "unknown"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <section
      className="d-flex justify-content-center align-items-center"
      style={{
        minHeight: "92vh",
        background: "linear-gradient(135deg,#f9d423,#ff4e50)",
        padding: 20,
      }}
    >
      <div
        className="card shadow-lg p-4 text-center"
        style={{ maxWidth: 420, width: "100%", borderRadius: 20 }}
      >
        <h3 className="fw-bold mb-3" style={{ color: "#ff4e50" }}>
          <BsUpload className="me-2" /> New Post
        </h3>

        {file && (
          <div className="mb-3">
            {uploadType === "image" ? (
              <img
                src={URL.createObjectURL(file)}
                alt="preview"
                className="img-fluid"
                style={{ maxHeight: 200, borderRadius: 10, objectFit: "cover" }}
              />
            ) : uploadType === "video" ? (
              <video
                src={URL.createObjectURL(file)}
                autoPlay
                loop
                playsInline
                controls
                style={{ maxHeight: 200, borderRadius: 10, width: "100%", objectFit: "cover" }}
              />
            ) : uploadType === "pdf" ? (
              <iframe
                src={URL.createObjectURL(file)}
                title="pdf-preview"
                style={{ width: "100%", height: 200, borderRadius: 10 }}
              />
            ) : null}
          </div>
        )}

        {uploading && (
          <div className="progress mb-3" style={{ height: 8, borderRadius: 4 }}>
            <div
              className="progress-bar progress-bar-striped progress-bar-animated"
              role="progressbar"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg,#ff4e50,#f9d423)",
              }}
            >
              {progress}%
            </div>
          </div>
        )}
        <hr />
        <form onSubmit={handleUpload} className="d-flex flex-column gap-3">
          <div className="d-flex gap-2">
            <label className="btn btn-outline-primary flex-fill" style={{ borderRadius: 12 }}>
              <BsImage className="me-1" /> Image
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  setUploadType("image");
                  handleFileChange(e);
                }}
                ref={fileInputRef}
                className="d-none"
              />
            </label>

            <label className="btn btn-outline-success flex-fill" style={{ borderRadius: 12 }}>
              <BsCameraVideo className="me-1" /> Video
              <input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  setUploadType("video");
                  handleFileChange(e);
                }}
                className="d-none"
              />
            </label>

            <label className="btn btn-outline-danger flex-fill" style={{ borderRadius: 12 }}>
              <BsFileEarmarkPdf className="me-1" /> PDF
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  setUploadType("pdf");
                  handleFileChange(e);
                }}
                className="d-none"
              />
            </label>
          </div>

          <div className="input-group">
            <span className="input-group-text bg-light">
              <BsHash />
            </span>
            <input
              type="text"
              placeholder="Write a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="form-control"
            />
          </div>

          <button
            type="submit"
            className="btn w-100 text-white fw-bold"
            style={{
              background: uploading
                ? "linear-gradient(90deg,#6a11cb,#2575fc)"
                : "linear-gradient(90deg,#ff4e50,#f9d423)",
              borderRadius: 12,
            }}
            disabled={uploading}
          >
            {uploading ? `Uploading... (${progress}%)` : "Post"}
          </button>
        </form>
      </div>

      <ToastContainer />
    </section>
  );
}
