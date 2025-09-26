// src/assets/uploads/UploadPost.jsx
import React, { useState, useRef, useCallback, useEffect } from "react";
import { ref as dbRef, push } from "firebase/database";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
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
  const [uploadType, setUploadType] = useState(null);

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropAspect, setCropAspect] = useState(1);

  const fileInputRef = useRef();
  const currentUser = auth.currentUser;
  const storage = getStorage();

  // Cleanup object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (file) {
        URL.revokeObjectURL(URL.createObjectURL(file));
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
      const croppedFile = new File([croppedBlob], `cropped_${file.name || Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      setFile(croppedFile);
      setCropModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to apply crop");
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Please select a file.");
    if (!caption.trim()) return toast.error("Please enter a caption.");
    if (!uploadType) return toast.error("Please select a file type.");

    setUploading(true);
    setProgress(0);
    let fileUrl = "";

    try {
      if (uploadType === "pdf") {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        formData.append("folder", "pdfs");

        const res = await axios.post(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`,
          formData,
          {
            onUploadProgress: (e) => setProgress(Math.round((e.loaded * 100) / e.total)),
          }
        );
        fileUrl = res.data.secure_url;
      } else {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        formData.append("folder", uploadType === "image" ? "images" : "videos");

        const res = await axios.post(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${uploadType}/upload`,
          formData,
          {
            onUploadProgress: (e) => setProgress(Math.round((e.loaded * 100) / e.total)),
          }
        );
        fileUrl = res.data.secure_url;
      }

      await push(dbRef(db, "galleryImages"), {
        src: fileUrl,
        caption: caption.trim(),
        timestamp: Date.now(),
        type: uploadType,
        user: currentUser?.displayName || currentUser?.email?.split("@")[0] || "Guest",
        userId: currentUser?.uid || "guest_" + Date.now(),
        userEmail: currentUser?.email || "",
        userPic: currentUser?.photoURL || "icons/avatar.jpg",
      });

      toast.success("File uploaded successfully!");
      setFile(null);
      setCaption("");
      setProgress(0);
      setUploadType(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error(err);
      toast.error("Upload failed: " + (err?.message || "Unknown error"));
    } finally {
      setUploading(false);
    }
  };

  const closeCropModal = () => setCropModalOpen(false);

  return (
    <section className="upload-section d-flex flex-column align-items-center justify-content-center">
      <div className="upload-card mobile-card shadow-lg p-0 text-center">

        {/* Preview + Tools */}
        <div className="preview-container">
          {file ? (
            <>
              {uploadType === "image" && (
                <img src={URL.createObjectURL(file)} alt="preview" className="img-preview" />
              )}
              {uploadType === "video" && (
                <video src={URL.createObjectURL(file)} controls className="video-preview" />
              )}
              {uploadType === "pdf" && (
                <iframe src={URL.createObjectURL(file)} title="pdf-preview" className="pdf-preview" />
              )}
            </>
          ) : (
            <div
              className="placeholder d-flex flex-column align-items-center justify-content-center"
              onClick={() => fileInputRef.current?.click()}
              style={{ cursor: 'pointer' }}
            >
              <BsUpload size={50} className="mb-2" />
              <p className="placeholder-text">Click to choose media</p>
            </div>
          )}

          {/* Right-side buttons */}
          <div className="tools-bar d-flex flex-column">
            <label className="tool-btn mb-2" aria-label="Upload image">
              <BsImage />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, "image")}
                className="d-none"
                ref={fileInputRef}
              />
            </label>
            <label className="tool-btn mb-2" aria-label="Upload video">
              <BsCameraVideo />
              <input
                type="file"
                accept="video/*"
                onChange={(e) => handleFileChange(e, "video")}
                className="d-none"
              />
            </label>
            <label className="tool-btn mb-2" aria-label="Upload PDF">
              <BsFileEarmarkPdf />
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileChange(e, "pdf")}
                className="d-none"
              />
            </label>
            {file && uploadType === "image" && (
              <button className="tool-btn crop-btn" type="button" onClick={openCropModal} aria-label="Crop image">
                <BiCrop />
              </button>
            )}
          </div>
        </div>

        {/* Crop Modal */}
        <Modal show={cropModalOpen} onHide={closeCropModal} fullscreen centered>
          <Modal.Header closeButton>
            <Modal.Title>Crop Image</Modal.Title>
          </Modal.Header>
          <Modal.Body className="cropper-body">
            {file && (
              <Cropper
                image={URL.createObjectURL(file)}
                crop={crop}
                zoom={zoom}
                aspect={cropAspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                showGrid
              />
            )}
          </Modal.Body>
          <Modal.Footer className="d-flex flex-column gap-2">
            <div className="w-100">
              <label className="form-label">Zoom: {zoom.toFixed(2)}</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="form-range"
              />
            </div>
            <div className="aspect-buttons d-flex justify-content-between w-100">
              <Button size="sm" variant={cropAspect === 1 ? "primary" : "secondary"} onClick={() => setCropAspect(1)}>Square</Button>
              <Button size="sm" variant={cropAspect === 4 / 3 ? "primary" : "secondary"} onClick={() => setCropAspect(4 / 3)}>4:3</Button>
              <Button size="sm" variant={cropAspect === 16 / 9 ? "primary" : "secondary"} onClick={() => setCropAspect(16 / 9)}>16:9</Button>
              <Button size="sm" variant={!cropAspect ? "primary" : "secondary"} onClick={() => setCropAspect(null)}>Free</Button>
            </div>
            <div className="d-flex justify-content-end gap-2 w-100">
              <Button variant="secondary" onClick={closeCropModal}>Cancel</Button>
              <Button variant="warning" onClick={() => {
                setCropModalOpen(false);
                toast.info("Original image kept without cropping");
              }}>Upload Original</Button>
              <Button variant="primary" onClick={applyCrop}>Apply Crop</Button>
            </div>
          </Modal.Footer>
        </Modal>

        {/* Caption & Post */}
        <form onSubmit={handleUpload} className="caption-form d-flex">
          <input
            type="text"
            placeholder="Write a caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="caption-input"
            maxLength={500}
          />
          <button
            type="submit"
            className="btn btn-primary post-btn"
            disabled={uploading || !file || !caption.trim()}
          >
            {uploading ? `Uploading... (${progress}%)` : "Post"}
          </button>
        </form>

        {/* Progress Bar */}
        {uploading && (
          <div className="progress mobile-progress">
            <div
              className="progress-bar progress-bar-striped progress-bar-animated"
              style={{ width: `${progress}%` }}
            >
              {progress}%
            </div>
          </div>
        )}
      </div>

      <ToastContainer position="top-right" autoClose={3000} />
    </section>
  );
}