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

  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef();
  const auth = getAuth();
  const storage = getStorage();
  const navigate = useNavigate();

  let typingTimeout = null;

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

  const checkUsername = async (username) => {
    if (!username) return;
    const snapshot = await get(dbRef(db, "usersData"));
    const users = snapshot.val();
    const usernames = users
      ? Object.values(users)
        .map((u) => u?.username?.toLowerCase())
        .filter(Boolean)
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

  const checkEmail = async (email) => {
    if (!email) return;
    const snapshot = await get(dbRef(db, "usersData"));
    const users = snapshot.val();
    const emails = users
      ? Object.values(users)
        .map((u) => u?.email?.toLowerCase())
        .filter(Boolean)
      : [];
    setEmailTaken(emails.includes(email.toLowerCase()));
  };

  const sendOTP = async () => {
    const { username, email } = formData;
    if (!username || !email) return toast.error("Enter username and email first.");
    if (usernameTaken) return toast.error(`Username "${username}" is already taken!`);
    if (emailTaken) return toast.error("Email already in use! Please login.");

    const otp = Math.floor(100000 + Math.random() * 900000);

    try {
      setLoading(true);
      // Save OTP in Firebase DB
      await set(dbRef(db, `otp/${email.replace(/\./g, "_")}`), {
        otp,
        createdAt: Date.now(),
      });

      // Send OTP via backend
      // const res = await axios.post("http://localhost:5000/api/sendemail", { username, email, otp });
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
    if (usernameTaken) return toast.error(`Username "${username}" taken! Try "${usernameSuggestion}"`);
    if (emailTaken) return toast.error("Email already in use!");

    try {
      setLoading(true);
      const photoURL = await uploadImage(photo);

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: username, photoURL });

      // Save to DB
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

  return (
    <div className="container mt-5" style={{ maxWidth: 400 }}>
      <h3 className="text-center mb-4">Register</h3>
      <form onSubmit={handleSubmit} className="card p-4 shadow-sm">
        <input type="file" name="photo" accept="image/*" onChange={handleChange} ref={fileInputRef} className="form-control mb-3" required />

        <input type="text" name="username" placeholder="Full Name" value={formData.username} onChange={handleChange} className="form-control mb-1" required />
        {usernameTaken && <small className="text-danger mb-2 d-block">Username taken! Try "{usernameSuggestion}"</small>}

        <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} className="form-control mb-1" required />
        {emailTaken && <small className="text-danger mb-2 d-block">Email already in use! Please login.</small>}

        <button type="button" className="btn btn-primary w-100 mb-3" onClick={sendOTP} disabled={loading || otpSent || usernameTaken || emailTaken}>
          {loading ? "Sending OTP..." : otpSent ? "OTP Sent" : "Send OTP"}
        </button>

        <input type="text" name="otp" placeholder="Enter OTP" value={formData.otp} onChange={handleChange} className="form-control mb-3" required />
        <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} className="form-control mb-3" required />

        <button className="btn btn-success w-100" type="submit" disabled={loading}>
          {loading ? "Registering..." : "Register"}
        </button>
      </form>
      <p className="text-center mt-3">Already have an account? <Link to="/login">Login</Link></p>
      <ToastContainer />
    </div>
  );
};

export default UserRegister;
