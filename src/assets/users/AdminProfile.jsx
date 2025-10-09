// src/components/AdminProfile.jsx
import React, { useEffect, useState, useCallback } from "react";
import { db, auth } from "../utils/firebaseConfig";
import { ref, onValue, update } from "firebase/database";
import {
  signOut,
  updateProfile,
  onAuthStateChanged,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updateEmail,
  updatePassword,
  reauthenticateWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider
} from "firebase/auth";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";

import DeleteAccount from "./DeleteAccount";
import GetPost from "../uploads/GetPost";
import VisitorLenght from "./VisitorLenght";
import { useUserRelations } from "../../hooks/useUserRelations";

const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_NAME;
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

// Custom Hooks
const useAuth = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const { uid: paramUid } = useParams();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user && !paramUid) navigate("/login");
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, [paramUid, navigate]);

  return currentUser;
};

const useUserProfile = (uid) => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;

    const userRef = ref(db, `usersData/${uid}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      setProfileData(snapshot.val());
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  return { profileData, loading, setProfileData };
};

const useCloudinaryUpload = () => {
  const uploadToCloudinary = async (file) => {
    if (!file || !CLOUDINARY_PRESET || !CLOUDINARY_CLOUD) {
      throw new Error("Missing file or Cloudinary configuration");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_PRESET);

    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      formData
    );

    return response.data.secure_url;
  };

  return { uploadToCloudinary };
};

const hasPasswordProvider = (user) => {
  return user?.providerData?.some(provider => provider.providerId === 'password');
};

const getUserAuthProvider = (user) => {
  return user?.providerData?.[0]?.providerId || 'unknown';
};

// Helper Components
const PasswordRequirements = ({ password }) => {
  const requirements = [
    { test: /[A-Z]/, label: "Uppercase letter (A-Z)" },
    { test: /[a-z]/, label: "Lowercase letter (a-z)" },
    { test: /\d/, label: "Number (0-9)" },
    { test: /[!@#$%^&*(),.?":{}|<>]/, label: "Special character (!@#$% etc.)" },
    { test: (pwd) => pwd.length >= 8, label: "At least 8 characters" }
  ];

  return (
    <div className="password-requirements mt-2 p-3 border rounded bg-light">
      <small className="fw-bold text-muted d-block mb-2">Password must contain:</small>
      <div className="requirements-list">
        {requirements.map((req, index) => {
          const isMet = typeof req.test === 'function' ? req.test(password) : req.test.test(password);
          return (
            <div key={index} className={`requirement-item ${isMet ? 'text-success' : 'text-muted'}`}>
              <i className={`bi ${isMet ? 'bi-check-circle-fill' : 'bi-circle'} me-2`}></i>
              <small>{req.label}</small>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PasswordInput = ({
  value,
  onChange,
  placeholder,
  autoComplete,
  showPassword,
  onToggleShow
}) => (
  <div className="position-relative mb-2">
    <input
      type={showPassword ? "text" : "password"}
      className="form-control form-control-sm pe-5"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
    />
    <button
      type="button"
      className="btn btn-sm position-absolute top-50 end-0 translate-middle-y bg-transparent border-0 text-muted"
      onClick={onToggleShow}
    >
      <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
    </button>
  </div>
);

// Main Component
const AdminProfile = () => {
  const currentUser = useAuth();
  const { uid: paramUid } = useParams();
  const uid = paramUid || currentUser?.uid;

  const { profileData, loading, setProfileData } = useUserProfile(uid);
  const { relations: userRelations } = useUserRelations(uid);
  const { uploadToCloudinary } = useCloudinaryUpload();

  const [file, setFile] = useState(null);
  const [bio, setBio] = useState("");
  const [uploading, setUploading] = useState(false);
  const [socialLinks, setSocialLinks] = useState({ list: [] });
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailUpdateLoading, setEmailUpdateLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordUpdateLoading, setPasswordUpdateLoading] = useState(false);
  const [setupPasswordLoading, setSetupPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const navigate = useNavigate();
  const isAdmin = currentUser?.email === ADMIN_EMAIL;

  useEffect(() => {
    if (profileData) {
      setBio(profileData.bio || "");
      const linksList = profileData.socialLinks
        ? Object.entries(profileData.socialLinks)
          .filter(([_, link]) => link)
          .map(([_, url]) => ({ url }))
        : [];
      setSocialLinks({ list: linksList });
    }
  }, [profileData]);

  const handleUpdate = async (updateFn, successMsg, errorMsg, finallyFn) => {
    try {
      await updateFn();
      toast.success(successMsg);
    } catch (err) {
      console.error(errorMsg, err);
      toast.error(`❌ ${errorMsg}: ${err.message}`);
    } finally {
      finallyFn?.();
    }
  };

  // Action Handlers
  const handleDpUpdate = () => handleUpdate(
    async () => {
      if (!currentUser || !file) throw new Error("Select an image first!");
      setUploading(true);
      const photoURL = await uploadToCloudinary(file);
      await Promise.all([
        update(ref(db, `usersData/${currentUser.uid}`), { photoURL }),
        updateProfile(currentUser, { photoURL })
      ]);
      setProfileData(prev => ({ ...prev, photoURL }));
    },
    "🎉 Profile picture updated!",
    "Error uploading profile picture!",
    () => { setFile(null); setUploading(false); }
  );

  const handleChangeWallpaper = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async (e) => {
      const fileSelected = e.target.files[0];
      if (!fileSelected) return;

      setUploading(true);
      await handleUpdate(
        async () => {
          const wallpaperURL = await uploadToCloudinary(fileSelected);
          await update(ref(db, `usersData/${currentUser.uid}`), { wallpaper: wallpaperURL });
          setProfileData(prev => ({ ...prev, wallpaper: wallpaperURL }));
        },
        "🖼️ Wallpaper updated!",
        "Error updating wallpaper!",
        () => setUploading(false)
      );
    };

    input.click();
  }, [currentUser, uploadToCloudinary]);

  const handleBioUpdate = () => handleUpdate(
    async () => {
      await update(ref(db, `usersData/${currentUser.uid}`), { bio });
      setProfileData(prev => ({ ...prev, bio }));
    },
    "📝 Bio updated!",
    "Failed to update bio!"
  );

  const handleEmailUpdate = () => handleUpdate(
    async () => {
      if (!newEmail || !emailPassword) throw new Error("Fill in all fields!");
      setEmailUpdateLoading(true);
      const credential = EmailAuthProvider.credential(currentUser.email, emailPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updateEmail(currentUser, newEmail);
      await update(ref(db, `usersData/${currentUser.uid}`), { email: newEmail });
      setProfileData(prev => ({ ...prev, email: newEmail }));
      setNewEmail("");
      setEmailPassword("");
    },
    "📧 Email updated!",
    "Email update failed!",
    () => setEmailUpdateLoading(false)
  );

  const handlePasswordUpdate = async () => {
    if (!currentPassword || !newPassword) {
      toast.error("❌ Please fill in both fields!");
      return;
    }

    setPasswordUpdateLoading(true);

    await handleUpdate(
      async () => {
        const isValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/.test(newPassword);
        if (!isValid) throw new Error("Password must include uppercase, lowercase, number, and special character!");

        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);
        setCurrentPassword("");
        setNewPassword("");
      },
      "🔒 Password updated successfully!",
      "Password update failed!",
      () => setPasswordUpdateLoading(false)
    );
  };

  const handleSetupPassword = () => handleUpdate(
    async () => {
      if (!newPassword) throw new Error("Enter a new password!");
      setSetupPasswordLoading(true);
      const isValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/.test(newPassword);
      if (!isValid) throw new Error("Password must include uppercase, lowercase, number, and special character!");

      const provider = getUserAuthProvider(currentUser) === 'google.com'
        ? new GoogleAuthProvider()
        : new GithubAuthProvider();

      await reauthenticateWithPopup(currentUser, provider);
      await updatePassword(currentUser, newPassword);
      await update(ref(db, `usersData/${currentUser.uid}`), {
        passwordSet: true,
        authProvider: "multiple"
      });
      setNewPassword("");
      setProfileData(prev => ({ ...prev, passwordSet: true }));
    },
    "🔒 Password set successfully!",
    "Failed to set password!",
    () => setSetupPasswordLoading(false)
  );

  const handleSocialLinksUpdate = () => handleUpdate(
    async () => {
      const linksObj = socialLinks.list.reduce((acc, item, idx) => {
        if (item.url && item.url.trim()) {
          // Ensure URL has proper protocol
          let url = item.url.trim();
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
          }
          acc[`link${idx}`] = url;
        }
        return acc;
      }, {});
      await update(ref(db, `usersData/${currentUser.uid}`), { socialLinks: linksObj });
      setProfileData(prev => ({ ...prev, socialLinks: linksObj }));
    },
    "🌐 Social links updated!",
    "Failed to update social links!"
  );

  const toggleLockProfile = () => handleUpdate(
    async () => {
      const isLocked = !profileData.isLocked;
      await update(ref(db, `usersData/${currentUser.uid}`), { isLocked });
      setProfileData(prev => ({ ...prev, isLocked }));
    },
    profileData.isLocked ? "🔓 Profile unlocked!" : "🔒 Profile locked!",
    "Failed to update profile privacy!"
  );

  const handleLogout = () => handleUpdate(
    async () => {
      await signOut(auth);
      navigate("/login");
    },
    "Logged out!",
    "Logout failed!"
  );

  if (loading) {
    return (
      <div className="min-vh-100 d-flex justify-content-center align-items-center">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }}></div>
          <p className="text-muted">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="min-vh-100 d-flex justify-content-center align-items-center">
        <div className="text-center">
          <i className="bi bi-person-x display-1 text-muted mb-3"></i>
          <h4 className="text-muted">Profile not found</h4>
          <p className="text-muted">The user profile you're looking for doesn't exist.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const isOwner = currentUser?.uid === uid;
  const hasPassword = hasPasswordProvider(currentUser);
  const authProvider = getUserAuthProvider(currentUser);
  const needsPasswordSetup = !hasPassword && authProvider !== 'password';

  const stats = [
    {
      count: userRelations?.followers?.length || 0,
      label: "Followers",
      path: `/followers/${uid}`,
      color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      icon: 'bi-people-fill'
    },
    {
      count: userRelations?.following?.length || 0,
      label: "Following",
      path: `/following/${uid}`,
      color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      icon: 'bi-person-check-fill'
    },
    {
      count: userRelations?.requested?.length || 0,
      label: "Requests",
      path: `/requested/${uid}`,
      color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      icon: 'bi-hourglass-split'
    },
    {
      count: userRelations?.friends?.length || 0,
      label: "Friends",
      path: `/friends/${uid}`,
      color: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      icon: 'bi-heart-fill'
    },
    {
      count: userRelations?.blocked?.length || 0,
      label: "Blocked",
      path: `/blocked/${uid}`,
      color: 'linear-gradient(135deg, #e94343ff 0%, #63112cff 100%)',
      icon: 'bi-ban-fill'
    }
  ];

  return (
    <div className="container-fluid p-0">
      <div className="row justify-content-center mx-0">
        <div className="col-12 col-lg-10 col-xl-8 p-0">

          {/* Profile Header */}
          <ProfileHeader
            profileData={profileData}
            currentUser={currentUser}
            authProvider={authProvider}
            isOwner={isOwner}
            uploading={uploading}
            onWallpaperChange={handleChangeWallpaper}
          />

          {/* Stats Cards */}
          <div className="row g-3 mb-4 mx-auto">
            {stats.map((stat, index) => (
              <div key={index} className="col-4 col-md-2">
                <div
                  className="text-center p-3 rounded shadow-sm stat-box"
                  style={{
                    background: "#fff",
                    cursor: "pointer",
                    transition: "all 0.3s ease"
                  }}
                  onClick={() => navigate(stat.path)}
                >
                  <div
                    className="d-flex align-items-center justify-content-center mx-auto mb-2"
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: "50%",
                      background: stat.color,
                      color: "#fff",
                      fontSize: "1.4rem",
                      boxShadow: "0 4px 10px rgba(0,0,0,0.15)"
                    }}
                  >
                    <i className={`bi ${stat.icon}`}></i>
                  </div>
                  <h6 className="mb-0 fw-bold">{stat.count}</h6>
                  <small className="text-muted">{stat.label}</small>
                </div>
              </div>
            ))}
          </div>

          {/* Social Links */}
          {profileData.socialLinks && Object.values(profileData.socialLinks).filter(link => link).length > 0 && (
            <SocialLinks links={profileData.socialLinks} />
          )}

          {/* Posts Section */}
          <div className="card border-0 shadow-sm w-100 p-0 m-0">
            <div className="card-body w-100 p-0 m-0">
              <GetPost uid={uid} />
            </div>
          </div>

          {/* Footer */}
          <footer className="bg-white mb-5 py-4">
            <div className="container text-center">
              <div className="d-flex align-items-center justify-content-center mb-2 gap-2">
                <img
                  src="/icons/founder.jpg"
                  alt="Hridesh"
                  className="rounded-circle"
                  style={{ width: 25, height: 25, objectFit: "cover" }}
                />
                <h6 className="mb-0 fw-bold">Hridesh Bharati</h6>
              </div>
              <p className="text-secodary-sutle small mb-2">Founder & Creator of Jibzo App</p>
              {/* <div className="d-flex justify-content-center gap-3 mb-1">
                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-muted fs-5">
                  <i className="bi bi-twitter"></i>
                </a>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-muted fs-5">
                  <i className="bi bi-github"></i>
                </a>
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-muted fs-5">
                  <i className="bi bi-linkedin"></i>
                </a>
              </div> */}
              <small className="text-muted d-block ">&copy; {new Date().getFullYear()} Jibzo Company</small>
            </div>
          </footer>


        </div>
      </div>

      {/* Edit Profile Offcanvas */}
      {isOwner && (
        <EditProfileOffcanvas
          profileData={profileData}
          file={file}
          setFile={setFile}
          bio={bio}
          setBio={setBio}
          socialLinks={socialLinks}
          setSocialLinks={setSocialLinks}
          newEmail={newEmail}
          setNewEmail={setNewEmail}
          emailPassword={emailPassword}
          setEmailPassword={setEmailPassword}
          currentPassword={currentPassword}
          setCurrentPassword={setCurrentPassword}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          uploading={uploading}
          emailUpdateLoading={emailUpdateLoading}
          passwordUpdateLoading={passwordUpdateLoading}
          setupPasswordLoading={setupPasswordLoading}
          showCurrentPassword={showCurrentPassword}
          setShowCurrentPassword={setShowCurrentPassword}
          showNewPassword={showNewPassword}
          setShowNewPassword={setShowNewPassword}
          hasPassword={hasPassword}
          authProvider={authProvider}
          needsPasswordSetup={needsPasswordSetup}
          onDpUpdate={handleDpUpdate}
          onBioUpdate={handleBioUpdate}
          onSocialLinksUpdate={handleSocialLinksUpdate}
          onEmailUpdate={handleEmailUpdate}
          onPasswordUpdate={handlePasswordUpdate}
          onSetupPassword={handleSetupPassword}
          onToggleLock={toggleLockProfile}
          onLogout={handleLogout}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
};

// Sub Components
const ProfileHeader = ({ profileData, currentUser, authProvider, isOwner, uploading, onWallpaperChange }) => (
  <div className="card border-0 shadow-sm overflow-hidden mb-3 rounded-0 mx-0">
    <div className="position-relative" style={{ height: '200px' }}>
      <div
        className="w-100 h-100"
        style={{
          backgroundImage: `url(${profileData.wallpaper || ''})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: profileData.wallpaper ? 'transparent' : '#f8f9fa'
        }}
      >
        {!profileData.wallpaper && (
          <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted bg-light">
            <i className="bi bi-image display-4 opacity-25"></i>
          </div>
        )}
      </div>

      <div className="position-absolute bottom-0 start-0 p-3">
        <div className="d-flex align-items-end">
          <img
            src={profileData.photoURL || "/icons/avatar.jpg"}
            alt="Profile"
            className="rounded-circle border border-3 border-white shadow"
            style={{ width: '100px', height: '100px', objectFit: 'cover' }}
          />
          <div className="ms-3 mb-2 d-none d-md-block">
            <h4 className="text-muted fw-bold mb-1 text-shadow">{profileData.username}</h4>
            <p className="text-white-80 mb-0 text-shadow">{profileData.bio || "No bio yet"}</p>
          </div>
        </div>
      </div>

      {isOwner && (
        <div className="position-absolute top-0 end-0 p-3">
          <div className="d-flex gap-2">
            <button
              onClick={onWallpaperChange}
              className="btn btn-light btn-sm rounded-pill shadow-sm"
              title="Change wallpaper"
              disabled={uploading}
            >
              {uploading ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-camera-fill"></i>}
            </button>
          </div>
        </div>
      )}
    </div>

    <div className="card-body d-block">
      <div className="d-flex justify-content-between">
        <h4 className="fw-bold mb-1">{profileData.username}</h4>
        {isOwner && (
          <button
            className="btn btn-light btn-sm rounded-circle shadow-sm p-2 spinning-gear"
            data-bs-toggle="offcanvas"
            data-bs-target="#editProfileCanvas"
            title="Settings"
            style={{
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="bi bi-gear-fill text-secondary fs-5"></i>
            <style>{`
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .spinning-gear i {
      animation: spin 10s linear infinite;
    }
  `}</style>
          </button>

        )}
      </div>
      <p className="text-muted mb-2">
        <i className="bi bi-envelope me-1 text-success small"></i>
        {profileData.email || currentUser?.email || "Not provided"}
      </p>
      <p className="text-muted m-0 small">
        <i className="bi bi-shield-check me-1 text-warning"></i>
        {authProvider === 'password' ? 'Email/Password' :
          authProvider === 'google.com' ? 'Google' :
            authProvider === 'github.com' ? 'GitHub' : 'Unknown'}
      </p>
      {profileData.bio && <p className="m-0 ps-1 small">{profileData.bio}</p>}
    </div>
  </div>
);

const AdminSection = () => (
  <div className="card border-0 shadow-sm mb-4">
    <div className="card-body">
      <div className="d-flex align-items-center mb-3">
        <span className="badge bg-warning text-dark fs-6 me-2">
          <i className="bi bi-shield-check me-1"></i>Admin
        </span>
        <h6 className="mb-0">Admin Tools</h6>
      </div>
      <VisitorLenght />
    </div>
  </div>
);

const SocialLinks = ({ links }) => (
  <div className="card border-0 shadow-sm mb-4">
    <div className="card-body">
      <h6 className="fw-bold mb-3"><i className="bi bi-link-45deg me-2"></i>Social Links</h6>
      <div className="d-flex flex-wrap gap-2">
        {Object.values(links).filter(link => link).map((link, i) => (
          <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary btn-sm rounded-pill">
            <i className="bi bi-box-arrow-up-right me-1"></i>
            {new URL(link).hostname}
          </a>
        ))}
      </div>
    </div>
  </div>
);

// Offcanvas Component
const EditProfileOffcanvas = ({
  profileData, file, setFile, bio, setBio, socialLinks, setSocialLinks,
  newEmail, setNewEmail, emailPassword, setEmailPassword,
  currentPassword, setCurrentPassword, newPassword, setNewPassword,
  uploading, emailUpdateLoading, passwordUpdateLoading, setupPasswordLoading,
  showCurrentPassword, setShowCurrentPassword, showNewPassword, setShowNewPassword,
  hasPassword, authProvider, needsPasswordSetup,
  onDpUpdate, onBioUpdate, onSocialLinksUpdate, onEmailUpdate,
  onPasswordUpdate, onSetupPassword, onToggleLock, onLogout,
  isAdmin
}) => {
  const [activeTab, setActiveTab] = useState("profile");
  const tabs = [
    { id: "profile", label: "Profile", icon: "bi-person" },
    { id: "security", label: "Security", icon: "bi-shield" },
    { id: "privacy", label: "Privacy", icon: "bi-lock" }
  ];

  return (
    <div className="offcanvas offcanvas-end" tabIndex="-1" id="editProfileCanvas" style={{ width: '100%', maxWidth: '500px' }}>
      <div className="offcanvas-header border-bottom text-white" style={{ background: 'rgba(36, 0, 121, 1)' }}>
        <h5 className="offcanvas-title"><i className="bi bi-gear-fill me-2"></i>Edit Profile</h5>
        <button type="button" className="btn-close btn-close-white" data-bs-dismiss="offcanvas" aria-label="Close" />
      </div>

      <div className="offcanvas-body p-0">
        <div className="nav nav-pills nav-fill border-bottom" role="tablist">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-link rounded-0 border-0 py-1 ${activeTab === tab.id ? 'active text-white' : 'text-dark'}`}
              onClick={() => setActiveTab(tab.id)}
              style={{ background: activeTab === tab.id ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'transparent' }}
            >
              <i className={`${tab.icon} d-block`}></i>
              <small>{tab.label}</small>
            </button>
          ))}
        </div>

        <div className="tab-content p-3">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="tab-pane fade show active">
              <ProfileTab
                profileData={profileData}
                file={file}
                setFile={setFile}
                bio={bio}
                setBio={setBio}
                socialLinks={socialLinks}
                setSocialLinks={setSocialLinks}
                uploading={uploading}
                onDpUpdate={onDpUpdate}
                onBioUpdate={onBioUpdate}
                onSocialLinksUpdate={onSocialLinksUpdate}
              />
            </div>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <div className="tab-pane fade show active">
              <SecurityTab
                needsPasswordSetup={needsPasswordSetup}
                authProvider={authProvider}
                newPassword={newPassword}
                setNewPassword={setNewPassword}
                setupPasswordLoading={setupPasswordLoading}
                onSetupPassword={onSetupPassword}
                newEmail={newEmail}
                setNewEmail={setNewEmail}
                emailPassword={emailPassword}
                setEmailPassword={setEmailPassword}
                emailUpdateLoading={emailUpdateLoading}
                onEmailUpdate={onEmailUpdate}
                hasPassword={hasPassword}
                currentPassword={currentPassword}
                setCurrentPassword={setCurrentPassword}
                newPasswordValue={newPassword}
                setNewPasswordValue={setNewPassword}
                passwordUpdateLoading={passwordUpdateLoading}
                showCurrentPassword={showCurrentPassword}
                setShowCurrentPassword={setShowCurrentPassword}
                showNewPassword={showNewPassword}
                setShowNewPassword={setShowNewPassword}
                onPasswordUpdate={onPasswordUpdate}
              />
            </div>
          )}

          {/* Privacy Tab */}
          {activeTab === "privacy" && (
            <div className="tab-pane fade show active">
              <PrivacyTab
                profileData={profileData}
                onToggleLock={onToggleLock}
                onLogout={onLogout}
                isAdmin={isAdmin}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ProfileTab = ({ profileData, file, setFile, bio, setBio, socialLinks, setSocialLinks, uploading, onDpUpdate, onBioUpdate, onSocialLinksUpdate }) => (
  <>
    <div className="mb-4">
      <h6 className="fw-bold mb-3"><i className="bi bi-person-badge me-2"></i>Profile Picture</h6>
      <div className="d-flex align-items-center gap-3">
        <img src={profileData.photoURL || "/icons/avatar.jpg"} alt="Profile" className="rounded-circle border border-3" style={{ width: 80, height: 80, objectFit: "cover" }} />
        <div className="flex-grow-1">
          <input type="file" className="form-control form-control-sm mb-2" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
          <small className="text-muted d-block mb-2">JPG, PNG recommended. Max 5MB.</small>
          <button className="btn btn-primary btn-sm w-100" onClick={onDpUpdate} disabled={uploading || !file}>
            {uploading ? <><span className="spinner-border spinner-border-sm me-2"></span>Uploading...</> : "Update Picture"}
          </button>
        </div>
      </div>
    </div>

    <div className="mb-4">
      <h6 className="fw-bold mb-3"><i className="bi bi-chat-text me-2"></i>Bio</h6>
      <textarea className="form-control" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself..." rows={3} />
      <button className="btn btn-primary btn-sm mt-2 w-100" onClick={onBioUpdate}>Save Bio</button>
    </div>

    <div className="mb-3">
      <h6 className="fw-bold mb-3"><i className="bi bi-link-45deg me-2"></i>Social Links</h6>
      {socialLinks.list?.map((linkObj, idx) => (
        <div key={idx} className="d-flex gap-2 mb-2">
          <input type="url" className="form-control form-control-sm" placeholder="https://example.com" value={linkObj.url} onChange={(e) => {
            const newList = [...socialLinks.list];
            newList[idx].url = e.target.value;
            setSocialLinks({ list: newList });
          }} />
          <button className="btn btn-outline-danger btn-sm" onClick={() => {
            const newList = socialLinks.list.filter((_, i) => i !== idx);
            setSocialLinks({ list: newList });
          }}><i className="bi bi-trash"></i></button>
        </div>
      ))}
      <div className="d-flex gap-2">
        <button className="btn btn-outline-secondary btn-sm flex-fill" onClick={() => setSocialLinks({ list: [...socialLinks.list, { url: "" }] })}>
          <i className="bi bi-plus"></i> Add Link
        </button>
        <button className="btn btn-primary btn-sm flex-fill" onClick={onSocialLinksUpdate}><i className="bi bi-save"></i> Save</button>
      </div>
    </div>
  </>
);

const SecurityTab = ({
  needsPasswordSetup, authProvider, newPassword, setNewPassword, setupPasswordLoading, onSetupPassword,
  newEmail, setNewEmail, emailPassword, setEmailPassword, emailUpdateLoading, onEmailUpdate,
  hasPassword, currentPassword, setCurrentPassword, newPasswordValue, setNewPasswordValue, passwordUpdateLoading,
  showCurrentPassword, setShowCurrentPassword, showNewPassword, setShowNewPassword, onPasswordUpdate
}) => (
  <>
    {needsPasswordSetup && (
      <div className="mb-4 p-3 border rounded bg-warning bg-opacity-10">
        <h6 className="mb-2 text-warning"><i className="bi bi-key me-2"></i>Setup Password</h6>
        <p className="small text-muted mb-2">Set a password to enable email/password login alongside your {authProvider === 'google.com' ? 'Google' : 'GitHub'} account.</p>
        <input type="password" className="form-control form-control-sm mb-2" placeholder="Enter new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <small className="text-muted d-block mb-2">Must include uppercase, lowercase, number, special character, and be at least 8 characters long.</small>
        <button className="btn btn-warning btn-sm w-100" onClick={onSetupPassword} disabled={setupPasswordLoading || !newPassword}>
          {setupPasswordLoading ? <><span className="spinner-border spinner-border-sm me-2"></span>Setting up...</> : "Setup Password"}
        </button>
      </div>
    )}

    <div className="mb-4">
      <h6 className="fw-bold mb-3"><i className="bi bi-envelope me-2"></i>Update Email</h6>
      <input type="email" className="form-control form-control-sm mb-2" placeholder="New email address" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
      <input type="password" className="form-control form-control-sm mb-2" placeholder="Current password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} />
      <button className="btn btn-primary btn-sm w-100" onClick={onEmailUpdate} disabled={emailUpdateLoading || !newEmail || !emailPassword}>
        {emailUpdateLoading ? <><span className="spinner-border spinner-border-sm me-2"></span>Updating...</> : "Update Email"}
      </button>
    </div>

    {hasPassword && (
      <div className="mb-3">
        <h6 className="fw-bold mb-3"><i className="bi bi-shield-lock me-2"></i>Update Password</h6>

        <PasswordInput
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Current password"
          autoComplete="current-password"
          showPassword={showCurrentPassword}
          onToggleShow={() => setShowCurrentPassword(!showCurrentPassword)}
        />

        <PasswordInput
          value={newPasswordValue}
          onChange={(e) => setNewPasswordValue(e.target.value)}
          placeholder="New password"
          autoComplete="new-password"
          showPassword={showNewPassword}
          onToggleShow={() => setShowNewPassword(!showNewPassword)}
        />

        {newPasswordValue && <PasswordRequirements password={newPasswordValue} />}

        <button
          className="btn btn-primary btn-sm w-100 mt-3"
          onClick={onPasswordUpdate}
          disabled={passwordUpdateLoading || !currentPassword || !newPasswordValue ||
            !(/[A-Z]/.test(newPasswordValue) && /[a-z]/.test(newPasswordValue) && /\d/.test(newPasswordValue) &&
              /[!@#$%^&*(),.?":{}|<>]/.test(newPasswordValue) && newPasswordValue.length >= 8)}
        >
          {passwordUpdateLoading ? <><span className="spinner-border spinner-border-sm me-2"></span>Updating...</> : "Update Password"}
        </button>
      </div>
    )}
  </>
);

const PrivacyTab = ({ profileData, onToggleLock, onLogout, isAdmin }) => (
  <>
    {/* Admin Section */}
    {isAdmin && <AdminSection />}

    <div className="mb-4">
      <h6 className="fw-bold mb-3"><i className="bi bi-eye me-2"></i>Profile Privacy</h6>
      <div className="form-check form-switch">
        <input className="form-check-input" type="checkbox" checked={!!profileData.isLocked} onChange={onToggleLock} style={{ transform: 'scale(1.2)' }} />
        <label className="form-check-label fw-bold">{profileData.isLocked ? "Private Profile" : "Public Profile"}</label>
      </div>
      <small className="text-muted d-block mt-2">
        {profileData.isLocked ? "Only approved followers can see your content and posts." : "Anyone can see your profile and posts."}
      </small>
    </div>

    <div className="mb-4">
      <h6 className="fw-bold mb-3"><i className="bi bi-box-arrow-right me-2"></i>Session</h6>
      <button className="btn btn-outline-danger btn-sm w-100" onClick={onLogout}>
        <i className="bi bi-box-arrow-right me-2"></i>Logout</button>
    </div>

    <div className="mb-3">
      <h6 className="fw-bold mb-3 text-danger"><i className="bi bi-exclamation-triangle me-2"></i>Danger Zone</h6>
      <DeleteAccount />
    </div>
  </>
);
export default AdminProfile;