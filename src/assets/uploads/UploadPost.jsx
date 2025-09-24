import React, { useState, useRef, useCallback, useEffect } from "react";
import { ref as dbRef, push } from "firebase/database";
import { db, auth } from "../../assets/utils/firebaseConfig";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Cropper from "react-easy-crop";
import { Modal, Button } from "react-bootstrap";
import { BsImage, BsCameraVideo, BsFileEarmarkPdf } from "react-icons/bs";
import { BiCrop } from "react-icons/bi";
import ReactAudioPlayer from "react-audio-player";
import { getCroppedImage } from "../utils/FileCompress.js";
import "./UploadPost.css";

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
  const [spotifyTrack, setSpotifyTrack] = useState(null);
  const [spotifySongs, setSpotifySongs] = useState([]);
  const fileInputRef = useRef();
  const currentUser = auth.currentUser;

  // Fetch Spotify songs
  useEffect(() => {
    const fetchSongs = async () => {
      try {
        const res = await fetch("/api/spotify");
        const data = await res.json();
        setSpotifySongs(data);
      } catch (err) {
        console.error("Spotify fetch error:", err);
        toast.error("Failed to load songs. Using mock data.");

        // Mock data fallback
        setSpotifySongs([
          { id: 1, name: "Song A", artist: "Artist A", preview_url: "", image: "" },
          { id: 2, name: "Song B", artist: "Artist B", preview_url: "", image: "" },
        ]);
      }
    };
    fetchSongs();
  }, []);

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
      const croppedFile = new File([croppedBlob], `cropped_${file.name}`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
      setFile(croppedFile);
      setCropModalOpen(false);
      toast.success("Crop applied successfully!");
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
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append(
        "folder",
        uploadType === "image" ? "images" : uploadType === "video" ? "videos" : "pdfs"
      );

      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${uploadType === "pdf" ? "raw" : uploadType}/upload`,
        formData,
        { onUploadProgress: (e) => setProgress(Math.round((e.loaded * 100) / e.total)) }
      );

      fileUrl = res.data.secure_url;

      await push(dbRef(db, "galleryImages"), {
        src: fileUrl,
        caption: caption.trim(),
        timestamp: Date.now(),
        type: uploadType,
        user: currentUser?.displayName || currentUser?.email?.split("@")[0] || "Guest",
        userId: currentUser?.uid || "guest_" + Date.now(),
        userPic: currentUser?.photoURL || "icons/avatar.jpg",
        spotify: spotifyTrack || null,
      });

      toast.success("File uploaded successfully!");
      setFile(null);
      setCaption("");
      setProgress(0);
      setUploadType(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setSpotifyTrack(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error(err);
      toast.error("Upload failed: " + (err?.message || "Unknown error"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="upload-section d-flex flex-column align-items-center justify-content-center">
      <div className="upload-card mobile-card shadow-lg p-0 text-center">
        <div className="preview-container">
          {file && uploadType === "image" && <img src={URL.createObjectURL(file)} className="img-preview" />}
          {file && uploadType === "video" && <video src={URL.createObjectURL(file)} controls className="video-preview" />}
          {file && uploadType === "pdf" && <iframe src={URL.createObjectURL(file)} className="pdf-preview" />}
          <div className="tools-bar d-flex flex-column">
            <label className="tool-btn mb-2">
              <BsImage />
              <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, "image")} className="d-none" />
            </label>
            <label className="tool-btn mb-2">
              <BsCameraVideo />
              <input type="file" accept="video/*" onChange={(e) => handleFileChange(e, "video")} className="d-none" />
            </label>
            <label className="tool-btn mb-2">
              <BsFileEarmarkPdf />
              <input type="file" accept=".pdf" onChange={(e) => handleFileChange(e, "pdf")} className="d-none" />
            </label>
            {file && uploadType === "image" && <button className="tool-btn" onClick={openCropModal}><BiCrop /></button>}
            <div className="spotify-songs mt-2">
              {spotifySongs.map((song) => (
                <button key={song.id} className="spotify-btn" onClick={() => setSpotifyTrack(song)}>
                  {song.image && <img src={song.image} width={30} style={{ marginRight: 5 }} />}
                  {song.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {spotifyTrack && (
          <div className="spotify-preview mt-2">
            <p>🎵 {spotifyTrack.name} - {spotifyTrack.artist}</p>
            {spotifyTrack.preview_url ? (
              <ReactAudioPlayer src={spotifyTrack.preview_url} controls autoPlay />
            ) : (
              <p>No preview available</p>
            )}
          </div>
        )}

        <Modal show={cropModalOpen} onHide={() => setCropModalOpen(false)} fullscreen centered>
          <Modal.Header closeButton><Modal.Title>Crop Image</Modal.Title></Modal.Header>
          <Modal.Body>{file && <Cropper image={URL.createObjectURL(file)} crop={crop} zoom={zoom} aspect={cropAspect} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} showGrid />}</Modal.Body>
          <Modal.Footer className="d-flex flex-column gap-2">
            <div className="w-100">
              <label>Zoom: {zoom.toFixed(2)}</label>
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

        <form onSubmit={handleUpload} className="caption-form d-flex">
          <input type="text" placeholder="Write a caption..." value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={500} className="caption-input" />
          <button type="submit" className="btn btn-primary post-btn" disabled={uploading || !file || !caption.trim()}>
            {uploading ? `Uploading... (${progress}%)` : "Post"}
          </button>
        </form>

        {uploading && <div className="progress mobile-progress"><div className="progress-bar progress-bar-striped progress-bar-animated" style={{ width: `${progress}%` }}>{progress}%</div></div>}
      </div>

      <ToastContainer position="bottom-right" autoClose={3000} />
    </section>
  );
}
