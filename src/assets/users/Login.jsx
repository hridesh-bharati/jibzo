import React, { useState } from "react";
import { getAuth, signInWithEmailAndPassword, updatePassword } from "firebase/auth";
import { ref, get } from "../../assets/utils/firebaseConfig";
import { db } from "../../assets/utils/firebaseConfig";
import { useNavigate, Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import emailjs from "emailjs-com";

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    otp: "",
    newPassword: "",
    repeatPassword: "",
  });
  const [stage, setStage] = useState("login"); // login, email, otp, reset
  const [generatedOTP, setGeneratedOTP] = useState(null);
  const [loading, setLoading] = useState(false);

  const auth = getAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Login submit
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

  // Send OTP to email
  const sendOTP = async () => {
    const { email } = formData;
    if (!email) return toast.error("Enter your email!");
    const otp = Math.floor(100000 + Math.random() * 900000);
    setGeneratedOTP(otp);
    setLoading(true);
    try {
      await emailjs.send(
        import.meta.env.VITE_SERVICE_ID,
        import.meta.env.VITE_EMAIL_TEMPLETE_ID,
        { email, otp },
        import.meta.env.VITE_EMAIL_API_KEY
      );
      toast.success(`OTP sent to ${email}`);
      setStage("otp");
    } catch (error) {
      toast.error("Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const verifyOTP = () => {
    const { otp } = formData;
    if (!otp || parseInt(otp) !== generatedOTP) return toast.error("Invalid OTP!");
    toast.success("OTP verified!");
    setStage("reset");
  };

  // Reset password
  const resetPassword = async () => {
    const { email, newPassword, repeatPassword } = formData;
    if (!newPassword || !repeatPassword) return toast.error("Enter new password!");
    if (newPassword !== repeatPassword) return toast.error("Passwords do not match!");

    setLoading(true);
    try {
      const snapshot = await get(ref(db, "usersData"));
      const users = snapshot.val();
      const userEntry = users && Object.values(users).find(u => u.email === email);
      if (!userEntry) throw new Error("No user found with this email!");

      // Temporary login required
      await signInWithEmailAndPassword(auth, email, "temp"); // Replace with real old password if known
      const user = auth.currentUser;
      if (!user) throw new Error("User not signed in!");

      await updatePassword(user, newPassword);
      toast.success("Password reset successful!");
      setStage("login");
      setFormData({ email: "", password: "", otp: "", newPassword: "", repeatPassword: "" });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: 400 }}>
      <h3 className="text-center mb-4">
        {stage === "login" && "Login"}
        {stage === "email" && "Forgot Password"}
        {stage === "otp" && "Enter OTP"}
        {stage === "reset" && "Reset Password"}
      </h3>

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
          <button type="button" className="btn btn-link w-100" onClick={() => setStage("email")}>
            Forgot Password?
          </button>
        </form>
      )}

      {stage === "email" && (
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
          <button type="button" className="btn btn-primary w-100" onClick={sendOTP} disabled={loading}>
            {loading ? "Sending OTP..." : "Send OTP"}
          </button>
        </form>
      )}

      {stage === "otp" && (
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
          <button type="button" className="btn btn-success w-100" onClick={verifyOTP}>
            Verify OTP
          </button>
        </form>
      )}

      {stage === "reset" && (
        <form className="card p-4 shadow-sm">
          <input
            type="password"
            name="newPassword"
            placeholder="New Password"
            value={formData.newPassword}
            onChange={handleChange}
            className="form-control mb-3"
            required
          />
          <input
            type="password"
            name="repeatPassword"
            placeholder="Repeat New Password"
            value={formData.repeatPassword}
            onChange={handleChange}
            className="form-control mb-3"
            required
          />
          <button type="button" className="btn btn-success w-100" onClick={resetPassword} disabled={loading}>
            {loading ? "Resetting..." : "Reset Password"}
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
