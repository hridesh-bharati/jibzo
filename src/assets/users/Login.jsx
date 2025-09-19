// src/assets/users/Login.jsx
import React, { useState } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import emailjs from "@emailjs/browser";

// ---------------- EMAIL UTILS ----------------

// Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Generate expiry time (1 min from now)
const getExpiryTime = () => {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + 1);
  return expiry.toLocaleTimeString(); // HH:MM:SS
};

// Send OTP email via EmailJS
const sendResetEmail = async (email) => {
  const otp = generateOTP();
  const expiryTime = getExpiryTime();

  const serviceId = import.meta.env.VITE_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAIL_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAIL_API_KEY;

  const templateParams = {
    user_email: email,
    otp,
    expiryTime,
  };

  console.log("Sending OTP Email:", templateParams); // Debugging

  try {
    const response = await emailjs.send(
      serviceId,
      templateId,
      templateParams,
      publicKey
    );
    return { success: true, response, otp, expiryTime };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error };
  }
};

// ---------------- LOGIN COMPONENT ----------------

const Login = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [resetStage, setResetStage] = useState(false);

  const auth = getAuth();
  const navigate = useNavigate();

  // ---------------- HANDLE INPUT ----------------
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ---------------- NORMAL LOGIN ----------------
  const handleLogin = async (e) => {
    e.preventDefault();
    const { email, password } = formData;
    if (!email || !password) return toast.error("All fields are required!");

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Login successful!");
      setTimeout(() => navigate("/home"), 1200);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- FORGOT PASSWORD ----------------
  const handleForgotPassword = async () => {
    const { email } = formData;
    if (!email) return toast.error("Enter your email!");

    setLoading(true);
    try {
      const { success, otp, expiryTime, error } = await sendResetEmail(email);

      if (success) {
        toast.success(`OTP sent to ${email}. Expires at ${expiryTime}`);
        console.log("Generated OTP:", otp); // Debugging: remove in production
        setResetStage(false);
        setFormData({ email: "", password: "" });
      } else {
        console.error(error);
        toast.error("Failed to send OTP. Try again later.");
      }
    } catch (err) {
      toast.error("Something went wrong!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: 400 }}>
      <h3 className="text-center mb-4">
        {resetStage ? "Forgot Password" : "Login"}
      </h3>

      {!resetStage ? (
        // ---------------- LOGIN FORM ----------------
        <form onSubmit={handleLogin} className="card p-4 shadow-sm">
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
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
            type="submit"
            className="btn btn-primary w-100 mb-2"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
          <button
            type="button"
            className="btn btn-link w-100"
            onClick={() => setResetStage(true)}
          >
            Forgot Password?
          </button>
        </form>
      ) : (
        // ---------------- FORGOT PASSWORD FORM ----------------
        <form className="card p-4 shadow-sm">
          <input
            type="email"
            name="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={handleChange}
            className="form-control mb-3"
            required
          />
          <button
            type="button"
            className="btn btn-primary w-100 mb-2"
            onClick={handleForgotPassword}
            disabled={loading}
          >
            {loading ? "Sending..." : "Send OTP"}
          </button>
          <button
            type="button"
            className="btn btn-link w-100"
            onClick={() => setResetStage(false)}
          >
            Back to Login
          </button>
        </form>
      )}

      <p className="text-center mt-3">
        Don’t have an account? <Link to="/register">Register</Link>
      </p>

      <ToastContainer />
    </div>
  );
};

export default Login;
