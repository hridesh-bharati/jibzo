// src/assets/uploads/UploadPost.jsx
import React, { useState, useRef, useCallback, useEffect } from "react";
import { ref as dbRef, push } from "firebase/database";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Cropper from "react-easy-crop";
import { Modal, Button } from "react-bootstrap";
import { BsImage, BsUpload, BsFileEarmarkPdf, BsCameraVideo } from "react-icons/bs";
import { BiCrop } from "react-icons/bi";
import "./UploadPost.css";
import { getCroppedImage } from "../utils/FileCompress.js";

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export default function UploadPost() {
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadType, setUploadType] = useState("text");
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropAspect, setCropAspect] = useState(1);
  const [currentUser, setCurrentUser] = useState(null);

  const fileInputRef = useRef();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    return () => {
      if (file) {
        const objectUrl = URL.createObjectURL(file);
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file]);

  const handleFileChange = (e, type) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setUploadType(type);
    setFile(selectedFile);
    e.target.value = "";
  };

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const openCropModal = () => {
    if (!file) return toast.error("Select an image first");
    setCropModalOpen(true);
  };

  const applyCrop = async () => {
    if (!file || !croppedAreaPixels) return toast.error("Please select a crop area");
    try {
      const croppedBlob = await getCroppedImage(file, croppedAreaPixels);
      const croppedFile = new File([croppedBlob], `cropped_${file.name || Date.now()}.jpg`, { type: "image/jpeg" });
      setFile(croppedFile);
      setCropModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to apply crop");
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!caption.trim()) return toast.error("Please enter some text.");
    if (uploadType !== "text" && !file) return toast.error("Please select a file.");

    setUploading(true);
    setProgress(0);
    let fileUrl = "";

    try {
      if (uploadType !== "text") {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        formData.append("folder", uploadType === "pdf" ? "pdfs" : uploadType === "image" ? "images" : "videos");

        const res = await axios.post(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${uploadType === "pdf" ? "raw" : uploadType}/upload`,
          formData,
          { onUploadProgress: (e) => setProgress(Math.round((e.loaded * 100) / e.total)) }
        );
        fileUrl = res.data.secure_url;
      }

      // Generate guest ID if no user
      let userId = currentUser?.uid;
      let guestId = null;

      if (!userId) {
        guestId = localStorage.getItem("guestId");
        if (!guestId) {
          guestId = "guest_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
          localStorage.setItem("guestId", guestId);
        }
        userId = guestId;
      }

      await push(dbRef(db, "galleryImages"), {
        src: fileUrl,
        caption: caption.trim(),
        timestamp: Date.now(),
        type: uploadType,
        user: currentUser?.displayName || currentUser?.email?.split("@")[0] || "Guest",
        userId: userId,
        userEmail: currentUser?.email || "",
        userPic: currentUser?.photoURL || "icons/avatar.jpg",
      });

      toast.success("Post uploaded successfully!");
      setFile(null);
      setCaption("");
      setProgress(0);
      setUploadType("text");

    } catch (err) {
      console.error(err);
      toast.error("Upload failed: " + (err?.message || "Unknown error"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="upload-section d-flex flex-column align-items-center justify-content-center">
      <div className="upload-card mobile-card shadow-lg">

        {/* Preview / Placeholder */}
        <div className="preview-container">
          {file ? (
            <>
              {uploadType === "image" && <img src={URL.createObjectURL(file)} alt="preview" className="img-preview" />}
              {uploadType === "video" && <video src={URL.createObjectURL(file)} controls className="video-preview" />}
              {uploadType === "pdf" && (
                <div className="pdf-preview-container">
                  <i className="bi bi-file-earmark-pdf-fill text-danger" style={{ fontSize: '3rem' }}></i>
                  <p className="mt-2">{file.name}</p>
                </div>
              )}
            </>
          ) : (
            <div className="placeholder" onClick={() => fileInputRef.current?.click()}>
              <BsUpload size={50} className="mb-2" />
              <p className="placeholder-text">Click to upload media or <br/>write text below</p>
            </div>
          )}

          {/* Tool Buttons */}
          <div className="tools-bar d-flex flex-column">
            <label className="tool-btn mb-2" title="Image">
              <BsImage />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, "image")}
                className="d-none"
                key="image-input"
              />
            </label>
            <label className="tool-btn mb-2" title="Video">
              <BsCameraVideo />
              <input
                type="file"
                accept="video/*"
                onChange={(e) => handleFileChange(e, "video")}
                className="d-none"
                key="video-input"
              />
            </label>
            <label className="tool-btn mb-2" title="PDF">
              <BsFileEarmarkPdf />
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileChange(e, "pdf")}
                className="d-none"
                key="pdf-input"
              />
            </label>
            {file && uploadType === "image" && (
              <button className="tool-btn crop-btn" type="button" onClick={openCropModal} title="Crop">
                <BiCrop />
              </button>
            )}
          </div>
        </div>

        {/* Caption / Text Area */}
        <form onSubmit={handleUpload} className="caption-form d-flex flex-column">
          <textarea
            placeholder="Write a caption, text, or link..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="caption-input w-100"
            rows={1}
            cols={10}
          />
          <button
            type="submit"
            className="btn btn-primary post-btn p-2 m-2"
            disabled={uploading || (!file && !caption.trim())}
          >
            {uploading ? `Uploading... (${progress}%)` : "Post"}
          </button>
        </form>

        {/* Progress */}
        {uploading && (
          <div className="progress mobile-progress">
            <div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: `${progress}%` }}>
              {progress}%
            </div>
          </div>
        )}
      </div>

      {/* Crop Modal */}
      <Modal show={cropModalOpen} onHide={() => setCropModalOpen(false)} fullscreen centered>
        <Modal.Header closeButton><Modal.Title>Crop Image</Modal.Title></Modal.Header>
        <Modal.Body className="cropper-body">
          {file && <Cropper image={URL.createObjectURL(file)} crop={crop} zoom={zoom} aspect={cropAspect} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} showGrid />}
        </Modal.Body>
        <Modal.Footer className="d-flex flex-column gap-2">
          <div className="w-100">
            <label className="form-label">Zoom: {zoom.toFixed(2)}</label>
            <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="form-range" />
          </div>
          <div className="aspect-buttons d-flex justify-content-between w-100">
            <Button size="sm" variant={cropAspect === 1 ? "primary" : "secondary"} onClick={() => setCropAspect(1)}>Square</Button>
            <Button size="sm" variant={cropAspect === 4 / 3 ? "primary" : "secondary"} onClick={() => setCropAspect(4 / 3)}>4:3</Button>
            <Button size="sm" variant={cropAspect === 16 / 9 ? "primary" : "secondary"} onClick={() => setCropAspect(16 / 9)}>16:9</Button>
            <Button size="sm" variant={!cropAspect ? "primary" : "secondary"} onClick={() => setCropAspect(null)}>Free</Button>
          </div>
          <div className="d-flex justify-content-end gap-2 w-100">
            <Button variant="secondary" onClick={() => setCropModalOpen(false)}>Cancel</Button>
            <Button variant="warning" onClick={() => { setCropModalOpen(false); toast.info("Original image kept"); }}>Upload Original</Button>
            <Button variant="primary" onClick={applyCrop}>Apply Crop</Button>
          </div>
        </Modal.Footer>
      </Modal>

      <ToastContainer position="top-right" autoClose={3000} />
    </section>
  );
}