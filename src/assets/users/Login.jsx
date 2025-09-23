import React, { useState } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { db } from "../../assets/utils/firebaseConfig";
import { ref, set, get } from "firebase/database";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const Login = () => {
  const [formData, setFormData] = useState({ email: "", password: "", otp: "", newPassword: "" });
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("login"); // login | forgotEmail | verifyOtp | changePassword
  const [otpSent, setOtpSent] = useState(false);
  const [verified, setVerified] = useState(false);

  const auth = getAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // ---------------- LOGIN ----------------
  const handleLogin = async (e) => {
    e.preventDefault();
    const { email, password } = formData;
    if (!email || !password) return toast.error("Enter email and password!");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Login successful!");
      setTimeout(() => navigate("/home"), 1000);
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- SEND OTP ----------------
  const handleSendOtp = async () => {
    const { email } = formData;
    if (!email) return toast.error("Enter your email!");
    setLoading(true);
    try {
      const otp = Math.floor(100000 + Math.random() * 900000);
      await set(ref(db, `otp/${email.replace(/\./g, "_")}`), { otp, createdAt: Date.now() });
      // const res = await axios.post("http://localhost:5000/api/sendemail", { email, otp });
      const res = await axios.post("/api/sendemail", { email, otp });

      if (res.data.success) {
        toast.success(`OTP sent to ${email}`);
        setOtpSent(true);
        setStage("verifyOtp");
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to send OTP. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- VERIFY OTP ----------------
  const handleVerifyOtp = async () => {
    const { email, otp } = formData;
    if (!otp) return toast.error("Enter OTP!");
    setLoading(true);
    try {
      const snapshot = await get(ref(db, `otp/${email.replace(/\./g, "_")}`));
      if (!snapshot.exists()) return toast.error("OTP not found. Please resend.");
      const otpData = snapshot.val();
      if (Date.now() - otpData.createdAt > 10 * 60 * 1000) return toast.error("OTP expired.");
      if (parseInt(otp) !== Number(otpData.otp)) return toast.error("Invalid OTP.");

      toast.success("OTP verified! Enter new password.");
      setVerified(true);
      setStage("changePassword");
    } catch (err) {
      console.error(err);
      toast.error("OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- CHANGE PASSWORD ----------------
  const handleChangePassword = async () => {
    const { email, newPassword } = formData;
    if (!newPassword) return toast.error("Enter new password!");
    setLoading(true);
    try {
      // const res = await axios.post("http://localhost:5000/api/reset-password", { email, newPassword });
      const res = await axios.post("/api/reset-password", { email, newPassword });
      if (res.data.success) {
        toast.success("Password updated successfully!");
        setFormData({ email: "", password: "", otp: "", newPassword: "" });
        setStage("login");
        setOtpSent(false);
        setVerified(false);
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update password.");
    } finally {
      setLoading(false);
    }
  };
  const btns = (
    <button type="button" className="btn w-100" style={{ background: "#eb0000ff" }}>
      <Link to="/Register" className="nav-link fw-medium text-white">
        Back to Sign Up
      </Link>
    </button>
  );
  return (
    <div className="container mt-5" style={{ maxWidth: 400 }}>
      <h3 className="text-center pt-5 mt-5">Login / Forgot Password</h3>

      {/* ---------------- LOGIN FORM ---------------- */}
      {stage === "login" && (
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
          <button type="submit" className="btn btn-primary w-100 mb-2" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
          {btns}
          <button type="button" className="btn btn-link w-100" onClick={() => setStage("forgotEmail")}>
            Forgot Password?
          </button>
        </form>
      )}

      {/* ---------------- ENTER EMAIL FOR OTP ---------------- */}
      {stage === "forgotEmail" && (
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
          <button type="button" className="btn btn-primary fw-medium w-100 mb-2" onClick={handleSendOtp} disabled={loading}>
            {loading ? "Sending OTP..." : "Send OTP"}
          </button>
          {btns}
          <button type="button" className="btn btn-link w-100" onClick={() => setStage("login")}>
            Back to Login
          </button>
        </form>
      )}

      {/* ---------------- VERIFY OTP ---------------- */}
      {stage === "verifyOtp" && !verified && (
        <form className="card p-4 shadow-sm">
          <input
            type="text"
            name="otp"
            placeholder="Enter OTP"
            value={formData.otp}
            onChange={handleChange}
            className="form-control mb-3"
            required
          />
          <button type="button" className="btn btn-primary w-100 mb-2" onClick={handleVerifyOtp} disabled={loading}>
            {loading ? "Verifying OTP..." : "Verify OTP"}
          </button>
        </form>
      )}

      {/* ---------------- CHANGE PASSWORD ---------------- */}
      {stage === "changePassword" && verified && (
        <form className="card p-4 shadow-sm">
          <input
            type="password"
            name="newPassword"
            placeholder="Enter new password"
            value={formData.newPassword}
            onChange={handleChange}
            className="form-control mb-3"
            required
          />
          <button type="button" className="btn btn-success w-100" onClick={handleChangePassword} disabled={loading}>
            {loading ? "Updating..." : "Change Password"}
          </button>
        </form>
      )}

      <ToastContainer />
    </div>
  );
};

export default Login;
