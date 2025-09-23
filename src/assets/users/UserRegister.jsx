// src/assets/users/UserRegister.jsx
import React, { useState, useRef } from "react";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { db } from "../../assets/utils/firebaseConfig";
import { ref as dbRef, set, get, child } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useNavigate, Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";
import "./UserRegister.css"
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const sanitizeUsername = (username) => {
  const clean = username.trim();
  if (!clean) throw new Error("Username cannot be empty");
  return clean;
};

const checkUniqueUsername = async (username) => {
  const cleanUsername = sanitizeUsername(username).toLowerCase();
  const snapshot = await get(dbRef(db, "usersData"));
  const data = snapshot.val();
  const usernames = data ? Object.values(data).map(u => u.username.toLowerCase()) : [];
  const conflict = usernames.find(u => u.includes(cleanUsername) || cleanUsername.includes(u));
  return conflict ? false : true;
};

const generateSuggestion = async (username) => {
  const cleanUsername = sanitizeUsername(username).toLowerCase();
  const snapshot = await get(dbRef(db, "usersData"));
  const data = snapshot.val();
  const usernames = data ? Object.values(data).map(u => u.username.toLowerCase()) : [];
  if (!usernames.some(u => u.includes(cleanUsername) || cleanUsername.includes(u))) return cleanUsername;

  let counter = 1;
  let suggested = `${cleanUsername}_${counter}`;
  while (usernames.some(u => u.includes(suggested) || suggested.includes(u))) {
    counter++;
    suggested = `${cleanUsername}_${counter}`;
  }
  return suggested;
};

const UserRegister = () => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    otp: "",
    password: "",
    photo: null,
  });

  const [usernameStatus, setUsernameStatus] = useState("");
  const [usernameSuggestion, setUsernameSuggestion] = useState("");
  const [emailTaken, setEmailTaken] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  const fileInputRef = useRef();
  const auth = getAuth();
  const storage = getStorage();
  const navigate = useNavigate();
  let typingTimeout = null;

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "photo") {
      const file = files[0];
      setFormData({ ...formData, photo: file });
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => setPhotoPreview(e.target.result);
        reader.readAsDataURL(file);
      } else setPhotoPreview(null);
    } else {
      setFormData({ ...formData, [name]: value });
      if (typingTimeout) clearTimeout(typingTimeout);

      if (name === "username") {
        typingTimeout = setTimeout(async () => {
          if (!value) {
            setUsernameStatus("");
            setUsernameSuggestion("");
            return;
          }
          try {
            const isAvailable = await checkUniqueUsername(value);
            if (isAvailable) {
              setUsernameStatus("available");
              setUsernameSuggestion("");
            } else {
              setUsernameStatus("taken");
              const suggestion = await generateSuggestion(value);
              setUsernameSuggestion(suggestion);
            }
          } catch {
            setUsernameStatus("");
            setUsernameSuggestion("");
          }
        }, 500);
      }

      if (name === "email") {
        typingTimeout = setTimeout(async () => {
          if (!value) return;
          const snapshot = await get(dbRef(db, "usersData"));
          const users = snapshot.val();
          const emails = users ? Object.values(users).map(u => u.email.toLowerCase()) : [];
          setEmailTaken(emails.includes(value.toLowerCase()));
        }, 500);
      }
    }
  };

  const uploadImage = async (file) => {
    try {
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      uploadData.append("folder", "profile_pics");

      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        uploadData
      );
      return res.data.secure_url;
    } catch {
      const storagePath = `profilePics/${Date.now()}_${file.name}`;
      const fileRef = storageRef(storage, storagePath);
      await uploadBytes(fileRef, file);
      return await getDownloadURL(fileRef);
    }
  };

  const sendOTP = async () => {
    const { username, email } = formData;
    if (!username || !email) return toast.error("Enter username and email first.");
    if (usernameStatus === "taken") return toast.error(`Username "${username}" is already taken!`);
    if (emailTaken) return toast.error("Email already in use! Please login.");

    const otp = Math.floor(100000 + Math.random() * 900000);
    try {
      setLoading(true);
      await set(dbRef(db, `otp/${email.replace(/\./g, "_")}`), { otp, createdAt: Date.now() });
      const res = await axios.post("/api/sendemail", { username, email, otp });

      if (res.data.success) {
        toast.success(`OTP sent to ${email}`);
        setOtpSent(true);
      } else toast.error(res.data.message);
    } catch {
      toast.error("Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { username, email, password, otp, photo } = formData;

    if (!otpSent) return toast.error("Please send OTP first!");

    const snapshot = await get(child(dbRef(db), `otp/${email.replace(/\./g, "_")}`));
    if (!snapshot.exists()) return toast.error("OTP not found. Please resend.");
    const otpData = snapshot.val();
    if (Date.now() - otpData.createdAt > 10 * 60 * 1000) return toast.error("OTP expired.");
    if (parseInt(otp) !== otpData.otp) return toast.error("Invalid OTP.");

    if (!username || !email || !password || !photo) return toast.error("All fields are required!");
    if (usernameStatus === "taken") return toast.error(`Username taken! Try "${usernameSuggestion}"`);
    if (emailTaken) return toast.error("Email already in use!");

    try {
      setLoading(true);
      const photoURL = await uploadImage(photo);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: username, photoURL });

      await set(dbRef(db, `usersData/${user.uid}`), {
        uid: user.uid,
        username,
        email,
        photoURL,
        createdAt: Date.now(),
      });

      toast.success(`Registration successful! Your username: ${username}`);
      setTimeout(() => navigate("/login"), 1500);
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="register-container ">
      <div className="register-card">
        <div className="card-header">
          <div className="logo-container">
            <i className="fas fa-user-plus"></i>
          </div>
          <h3 className="card-title">Create Your Account</h3>
          <p className="card-subtitle">Join our community today</p>
        </div>

        <form onSubmit={handleSubmit} className="card-body">
          <div className="photo-upload-section">
            <div className="photo-preview" onClick={triggerFileInput}>
              {photoPreview ? (
                <img src={photoPreview} alt="Profile preview" className="preview-image" />
              ) : (
                <i className="fas fa-camera"></i>
              )}
            </div>
            <input
              type="file"
              name="photo"
              accept="image/*"
              onChange={handleChange}
              ref={fileInputRef}
              className="file-input"
              required
            />
            <p className="upload-text">Click to upload profile photo</p>
          </div>

          {/* Username */}
          <div className="input-group ">
            <i className="fas fa-user input-icon"></i>
            <input
              type="text"
              name="username"
              placeholder="Full Name"
              value={formData.username}
              onChange={handleChange}
              className="form-input"
              required
            />
          </div>
          {usernameStatus === "available" && <div className="status-message success">✔ Username available</div>}
          {usernameStatus === "taken" && (
            <div className="status-message error">
              Username taken! Try <b>{usernameSuggestion}</b>
            </div>
          )}
          {/* Email */}
          <div className="input-group ">
            <i className="fas fa-envelope input-icon"></i>
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              className="form-input"
              required
            />
          </div>
          {emailTaken && <div className="status-message error">Email already in use! Please login.</div>}

          {/* Send OTP Button */}
          {!otpSent && (
            <button
              type="button"
              className="btn-send-otp mt-2"
              onClick={sendOTP}
              disabled={loading || usernameStatus === "taken" || emailTaken}
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Sending OTP...
                </>
              ) : (
                <>
                  <i className="fas fa-paper-plane"></i> Send OTP
                </>
              )}
            </button>
          )}

          {/* Conditionally show OTP, Password and Register only after OTP sent */}
          {otpSent && (
            <>
              {/* OTP Field */}
              <div className="input-group">
                <i className="fas fa-key input-icon"></i>
                <input
                  type="text"
                  name="otp"
                  placeholder="Enter OTP"
                  value={formData.otp}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>

              {/* Password Field */}
              <div className="input-group">
                <i className="fas fa-lock input-icon"></i>
                <input
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>

              {/* Register Button */}
              <button className="btn-register" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Registering...
                  </>
                ) : (
                  <>
                    <i className="fas fa-user-plus"></i> Create Account
                  </>
                )}
              </button>
            </>
          )}

          <div className="card-footer">
            <button type="button" className="btn-back-to-login">
              <Link to="/login" className="nav-link">
                <i className="fas fa-arrow-left"></i> Back to Login
              </Link>
            </button>
            <p className="login-link">
              Already have an account? <Link to="/login">Login here</Link>
            </p>
          </div>
        </form>
      </div>
      <ToastContainer />
    </div>
  );
};

export default UserRegister;
