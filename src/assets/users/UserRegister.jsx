// src/assets/users/UserRegister.jsx
import React, { useState, useRef } from "react";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  updatePassword,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
} from "firebase/auth";
import { db } from "../../assets/utils/firebaseConfig";
import { ref as dbRef, set, get, child, update } from "firebase/database";
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false); // ✅ MODAL STATE
  const [socialUser, setSocialUser] = useState(null); // ✅ SOCIAL USER STATE
  const [setupPassword, setSetupPassword] = useState(""); // ✅ PASSWORD STATE
  const [setupPasswordLoading, setSetupPasswordLoading] = useState(false);

  const fileInputRef = useRef();
  const auth = getAuth();
  const storage = getStorage();
  const navigate = useNavigate();
  const googleProvider = new GoogleAuthProvider();
  const githubProvider = new GithubAuthProvider();
  let typingTimeout = null;

  // Add scopes for better user info
  googleProvider.addScope('profile');
  googleProvider.addScope('email');
  githubProvider.addScope('user:email');

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
        authProvider: "email",
      });

      toast.success(`Registration successful! Your username: ${username}`);
      setTimeout(() => navigate("/"), 1500);
    } catch (error) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error("Email already registered. Please login or use another email.");
      } else {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ IMPROVED PASSWORD SETUP FUNCTION
  const handleSetupPassword = async () => {
    if (!setupPassword || setupPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    try {
      setSetupPasswordLoading(true);
      await updatePassword(socialUser, setupPassword);

      // Update database
      await update(dbRef(db, `usersData/${socialUser.uid}`), {
        passwordNotSet: false
      });

      toast.success("🔒 Password set successfully! You can now login with email/password");
      setShowPasswordModal(false);
      setSetupPassword("");
      setTimeout(() => navigate("/"), 1000);
    } catch (error) {
      console.error("Password setup error:", error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error("Session expired. Please login again to set password.");
        setShowPasswordModal(false);
        navigate("/login");
      } else {
        toast.error("Failed to set password. You can set it later from settings.");
        setShowPasswordModal(false);
        navigate("/");
      }
    } finally {
      setSetupPasswordLoading(false);
    }
  };

  // ✅ CORRECTED SOCIAL SIGN-IN HANDLER
  const handleSocialSignIn = async (provider, providerName) => {
    try {
      console.log(`🔄 Starting ${providerName} sign-in...`);

      if (providerName === 'google') setGoogleLoading(true);
      if (providerName === 'github') setGithubLoading(true);

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      console.log('✅ Firebase Auth Success:', user.uid);

      // ✅ CORRECT DATABASE REFERENCE - usersData में save करें
      const userRef = dbRef(db, `usersData/${user.uid}`);
      const userSnapshot = await get(userRef);

      console.log('📊 usersData Check Result:', userSnapshot.exists());

      if (!userSnapshot.exists()) {
        console.log('🆕 New user - creating profile in usersData...');

        // New user - create record in CORRECT database location
        const userData = {
          uid: user.uid,
          username: user.displayName ||
            user.email?.split('@')[0] ||
            `${providerName}_user_${user.uid.slice(0, 6)}`,
          email: user.email || `${user.uid}@${providerName}.com`,
          photoURL: user.photoURL || "/default-avatar.png",
          createdAt: Date.now(),
          authProvider: providerName,
          passwordNotSet: true
        };

        console.log('💾 Saving to usersData:', userData);

        // ✅ Save to CORRECT location: usersData/{uid}
        await set(userRef, userData);
        console.log('✅ User data successfully written to usersData');

        // Verify
        const verifySnapshot = await get(userRef);
        console.log('🔍 usersData Verification:', verifySnapshot.exists());

        // Show password setup modal
        setSocialUser(user);
        setShowPasswordModal(true);

        toast.success(`Welcome ${user.displayName || user.email}! Account created successfully!`);
      } else {
        // Existing user - direct login
        const userData = userSnapshot.val();
        console.log('👋 Existing user in usersData:', userData);

        toast.success(`Welcome back ${userData.username || user.email}!`);
        setTimeout(() => navigate("/"), 1000);
      }

    } catch (error) {
      console.error(`❌ ${providerName} Sign-In Error:`, error);
      // ... error handling same as before
    } finally {
      setGoogleLoading(false);
      setGithubLoading(false);
    }
  };
  // Google Sign-In Handler
  const handleGoogleSignIn = () => handleSocialSignIn(googleProvider, 'google');

  // GitHub Sign-In Handler
  const handleGitHubSignIn = () => handleSocialSignIn(githubProvider, 'github');

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="register-container p-0 m-0">
      {/* ✅ PASSWORD SETUP MODAL */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="password-modal">
            <div className="modal-header">
              <h3>Set Password</h3>
              <button
                className="close-btn"
                onClick={() => {
                  setShowPasswordModal(false);
                  navigate("/");
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>Set a password for email login (optional but recommended)</p>
              <input
                type="password"
                placeholder="Enter password (min 6 characters)"
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                className="form-input"
              />
              <small className="text-muted">
                This will allow you to login with email and password in future
              </small>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowPasswordModal(false);
                  toast.info("You can set password later from settings.");
                  navigate("/");
                }}
                disabled={setupPasswordLoading}
              >
                Skip for Now
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSetupPassword}
                disabled={setupPasswordLoading || !setupPassword}
              >
                {setupPasswordLoading ? "Setting..." : "Set Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="register-card p-0 m-0">
        <div className="card-header rounded-0">
          <div className="d-flex align-items-center m-0 p-0 gap-0">
            <div className="logo-container overflow-hidden">
              <img src="icons/icon-192.png" className="img-fluid" alt="jibzo" />
            </div>
            <div>
              <h1 className="card-title ln-0 p-0 m-0">Create Account</h1>
              <p className="card-subtitle  ln-0 p-0 m-0">Join our community today</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="card-content">
          {/* Social Login Section */}
          <div className="social-section m-0 p-0">
            <div className="social-buttons m-0 p-0">
              <button
                className="social-btn google-btn p-0 m-0"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : (
                  <img
                    src="https://developers.google.com/identity/images/g-logo.png"
                    alt="Google"
                    className="social-logo"
                  />)}<span>Google</span>
              </button>

              <button
                className="social-btn github-btn"
                onClick={handleGitHubSignIn}
                disabled={githubLoading}
              >
                {githubLoading ? (
                  <i className="bi bi-spinner fa-spin"></i>
                ) : (
                  <i className="bi bi-github social-logo"></i>)} <span>GitHub</span>
              </button>
            </div>
            <hr />
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="registration-form">
            {/* Profile Photo */}
            <div className="photo-section">
              <div className="photo-upload" onClick={triggerFileInput}>
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" className="photo-preview" />
                ) : (
                  <div className="photo-placeholder">
                    <i className="fas fa-camera"></i>
                  </div>
                )}
                <div className="photo-overlay">
                  <i className="fas fa-edit"></i>
                </div>
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
              <p className="photo-text">Tap to add profile photo</p>
            </div>

            {/* Form Fields */}
            <div className="form-fields">
              {/* Username */}
              <div className="input-field">
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

              {usernameStatus === "available" && (
                <div className="status success">
                  <i className="fas fa-check"></i> Username available
                </div>
              )}
              {usernameStatus === "taken" && (
                <div className="status error">
                  <i className="fas fa-times"></i> Try: <strong>{usernameSuggestion}</strong>
                </div>
              )}

              {/* Email */}
              <div className="input-field">
                <i className="fas fa-envelope input-icon"></i>
                <input
                  type="email"
                  name="email"
                  placeholder="Email Address"
                  value={formData.email}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>

              {emailTaken && (
                <div className="status error">
                  <i className="fas fa-exclamation-triangle"></i> Email already registered
                </div>
              )}

              {/* OTP Section */}
              {!otpSent ? (
                <button
                  type="button"
                  className="otp-btn"
                  onClick={sendOTP}
                  disabled={loading || usernameStatus === "taken" || emailTaken}
                >
                  {loading ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i>
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-shield-alt"></i>
                      Send Verification Code
                    </>
                  )}
                </button>
              ) : (
                <div className="otp-section">
                  <div className="input-field">
                    <i className="fas fa-key input-icon"></i>
                    <input
                      type="text"
                      name="otp"
                      placeholder="Enter 6-digit OTP"
                      value={formData.otp}
                      onChange={handleChange}
                      className="form-input"
                      maxLength="6"
                      required
                    />
                  </div>

                  <div className="input-field">
                    <i className="fas fa-lock input-icon"></i>
                    <input
                      type="password"
                      name="password"
                      placeholder="Create Password"
                      value={formData.password}
                      onChange={handleChange}
                      className="form-input"
                      required
                    />
                  </div>

                  <button type="submit" className="register-btn" disabled={loading}>
                    {loading ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        Creating Account...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-user-plus"></i>
                        Create Account
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </form>

          {/* Footer */}
          <div className="card-footer">
            <p className="login-prompt">
              Already have an account? <Link to="/login" className="login-link">Sign In</Link>
            </p>
            <Link to="/login" className="back-link">
              <i className="fas fa-arrow-left"></i>
              Back to Login
            </Link>
          </div>
        </div>
      </div>
      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </div>
  );
};

export default UserRegister;