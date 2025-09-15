// src/assets/users/UserRegister.jsx
import React, { useState, useRef } from "react";
import emailjs from "emailjs-com";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { db } from "../../assets/utils/firebaseConfig";
import { ref as dbRef, set, get } from "firebase/database";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { useNavigate, Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const UserRegister = () => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    otp: "",
    password: "",
    photo: null,
  });

  const [usernameTaken, setUsernameTaken] = useState(false);
  const [usernameSuggestion, setUsernameSuggestion] = useState("");
  const [emailTaken, setEmailTaken] = useState(false);

  const [generatedOTP, setGeneratedOTP] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef();
  const auth = getAuth();
  const storage = getStorage();
  const navigate = useNavigate();

  let typingTimeout = null;

  // Input change
  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "photo") {
      setFormData({ ...formData, photo: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });

      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        if (name === "username") checkUsername(value);
        if (name === "email") checkEmail(value);
      }, 500);
    }
  };

  // Upload image with Cloudinary + fallback Firebase
  const uploadImage = async (file) => {
    try {
      // Upload to Cloudinary
      const uploadData = new FormData();
      uploadData.append("file", file);
      uploadData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      uploadData.append("folder", "profile_pics");

      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        uploadData
      );

      return res.data.secure_url;
    } catch (cloudErr) {
      console.warn("Cloudinary failed, falling back to Firebase:", cloudErr);
      // Fallback to Firebase Storage
      const storagePath = `profilePics/${Date.now()}_${file.name}`;
      const fileRef = storageRef(storage, storagePath);
      await uploadBytes(fileRef, file);
      return await getDownloadURL(fileRef);
    }
  };

  // Check username availability
  const checkUsername = async (username) => {
    if (!username) return;
    const snapshot = await get(dbRef(db, "usersData"));
    const users = snapshot.val();
    const usernames = users
      ? Object.values(users).map((u) => u.username.toLowerCase())
      : [];

    if (usernames.includes(username.toLowerCase())) {
      setUsernameTaken(true);
      let counter = 1;
      let suggestion = `${username}_${counter}`;
      while (usernames.includes(suggestion.toLowerCase())) {
        counter++;
        suggestion = `${username}_${counter}`;
      }
      setUsernameSuggestion(suggestion);
    } else {
      setUsernameTaken(false);
      setUsernameSuggestion("");
    }
  };

  // Check email availability
  const checkEmail = async (email) => {
    if (!email) return;
    const snapshot = await get(dbRef(db, "usersData"));
    const users = snapshot.val();
    const emails = users
      ? Object.values(users).map((u) => u.email.toLowerCase())
      : [];
    setEmailTaken(emails.includes(email.toLowerCase()));
  };

  // Send OTP
  const sendOTP = async () => {
    const { username, email } = formData;
    if (!username || !email) {
      toast.error("Enter username and email first.");
      return;
    }
    if (usernameTaken) {
      toast.error(`Username "${username}" is already taken!`);
      return;
    }
    if (emailTaken) {
      toast.error("Email already in use! Please login.");
      return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000);
    setGeneratedOTP(otp);

    try {
      setLoading(true);
      await emailjs.send(
        import.meta.env.VITE_SERVICE_ID,
        import.meta.env.VITE_EMAIL_TEMPLETE_ID,
        { username, email, otp },
        import.meta.env.VITE_EMAIL_API_KEY
      );
      toast.success(`OTP sent to ${email}`);
      setOtpSent(true);
    } catch (error) {
      console.error(error);
      toast.error("Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  // Register User
  const handleSubmit = async (e) => {
    e.preventDefault();
    const { username, email, password, otp, photo } = formData;

    if (!otpSent) {
      toast.error("Please send OTP first!");
      return;
    }
    if (!otp || parseInt(otp) !== generatedOTP) {
      toast.error("Invalid or missing OTP.");
      return;
    }
    if (!username || !email || !password || !photo) {
      toast.error("All fields are required!");
      return;
    }
    if (usernameTaken) {
      toast.error(
        `Username "${username}" is already taken! Try "${usernameSuggestion}"`
      );
      return;
    }
    if (emailTaken) {
      toast.error("Email already in use! Please login.");
      return;
    }

    setLoading(true);
    try {
      const photoURL = await uploadImage(photo);

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
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
      setTimeout(() => navigate("/login"), 500);
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: 400 }}>
      <h3 className="text-center mb-4">Register</h3>
      <form onSubmit={handleSubmit} className="card p-4 shadow-sm">
        <input
          type="file"
          name="photo"
          accept="image/*"
          onChange={handleChange}
          ref={fileInputRef}
          className="form-control mb-3"
          required
        />

        <input
          type="text"
          name="username"
          placeholder="Full Name"
          value={formData.username}
          onChange={handleChange}
          className="form-control mb-1"
          required
        />
        {usernameTaken && (
          <small className="text-danger mb-2 d-block">
            Username taken! Try "{usernameSuggestion}"
          </small>
        )}

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          className="form-control mb-1"
          required
        />
        {emailTaken && (
          <small className="text-danger mb-2 d-block">
            Email already in use! Please login.
          </small>
        )}

        <button
          type="button"
          className="btn btn-primary w-100 mb-3"
          onClick={sendOTP}
          disabled={loading || otpSent || usernameTaken || emailTaken}
        >
          {loading ? "Sending OTP..." : otpSent ? "OTP Sent" : "Send OTP"}
        </button>

        <input
          type="text"
          name="otp"
          placeholder="Enter OTP"
          value={formData.otp}
          onChange={handleChange}
          className="form-control mb-3"
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          className="form-control mb-3"
          required
        />

        <button
          className="btn btn-success w-100"
          type="submit"
          disabled={loading}
        >
          {loading ? "Registering..." : "Register"}
        </button>
      </form>

      <p className="text-center mt-3">
        Already have an account? <Link to="/login">Login</Link>
      </p>
      <ToastContainer />
    </div>
  );
};

export default UserRegister;
