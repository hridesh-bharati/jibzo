// src/assets/users/Login.jsx
import React, { useState } from "react";
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [resetStage, setResetStage] = useState(false); // false = login, true = forgot password

  const auth = getAuth();
  const navigate = useNavigate();

  // Input handler
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Normal login
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

  // Send password reset email
  const handleForgotPassword = async () => {
    const { email } = formData;
    if (!email) return toast.error("Enter your email!");

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success(`Password reset email sent to ${email}`);
      setResetStage(false); // back to login
      setFormData({ email: "", password: "" });
    } catch (error) {
      toast.error(error.message);
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
        // ----------------- LOGIN FORM -----------------
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
        // ----------------- FORGOT PASSWORD FORM -----------------
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
            {loading ? "Sending..." : "Send Reset Email"}
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
