import React, { useState, useRef, useEffect } from "react";
import { ref as dbRef, push } from "firebase/database";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { BsImage, BsUpload, BsHash } from "react-icons/bs";
import Compressor from "compressorjs";

const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY;

export default function UploadPost() {
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 992);

  const fileInputRef = useRef();
  const currentUser = auth.currentUser;

  // Update isDesktop on resize
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 992);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle file selection & compress image
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    new Compressor(selectedFile, {
      quality: 0.7,
      maxWidth: 1920,
      maxHeight: 1080,
      success(result) {
        setFile(result);
      },
      error(err) {
        toast.error("Image compression failed");
        setFile(selectedFile); // fallback
      },
    });
  };

  const handleCaptionChange = (e) => setCaption(e.target.value);

  // Upload image to ImgBB and store in Firebase
  const handleUpload = (e) => {
    e.preventDefault();

    if (!file) return toast.error("Please select an image.");
    if (!caption.trim()) return toast.error("Please enter a caption.");

    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("image", file);

    const xhr = new XMLHttpRequest();

    // Progress event
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setProgress(percentComplete);
      }
    };

    xhr.onload = async () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (!data.success) throw new Error("ImgBB upload failed");

          const imageUrl = data.data.url;

          await push(dbRef(db, "galleryImages"), {
            src: imageUrl,
            caption: caption.trim(),
            timestamp: Date.now(),
            source: "imgbb",
            user:
              currentUser?.displayName ||
              (currentUser?.email ? currentUser.email.split("@")[0] : "Guest User"),
            userId: currentUser?.uid || "guest_" + Date.now(),
            userPic: currentUser?.photoURL || "icons/avatar.jpg",
          });


          toast.success("Image uploaded successfully!");
          setFile(null);
          setCaption("");
          setProgress(100);
          fileInputRef.current.value = null;
        } catch (err) {
          toast.error("Upload failed: " + err.message);
        }
      } else {
        toast.error("Upload failed with status " + xhr.status);
      }
      setUploading(false);
    };

    xhr.onerror = () => {
      toast.error("Upload failed due to a network error.");
      setUploading(false);
    };

    xhr.open("POST", `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`);
    xhr.send(formData);
  };

  return (
    <section
      className="d-flex justify-content-center align-items-center"
      style={{
        minHeight: isDesktop ? "100vh" : "92vh",
        background: "linear-gradient(135deg,#f9d423,#ff4e50)",
        padding: "20px",
      }}
    >
      <div
        className="card shadow-lg p-4 text-center"
        style={{
          width: "100%",
          maxWidth: "420px",
          borderRadius: "20px",
          backgroundColor: "#fff",
        }}
      >
        <h3 className="fw-bold mb-3" style={{ color: "#ff4e50" }}>
          <BsUpload className="me-2" /> New Post
        </h3>

        {/* Image Preview */}
        {file && (
          <div className="mb-3">
            <img
              src={URL.createObjectURL(file)}
              alt="preview"
              style={{
                maxHeight: "200px",
                borderRadius: "10px",
                objectFit: "cover",
              }}
              className="img-fluid"
            />
          </div>
        )}

        {/* Progress Bar */}
        {uploading && (
          <div className="progress mb-3" style={{ height: "8px", borderRadius: "4px" }}>
            <div
              className="progress-bar progress-bar-striped progress-bar-animated"
              role="progressbar"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg,#ff4e50,#f9d423)" }}
            >
              {progress}%
            </div>
          </div>
        )}

        <form onSubmit={handleUpload} className="d-flex flex-column gap-3">
          <label
            className="btn btn-outline-primary w-100 d-flex align-items-center justify-content-center"
            style={{ borderRadius: "12px" }}
          >
            <BsImage className="me-2" /> Choose Photo
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="d-none"
            />
          </label>

          <div className="input-group">
            <span className="input-group-text bg-light">
              <BsHash />
            </span>
            <input
              type="text"
              placeholder="Write a caption..."
              value={caption}
              onChange={handleCaptionChange}
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
              borderRadius: "12px",
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
