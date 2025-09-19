import React, { useEffect, useState, useRef } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update } from "firebase/database";
import {
  signOut,
  updateProfile,
  onAuthStateChanged,
  updateEmail,
  sendEmailVerification,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "firebase/auth";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import DeleteAccount from "./DeleteAccount";
import "./AdminProfile.css"
import GetPost from "../uploads/GetPost";

/* =========================
   Fullscreen Video Feed
========================= */
const VideoFeed = ({ videos, startIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const containerRef = useRef(null);
  const videoRefs = useRef([]);

  useEffect(() => {
    if (containerRef.current && videos.length > 0) {
      containerRef.current.scrollTo({ top: startIndex * window.innerHeight });
    }
  }, [startIndex, videos.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const index = Math.round(container.scrollTop / window.innerHeight);
      if (index !== currentIndex && index >= 0 && index < videos.length) {
        setCurrentIndex(index);
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [currentIndex, videos.length]);

  useEffect(() => {
    videoRefs.current.forEach((vid, i) => {
      if (!vid) return;
      if (i === currentIndex) {
        vid.play().catch(() => { });
      } else {
        vid.pause();
      }
    });
  }, [currentIndex]);

  if (!videos || videos.length === 0) return null;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 bg-black"
      style={{ zIndex: 1050, overflowY: "scroll", scrollSnapType: "y mandatory" }}
      ref={containerRef}
    >
      {videos.map((video, i) => (
        <div
          key={video.id || i}
          style={{
            height: "100vh",
            width: "100%",
            scrollSnapAlign: "start",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
            background: "black",
          }}
        >
          <video
            ref={(el) => (videoRefs.current[i] = el)}
            src={video.src}
            style={{ maxWidth: "100%", maxHeight: "90vh" }}
            loop
            controls={false}
          />
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "rgba(12,4,4,0.5)",
              border: "none",
              color: "#fff",
              padding: "8px 12px",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Close ✕
          </button>
        </div>
      ))}
    </div>
  );
};

/* =========================
   Fullscreen Image Viewer
========================= */
const ImageViewer = ({ src, onClose }) => (
  <div
    className="position-fixed top-0 start-0 w-100 h-100 bg-black d-flex justify-content-center align-items-center"
    style={{ zIndex: 1050 }}
    onClick={onClose}
  >
    <img src={src} alt="Fullscreen" style={{ maxHeight: "90%", maxWidth: "90%" }} />
  </div>
);

const AdminProfile = () => {
  const [profileData, setProfileData] = useState(null);
  // Removed userPosts state
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [bio, setBio] = useState("");
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [showVideoFeed, setShowVideoFeed] = useState(false);
  const [videoStartIndex, setVideoStartIndex] = useState(0);
  const [showImageViewer, setShowImageViewer] = useState(null);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [requested, setRequested] = useState([]);
  const [socialLinks, setSocialLinks] = useState({ list: [] });
  const [wallpaper, setWallpaper] = useState("");

  // Email Update states
  const [currentEmail, setCurrentEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailUpdateLoading, setEmailUpdateLoading] = useState(false);

  // Password Update states
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordUpdateLoading, setPasswordUpdateLoading] = useState(false);

  // For Accordion profile-actions canvas
  const [currentPassword, setCurrentPassword] = useState("");

  const navigate = useNavigate();
  const { uid: paramUid } = useParams();
  const [currentUser, setCurrentUser] = useState(null);
  const uid = paramUid || currentUser?.uid;

  const cloudinaryPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const cloudinaryCloud = import.meta.env.VITE_CLOUDINARY_NAME;

  // Password validation
  const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    return password.length >= minLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumbers &&
      hasSpecialChar;
  };

  // Firebase auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user && !paramUid) navigate("/login");
      setCurrentUser(user);
      if (user) {
        setCurrentEmail(user.email || "");
      }
    });
    return () => unsubscribe();
  }, [paramUid, navigate]);

  // Fetch user data (removed posts fetch)
  useEffect(() => {
    if (!uid) return;

    const userRef = ref(db, `usersData/${uid}`);
    const unsubscribeUser = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setProfileData(data);
        setBio(data.bio || "");
        setWallpaper(data.wallpaper || "");
        setFollowers(Object.keys(data.followers || {}));
        setFollowing(Object.keys(data.following || {}));
        setRequested(Object.keys(data.followRequests?.received || {}));

        // Handle social links
        const linksList = data.socialLinks
          ? Object.entries(data.socialLinks)
            .filter(([_, link]) => link)
            .map(([_, url]) => ({ url }))
          : [];
        setSocialLinks({ list: linksList });
      } else {
        setProfileData(null);
      }
      setLoading(false);
    });

    // Removed postsRef and posts fetching

    return () => {
      unsubscribeUser();
      // Removed unsubscribePosts
    };
  }, [uid]);

  // Upload DP
  const handleDpUpdate = async () => {
    if (!currentUser || !file) return toast.warn("Select an image first!");
    if (!cloudinaryPreset || !cloudinaryCloud) return toast.error("Cloudinary ENV missing");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", cloudinaryPreset);
      const res = await axios.post(`https://api.cloudinary.com/v1_1/${cloudinaryCloud}/image/upload`, formData);
      const photoURL = res.data.secure_url;

      await update(ref(db, `usersData/${currentUser.uid}`), { photoURL });
      await updateProfile(currentUser, { photoURL });
      setProfileData((prev) => ({ ...prev, photoURL }));
      toast.success("🎉 Profile picture updated!");
    } catch (err) {
      console.error(err);
      toast.error("❌ Error uploading DP!");
    } finally {
      setFile(null);
      setUploading(false);
    }
  };

  // Upload Wallpaper
  const handleChangeWallpaper = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", cloudinaryPreset);
        const res = await axios.post(`https://api.cloudinary.com/v1_1/${cloudinaryCloud}/image/upload`, formData);
        const wallpaperURL = res.data.secure_url;
        await update(ref(db, `usersData/${currentUser.uid}`), { wallpaper: wallpaperURL });
        setWallpaper(wallpaperURL);
        toast.success("🖼️ Wallpaper updated!");
      } catch (err) {
        console.error(err);
        toast.error("❌ Error uploading wallpaper!");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  // Update Bio
  const handleBioUpdate = async () => {
    if (!currentUser) return;
    try {
      await update(ref(db, `usersData/${currentUser.uid}`), { bio });
      setProfileData((prev) => ({ ...prev, bio }));
      toast.success("📝 Bio updated!");
    } catch {
      toast.error("❌ Failed to update bio!");
    }
  };

  const handleEmailUpdate = async () => {
    const passwordToUse = emailPassword || currentPassword;
    if (!currentUser || !passwordToUse)
      return toast.warn("Enter your current password!");

    setEmailUpdateLoading(true);
    try {
      // Re-authenticate user with current email + password
      const credential = EmailAuthProvider.credential(currentUser.email, passwordToUse);
      await reauthenticateWithCredential(currentUser, credential);

      // Update email with current email (no change needed)
      // This function is now just for verification/reauthentication

      // Send verification
      await sendEmailVerification(currentUser);

      setEmailPassword("");
      setCurrentPassword("");

      toast.success("✅ Email verified! Check your inbox for the verification email.");
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setEmailUpdateLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    const passwordToUse = passwordCurrent || currentPassword;
    if (!currentUser || !passwordToUse || !newPassword)
      return toast.warn("Fill all required fields!");

    if (!validatePassword(newPassword)) {
      return toast.error("Password must include uppercase, lowercase, number, and special character!");
    }

    setPasswordUpdateLoading(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, passwordToUse);
      await reauthenticateWithCredential(currentUser, credential);

      await updatePassword(currentUser, newPassword);

      setPasswordCurrent("");
      setNewPassword("");
      setCurrentPassword("");

      toast.success("🔒 Password updated successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setPasswordUpdateLoading(false);
    }
  };

  // Update Social Links
  const handleSocialLinksUpdate = async () => {
    if (!currentUser) return;
    try {
      const linksObj = {};
      socialLinks.list.forEach((item, idx) => {
        if (item.url) linksObj[`link${idx}`] = item.url;
      });
      await update(ref(db, `usersData/${currentUser.uid}`), { socialLinks: linksObj });
      setProfileData((prev) => ({ ...prev, socialLinks: linksObj }));
      toast.success("🌐 Social links updated!");
    } catch {
      toast.error("❌ Failed to update social links!");
    }
  };

  // Removed handleDeletePost

  // Lock/Unlock Profile
  const toggleLockProfile = async () => {
    if (!currentUser) return;
    try {
      const isLocked = !profileData.isLocked;
      await update(ref(db, `usersData/${currentUser.uid}`), { isLocked });
      setProfileData((prev) => ({ ...prev, isLocked }));
      toast.success(isLocked ? "🔒 Profile locked!" : "🔓 Profile unlocked!");
    } catch {
      toast.error("❌ Failed to update profile privacy!");
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
      toast.info("Logged out!");
    } catch {
      toast.error("Logout failed!");
    }
  };

  if (loading) return <p className="m-5 p-5 text-center">Loading profile...</p>;
  if (!profileData) return <p className="m-5 p-5 text-center">No profile found.</p>;

  const isOwner = currentUser?.uid === uid;
  // Removed filteredPosts and videoPosts

  return (
    <div className="container  p-0" style={{ maxWidth: 900 }}>
      {/* Profile Info */}
      <div className="row d-flex align-items-start justify-content-center mb-4 gap-3">
        <div className="col-md-6 d-flex flex-column align-items-center">
          <div
            className="position-relative d-flex justify-content-center align-items-center w-100"
            style={{ height: 200 }}
          >
            {/* Wallpaper behind DP */}
            <div
              className="position-relative top-0 start-0 w-100 h-100 overflow-hidden"
              style={{
                backgroundImage: `url(${wallpaper || "https://via.placeholder.com/900x200"})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                width: "100%",
                height: "200px",
              }}
            ></div>

            {/* DP on top */}
            <img
              src={profileData.photoURL || "icons/avatar.jpg"}
              alt="Profile"
              className="rounded-circle shadow-sm border border-3"
              width={120}
              height={120}
              style={{
                objectFit: "cover",
                position: "absolute",
                zIndex: 10,
                top: "70%",
                left: "30px",
                transform: "translateY(-50%)",
              }}
            />

            {/* Change wallpaper button */}
            {isOwner && (
              <button
                onClick={handleChangeWallpaper}
                className="btn position-absolute bottom-0 end-0 bg-white p-2 me-3 rounded-1 shadow"
                style={{ zIndex: 20, cursor: "pointer" }}
                title="Change wallpaper"
              >
                <i className="bi bi-camera-fill me-2"></i> Edit Cover Photo
              </button>
            )}
          </div>
        </div>

        <div className="col-md-6 text-start d-flex flex-column justify-content-center gap-2">
          <div className="d-flex justify-content-between m-3">
            <h2 className="fw-bold">{profileData.username}</h2>
            {isOwner && (
              <button className="theme-btn" data-bs-toggle="offcanvas" data-bs-target="#editProfileCanvas">
                Edit Profile
              </button>
            )}
          </div>

          <p className="mx-2 my-0"><strong>Email:</strong> {profileData.email || "Not provided"}</p>
          <p className="mx-2 my-0"><strong>Bio:</strong> {profileData.bio || "No bio yet"}</p>

          {/* Social Links */}
          <div className="mb-2">
            {profileData.socialLinks &&
              Object.values(profileData.socialLinks)
                .filter((link) => link)
                .map((link, i) => (
                  <div key={i}>
                    <a href={link} target="_blank" rel="noopener noreferrer">
                      {link}
                    </a>
                  </div>
                ))}
          </div>

          <hr />
          <div className="d-flex flex-wrap justify-content-between gap-2 mt-2">
            <button className="threeD-btn redBtn" onClick={() => navigate(`/followers/${uid}`)}>
              Followers: {followers.length}
            </button>
            <button className="threeD-btn yellowBtn" onClick={() => navigate(`/following/${uid}`)}>
              Following: {following.length}
            </button>
            <button className="threeD-btn blueBtn" onClick={() => navigate(`/requested/${uid}`)}>
              Requested: {requested.length}
            </button>
          </div>
        </div>
      </div>

      {/* Edit Profile Offcanvas */}
      {isOwner && (
        <div className="offcanvas offcanvas-end" tabIndex="-1" id="editProfileCanvas" style={{ width: 520 }}>
          <div className="offcanvas-header border-bottom">
            <h5 className="offcanvas-title">Edit Profile</h5>
            <button type="button" className="btn-close" data-bs-dismiss="offcanvas" />
          </div>
          <div className="offcanvas-body">
            <ul className="nav nav-pills mb-4" id="editProfileTabs" role="tablist">
              <li className="nav-item" role="presentation">
                <button className="nav-link active" id="profile-tab" data-bs-toggle="pill" data-bs-target="#profile" type="button" role="tab">Profile</button>
              </li>
              <li className="nav-item" role="presentation">
                <button className="nav-link" id="security-tab" data-bs-toggle="pill" data-bs-target="#security" type="button" role="tab">Security</button>
              </li>
              <li className="nav-item" role="presentation">
                <button className="nav-link" id="actions-tab" data-bs-toggle="pill" data-bs-target="#actions" type="button" role="tab">Actions</button>
              </li>
            </ul>

            <div className="tab-content" id="editProfileTabsContent">
              {/* Profile Tab */}
              <div className="tab-pane fade show active" id="profile" role="tabpanel">
                <div className="mb-3">
                  <h6 className="mb-2">Profile Picture</h6>
                  <div className="d-flex align-items-center gap-3">
                    <img src={profileData.photoURL || "icons/avatar.jpg"} alt="me" width={60} height={60} className="rounded-circle" />
                    <div>
                      <input type="file" className="form-control form-control-sm" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
                      <small className="text-muted">JPG, PNG recommended. Max 5MB.</small>
                      <div className="mt-2">
                        <button className="btn btn-primary btn-sm" onClick={handleDpUpdate} disabled={uploading}>{uploading ? "Uploading..." : "Update Picture"}</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-3">
                  <h6 className="mb-2">Bio</h6>
                  <textarea className="form-control" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Describe yourself..."></textarea>
                  <div className="mt-2 d-flex gap-2">
                    <button className="btn btn-primary btn-sm" onClick={handleBioUpdate}>Save Bio</button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => { setBio(profileData.bio || ""); }}>Reset</button>
                  </div>
                </div>

                <div className="mb-3">
                  <h6 className="mb-2">Social Links</h6>
                  {socialLinks.list?.map((linkObj, idx) => (
                    <div key={idx} className="d-flex gap-2 mb-2">
                      <input type="url" className="form-control form-control-sm" placeholder="https://example.com" value={linkObj.url} onChange={(e) => {
                        const newList = [...socialLinks.list]; newList[idx].url = e.target.value; setSocialLinks({ list: newList });
                      }} />
                      <button className="btn btn-outline-danger btn-sm" onClick={() => { const newList = socialLinks.list.filter((_, i) => i !== idx); setSocialLinks({ list: newList }); }}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  ))}
                  <div className="d-flex gap-2">
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => setSocialLinks({ list: [...socialLinks.list, { url: "" }] })}><i className="bi bi-plus"></i> Add Link</button>
                    <button className="btn btn-primary btn-sm" onClick={handleSocialLinksUpdate}>Save Links</button>
                  </div>
                </div>
              </div>

              {/* Security Tab */}
              <div className="tab-pane fade" id="security" role="tabpanel">
                {/* Email Verification Section */}
                <div className="mb-3">
                  <h6 className="mb-2">Verify Email</h6>
                  <input type="email" className="form-control mb-2" value={currentEmail} disabled />
                  <input type="password" className="form-control mb-2" placeholder="Current password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} />
                  <button className="btn btn-primary btn-sm" onClick={handleEmailUpdate} disabled={emailUpdateLoading}>
                    {emailUpdateLoading ? "Verifying..." : "Verify Email"}
                  </button>
                </div>

                {/* Password Section */}
                <div className="mb-3">
                  <h6 className="mb-2">Change Password</h6>
                  <input type="password" className="form-control mb-2" placeholder="Current password" value={passwordCurrent} onChange={(e) => setPasswordCurrent(e.target.value)} />
                  <input type="password" className="form-control mb-2" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  <small className="text-muted d-block mb-2">Min 8 chars, uppercase, lowercase, number & special char.</small>
                  <button className="btn btn-primary btn-sm" onClick={handlePasswordUpdate} disabled={passwordUpdateLoading}>
                    {passwordUpdateLoading ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </div>

              {/* Actions Tab */}
              <div className="tab-pane fade" id="actions" role="tabpanel">
                <div className="mb-3">
                  <h6 className="mb-2">Profile Privacy</h6>
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" id="profileLockSwitch" checked={profileData.isLocked} onChange={toggleLockProfile} />
                    <label className="form-check-label" htmlFor="profileLockSwitch">{profileData.isLocked ? "Locked" : "Public"}</label>
                  </div>
                  <small className="text-muted d-block mt-1">{profileData.isLocked ? "Only approved followers can see your content." : "Anyone can see your content."}</small>
                </div>

                <div className="mb-3">
                  <h6 className="mb-2">Session</h6>
                  <button className="btn btn-outline-secondary" onClick={handleLogout}><i className="bi bi-box-arrow-right me-1"></i> Logout</button>
                </div>

                <div className="mb-3">
                  <h6 className="mb-2 text-danger">Danger Zone</h6>
                  <DeleteAccount />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Actions Offcanvas */}
      {isOwner && (
        <div className="offcanvas offcanvas-end" tabIndex="-1" id="profileActionsCanvas">
          <div className="offcanvas-header">
            <h5 className="offcanvas-title">Profile Actions</h5>
            <button type="button" className="btn-close text-reset" data-bs-dismiss="offcanvas"></button>
          </div>

          {/* -----------Accounts---------------- */}
          <div className="accordion accordion-flush" id="accordionProfile">
            {/* 1. Bio Update */}
            <div className="accordion-item">
              <h2 className="accordion-header">
                <button
                  className="accordion-button collapsed"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#collapseBio"
                  aria-expanded="false"
                  aria-controls="collapseBio"
                >
                  1. Bio Update
                </button>
              </h2>
              <div
                id="collapseBio"
                className="accordion-collapse collapse"
                data-bs-parent="#accordionProfile"
              >
                <div className="accordion-body">
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="Update your bio..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                  <button className="btn btn-primary mt-2" onClick={handleBioUpdate}>
                    Save Bio
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Email Verification */}
            <div className="accordion-item">
              <h2 className="accordion-header">
                <button
                  className="accordion-button collapsed"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#collapseEmail"
                  aria-expanded="false"
                  aria-controls="collapseEmail"
                >
                  2. Verify Email
                </button>
              </h2>
              <div
                id="collapseEmail"
                className="accordion-collapse collapse"
                data-bs-parent="#accordionProfile"
              >
                <div className="accordion-body">
                  <input
                    type="email"
                    className="form-control mb-2"
                    value={currentEmail}
                    disabled
                  />
                  <input
                    type="password"
                    className="form-control mb-2"
                    placeholder="Current Password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <button className="btn btn-primary" onClick={handleEmailUpdate}>
                    Verify Email
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Change Password */}
            <div className="accordion-item">
              <h2 className="accordion-header">
                <button
                  className="accordion-button collapsed"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#collapsePassword"
                  aria-expanded="false"
                  aria-controls="collapsePassword"
                >
                  3. Change Password
                </button>
              </h2>
              <div
                id="collapsePassword"
                className="accordion-collapse collapse"
                data-bs-parent="#accordionProfile"
              >
                <div className="accordion-body">
                  <input
                    type="password"
                    className="form-control mb-2"
                    placeholder="Current Password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <input
                    type="password"
                    className="form-control mb-2"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <small className="text-muted">
                    Password must include uppercase, lowercase, number & special symbol (min 8 chars).
                  </small>
                  <button className="btn btn-primary mt-2" onClick={handlePasswordUpdate}>
                    Update Password
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* ------------Accounts------------------*/}

          <div className="offcanvas-body d-flex flex-column gap-3">
            <button className={`threeD-btn ${profileData.isLocked ? "redBtn" : "lightGrayBtn"}`} onClick={toggleLockProfile}>
              {profileData.isLocked ? "Unlock Profile 🔓" : "Lock Profile 🔒"}
            </button>
            <button className="threeD-btn redBtn" onClick={handleLogout}>Logout</button>
            <DeleteAccount />
          </div>
        </div>
      )}

      {/* Posts -  all post display */}
      <GetPost uid={uid} />
      <div className="bg-light text-center p-4 rounded shadow-sm mb-5">
        <h5 className="fw-bold mb-1">Hridesh</h5>
        <p className="text-muted mb-0" style={{ fontSize: "0.7rem" }}>Founder & Creator of Jibzo App</p>
      </div>
    </div>
  );
};

export default AdminProfile;