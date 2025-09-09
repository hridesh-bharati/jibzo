import React, { useState, useRef } from "react";
import emailjs from "emailjs-com";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { db, ref, set } from "../../assets/utils/firebaseConfig";
import { useNavigate,Link } from "react-router-dom";
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
  const [generatedOTP, setGeneratedOTP] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef();
  const auth = getAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "photo") {
      setFormData({ ...formData, photo: files[0] });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // Upload image to imgbb
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

  // Generate and send OTP
  const sendOTP = async () => {
    const { username, email } = formData;
    if (!username || !email) {
      toast.error("Please enter username and email first.");
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

    if (!otp || parseInt(otp) !== generatedOTP) {
      toast.error("Invalid or missing OTP.");
      return;
    }

    if (!username || !email || !password || !photo) {
      toast.error("All fields are required!");
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

      toast.success("Registration successful! Please login.");
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
          className="form-control mb-3"
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          className="form-control mb-3"
          required
        />
        <button
          type="button"
          className="btn btn-primary w-100 mb-3"
          onClick={sendOTP}
          disabled={loading}
        >
          {loading ? "Sending OTP..." : "Send OTP"}
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
