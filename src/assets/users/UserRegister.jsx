import React, { useState, useRef } from "react";
import emailjs from "emailjs-com";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { db, ref, set, get } from "../../assets/utils/firebaseConfig";
import { useNavigate, Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY;

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
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!data.success) throw new Error("Image upload failed!");
    return data.data.url;
  };

  const checkUsername = async (username) => {
    if (!username) return;
    const snapshot = await get(ref(db, "usersData"));
    const users = snapshot.val();
    const usernames = users ? Object.values(users).map(u => u.username.toLowerCase()) : [];

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
    const snapshot = await get(ref(db, "usersData"));
    const users = snapshot.val();
    const emails = users ? Object.values(users).map(u => u.email.toLowerCase()) : [];
    setEmailTaken(emails.includes(email.toLowerCase()));
  };

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
      toast.error(`Username "${username}" is already taken! Try "${usernameSuggestion}"`);
      return;
    }
    if (emailTaken) {
      toast.error("Email already in use! Please login.");
      return;
    }

    setLoading(true);
    try {
      const photoURL = await uploadImage(photo);

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: username, photoURL });

      await set(ref(db, `usersData/${user.uid}`), {
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

        <button className="btn btn-success w-100" type="submit" disabled={loading}>
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
