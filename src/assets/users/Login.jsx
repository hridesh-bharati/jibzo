// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import { FirebaseError } from "firebase/app";
import "react-toastify/dist/ReactToastify.css";
import { requestForToken } from "../utils/PushNotification";

const Login = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const auth = getAuth();
  const navigate = useNavigate();

  // 🔹 Request FCM token when user is logged in
  useEffect(() => {
    if (auth.currentUser?.uid) {
      requestForToken(auth.currentUser.uid);
    }
  }, [auth.currentUser]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { email, password } = formData;

    if (!email || !password) {
      toast.error("All fields are required!");
      return;
    }

    setLoading(true);
    try {
      // 🔹 Sign in
      await signInWithEmailAndPassword(auth, email, password);

      // 🔹 Save FCM token right after login
      if (auth.currentUser?.uid) {
        await requestForToken(auth.currentUser.uid);
      }

      toast.success("Login successful!");
      setTimeout(() => navigate("/home"), 1200);
    } catch (error) {
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case "auth/invalid-email":
            toast.error("Invalid email address!");
            break;
          case "auth/wrong-password":
            toast.error("Wrong password!");
            break;
          case "auth/user-not-found":
            toast.error("No user found with this email!");
            break;
          default:
            toast.error("Login failed. Please try again.");
        }
      } else {
        toast.error("Something went wrong!");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: 400 }}>
      <h3 className="text-center mb-4">Login</h3>
      <form onSubmit={handleSubmit} className="card p-4 shadow-sm">
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
          className="btn btn-primary w-100"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
      <p className="text-center mt-3">
        Don’t have an account? <Link to="/register">Register</Link>
      </p>
      <ToastContainer />
    </div>
  );
};

export default Login;
