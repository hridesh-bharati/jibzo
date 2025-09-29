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
import "./AdminProfile.css";
// Components
import DeleteAccount from "./DeleteAccount";
import GetPost from "../uploads/GetPost";
import VisitorLenght from "./VisitorLenght";

// Hooks
import { useUserRelations, useUserActions } from "../../hooks/useUserRelations";

// Constants
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_NAME;
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

// Custom hooks
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

// Check if user has password provider
const hasPasswordProvider = (user) => {
  return user?.providerData?.some(provider => provider.providerId === 'password');
};

// Get user's auth provider
const getUserAuthProvider = (user) => {
  return user?.providerData?.[0]?.providerId || 'unknown';
};

// Main Component
const AdminProfile = () => {
  const currentUser = useAuth();
  const { uid: paramUid } = useParams();
  const uid = paramUid || currentUser?.uid;
  
  const { profileData, loading, setProfileData } = useUserProfile(uid);
  const { relations: userRelations } = useUserRelations(uid);
  const { uploadToCloudinary } = useCloudinaryUpload();

  // State
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

  const navigate = useNavigate();

  // Initialize form data
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

  // Generic update handler
  const handleUpdate = async (updateFn, successMsg, errorMsg, finallyFn) => {
    try {
      await updateFn();
      toast.success(successMsg);
    } catch (err) {
      console.error(errorMsg, err);
      toast.error(`❌ ${errorMsg}`);
    } finally {
      finallyFn?.();
    }
  };

  // Profile Picture Update
  const handleDpUpdate = () => handleUpdate(
    async () => {
      if (!currentUser || !file) throw new Error("Select an image first!");
      
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

  // Wallpaper upload
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

  // Bio update
  const handleBioUpdate = () => handleUpdate(
    async () => {
      await update(ref(db, `usersData/${currentUser.uid}`), { bio });
      setProfileData(prev => ({ ...prev, bio }));
    },
    "📝 Bio updated!",
    "Failed to update bio!"
  );

  // Email Update
  const handleEmailUpdate = () => handleUpdate(
    async () => {
      if (!newEmail || !emailPassword) throw new Error("Fill in all fields!");
      
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

  // Password update for existing password users
  const handlePasswordUpdate = () => handleUpdate(
    async () => {
      if (!currentPassword || !newPassword) throw new Error("Fill all required fields!");
      
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

  // SET PASSWORD FOR SOCIAL LOGIN USERS (NEW FEATURE)
  const handleSetupPassword = () => handleUpdate(
    async () => {
      if (!newPassword) throw new Error("Enter a new password!");
      
      const isValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/.test(newPassword);
      if (!isValid) throw new Error("Password must include uppercase, lowercase, number, and special character!");
      
      // Re-authenticate with social provider
      const provider = getUserAuthProvider(currentUser) === 'google.com' 
        ? new GoogleAuthProvider() 
        : new GithubAuthProvider();
      
      await reauthenticateWithPopup(currentUser, provider);
      await updatePassword(currentUser, newPassword);
      
      // Update database flag
      await update(ref(db, `usersData/${currentUser.uid}`), { 
        passwordSet: true,
        authProvider: "multiple" // Indicates both social and password
      });
      
      setNewPassword("");
      setProfileData(prev => ({ ...prev, passwordSet: true }));
    },
    "🔒 Password set successfully! You can now login with email/password",
    "Failed to set password!",
    () => setSetupPasswordLoading(false)
  );

  // Social links update
  const handleSocialLinksUpdate = () => handleUpdate(
    async () => {
      const linksObj = socialLinks.list.reduce((acc, item, idx) => {
        if (item.url) acc[`link${idx}`] = item.url;
        return acc;
      }, {});

      await update(ref(db, `usersData/${currentUser.uid}`), { socialLinks: linksObj });
      setProfileData(prev => ({ ...prev, socialLinks: linksObj }));
    },
    "🌐 Social links updated!",
    "Failed to update social links!"
  );

  // Lock/Unlock profile
  const toggleLockProfile = () => handleUpdate(
    async () => {
      const isLocked = !profileData.isLocked;
      await update(ref(db, `usersData/${currentUser.uid}`), { isLocked });
      setProfileData(prev => ({ ...prev, isLocked }));
    },
    profileData.isLocked ? "🔓 Profile unlocked!" : "🔒 Profile locked!",
    "Failed to update profile privacy!"
  );

  // Logout
  const handleLogout = () => handleUpdate(
    async () => {
      await signOut(auth);
      navigate("/login");
    },
    "Logged out!",
    "Logout failed!"
  );

  if (loading) return <p className="m-5 p-5 text-center">Loading profile...</p>;
  if (!profileData) return <p className="m-5 p-5 text-center">No profile found.</p>;

  const isOwner = currentUser?.uid === uid;
  const isAdmin = currentUser?.email === ADMIN_EMAIL;
  const hasPassword = hasPasswordProvider(currentUser);
  const authProvider = getUserAuthProvider(currentUser);
  const needsPasswordSetup = !hasPassword && authProvider !== 'password';

  return (
    <div className="container p-0" style={{ maxWidth: 900 }}>
      {/* Profile Header */}
      <div className="row d-flex align-items-start justify-content-center mb-4 gap-3">
        <div className="col-md-6 d-flex flex-column align-items-center">
          <div className="position-relative w-100" style={{ height: 200 }}>
            <div
              className="position-relative w-100 h-100"
              style={{
                backgroundImage: `url(${profileData.wallpaper || ''})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundColor: profileData.wallpaper ? 'transparent' : '#f8f9fa'
              }}
            >
              {!profileData.wallpaper && (
                <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted">
                  No wallpaper set
                </div>
              )}
            </div>

            <img
              src={profileData.photoURL || "icons/avatar.jpg"}
              alt="Profile"
              className="rounded-circle border border-3"
              width={120}
              height={120}
              style={{
                objectFit: "cover",
                position: "absolute",
                zIndex: 10,
                top: "80%",
                left: "10px",
                transform: "translateY(-50%)"
              }}
            />

            {isOwner && (
              <button
                onClick={handleChangeWallpaper}
                className="btn position-absolute bottom-0 end-0 m-3 px-2 border bg-light"
                style={{ zIndex: 20 }}
                title="Change wallpaper"
                disabled={uploading}
              >
                {uploading ? "⏳" : <i className="bi bi-camera-fill"></i>}
              </button>
            )}
          </div>
        </div>

        {/* Profile Info */}
        <div className="col-md-6 text-start d-flex flex-column justify-content-center gap-2">
          <div className="d-flex justify-content-between m-3">
            <h2 className="fw-bold">{profileData.username}</h2>
            {isOwner && (
              <button
                className="theme-btn"
                data-bs-toggle="offcanvas"
                data-bs-target="#editProfileCanvas"
              >
                Edit Profile
              </button>
            )}
          </div>

          <p className="mx-2 my-0">
            <strong>Email:</strong> {profileData.email || currentUser?.email || "Not provided"}
          </p>

          <p className="mx-2 my-0">
            <strong>Login Method:</strong> {authProvider === 'password' ? 'Email/Password' : 
              authProvider === 'google.com' ? 'Google' : 
              authProvider === 'github.com' ? 'GitHub' : 'Unknown'}
          </p>

          {needsPasswordSetup && (
            <div className="mx-2 alert alert-warning p-2 small">
              <i className="bi bi-exclamation-triangle me-1"></i>
              Set a password to enable email login
            </div>
          )}

          <p className="mx-2 my-0">
            <strong>Bio:</strong> {profileData.bio || "No bio yet"}
          </p>

          {isAdmin && <VisitorLenght />}

          {/* Social Links */}
          <div className="mx-2">
            {profileData.socialLinks && Object.values(profileData.socialLinks)
              .filter(link => link)
              .map((link, i) => (
                <div key={i}>
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    {link}
                  </a>
                </div>
              ))}
          </div>

          <hr />

          {/* Profile Stats */}
          <div className="d-flex flex-wrap p-2" style={{ gap: "0.5rem" }}>
            <button className="threeD-btn greenBtn" style={{ width: "calc(50% - 0.25rem)", opacity: 0.5, cursor: "not-allowed" }}>
              Profile Views...
            </button>
            <button className="threeD-btn redBtn" style={{ width: "calc(50% - 0.25rem)" }} onClick={() => navigate(`/followers/${uid}`)}>
              Followers: {userRelations.followers.length}
            </button>
            <button className="threeD-btn yellowBtn" style={{ width: "calc(50% - 0.25rem)" }} onClick={() => navigate(`/following/${uid}`)}>
              Following: {userRelations.following.length}
            </button>
            <button className="threeD-btn blueBtn" style={{ width: "calc(50% - 0.25rem)" }} onClick={() => navigate(`/requested/${uid}`)}>
              Requested: {userRelations.requested.length}
            </button>
            {isOwner && (
              <button className="threeD-btn darkBtn" style={{ width: "calc(50% - 0.25rem)" }} onClick={() => navigate(`/blocked/${uid}`)}>
                Blocked: {userRelations.blocked.length}
              </button>
            )}
          </div>
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
        />
      )}

      {/* Posts */}
      <GetPost uid={uid} />

      {/* Footer */}
      <div className="bg-light text-center p-4 rounded shadow-sm mb-5">
        <h5 className="fw-bold mb-1">Hridesh</h5>
        <p className="text-muted mb-0" style={{ fontSize: "0.7rem" }}>
          Founder & Creator of Jibzo App
        </p>
      </div>
    </div>
  );
};

// Updated Offcanvas Component with Password Setup
const EditProfileOffcanvas = ({
  profileData,
  file, setFile, bio, setBio, socialLinks, setSocialLinks,
  newEmail, setNewEmail, emailPassword, setEmailPassword,
  currentPassword, setCurrentPassword, newPassword, setNewPassword,
  uploading, emailUpdateLoading, passwordUpdateLoading, setupPasswordLoading,
  hasPassword, authProvider, needsPasswordSetup,
  onDpUpdate, onBioUpdate, onSocialLinksUpdate, onEmailUpdate, 
  onPasswordUpdate, onSetupPassword, onToggleLock, onLogout
}) => {
  const [activeTab, setActiveTab] = useState("profile");

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "security", label: "Security" },
    { id: "actions", label: "Account & Privacy" }
  ];

  return (
    <div className="offcanvas offcanvas-end" tabIndex="-1" id="editProfileCanvas" style={{ width: 520 }}>
      <div className="offcanvas-header border-bottom text-white" style={{ background: "#002e69ff" }}>
        <h5 className="offcanvas-title">Edit Profile</h5>
        <button
          type="button"
          className="btn-close"
          data-bs-dismiss="offcanvas"
          aria-label="Close"
          style={{ filter: "invert(1)" }}
        />
      </div>
      
      <div className="offcanvas-body">
        <ul className="nav nav-pills mb-4 border-bottom pb-2 small" role="tablist">
          {tabs.map(tab => (
            <li className="nav-item" role="presentation" key={tab.id}>
              <button
                className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="tab-content">
          {/* Profile Tab */}
          <div className={`tab-pane fade ${activeTab === "profile" ? "show active" : ""}`} id="profile">
            <div className="mb-3">
              <h6 className="mb-2">Profile Picture</h6>
              <div className="d-flex align-items-center gap-3">
                <img
                  src={profileData.photoURL || "icons/avatar.jpg"}
                  alt="Profile"
                  className="rounded-circle border border-2"
                  style={{ width: 80, height: 80, objectFit: "cover" }}
                />
                <div className="flex-grow-1">
                  <input
                    type="file"
                    className="form-control form-control-sm mb-2"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                  <small className="text-muted">JPG, PNG recommended. Max 5MB.</small>
                  <div className="mt-2">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={onDpUpdate}
                      disabled={uploading || !file}
                    >
                      {uploading ? "Uploading..." : "Update Picture"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mb-3">
              <h6 className="mb-2">Bio</h6>
              <textarea
                className="form-control"
                value={bio}
                onChange={(e) => {
                  setBio(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                placeholder="Describe yourself..."
                rows={2}
                style={{ overflow: "hidden" }}
              />
              <div className="mt-2">
                <button className="btn btn-primary btn-sm" onClick={onBioUpdate}>
                  Save Bio
                </button>
              </div>
            </div>
            
            <div className="mb-3">
              <h6 className="mb-2">Social Links</h6>
              {socialLinks.list?.map((linkObj, idx) => (
                <div key={idx} className="d-flex gap-2 mb-2">
                  <input
                    type="url"
                    className="form-control form-control-sm"
                    placeholder="https://example.com"
                    value={linkObj.url}
                    onChange={(e) => {
                      const newList = [...socialLinks.list];
                      newList[idx].url = e.target.value;
                      setSocialLinks({ list: newList });
                    }}
                  />
                  <button
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => {
                      const newList = socialLinks.list.filter((_, i) => i !== idx);
                      setSocialLinks({ list: newList });
                    }}
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              ))}
              <div className="d-flex justify-content-between gap-2">
                <button 
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setSocialLinks({ list: [...socialLinks.list, { url: "" }] })}
                >
                  <i className="bi bi-plus"></i> Add Link
                </button>
                <button className="btn btn-primary btn-sm" onClick={onSocialLinksUpdate}>
                  <i className="bi bi-save"></i> Save Links
                </button>
              </div>
            </div>
          </div>

          {/* Security Tab - UPDATED WITH PASSWORD SETUP */}
          <div className={`tab-pane fade ${activeTab === "security" ? "show active" : ""}`} id="security">
            {/* Password Setup for Social Login Users */}
            {needsPasswordSetup && (
              <div className="mb-4 p-3 border rounded bg-warning bg-opacity-10">
                <h6 className="mb-2 text-warning">
                  <i className="bi bi-key me-1"></i>
                  Setup Password for Email Login
                </h6>
                <p className="small text-muted mb-2">
                  Currently using {authProvider === 'google.com' ? 'Google' : 'GitHub'} login. 
                  Set a password to enable email/password login.
                </p>
                <input
                  type="password"
                  className="form-control form-control-sm mb-2"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <small className="text-muted d-block mb-2">
                  Must include: uppercase, lowercase, number, special character, min 8 chars
                </small>
                <button
                  className="btn btn-warning btn-sm"
                  onClick={onSetupPassword}
                  disabled={setupPasswordLoading || !newPassword}
                >
                  {setupPasswordLoading ? "Setting up..." : "Setup Password"}
                </button>
              </div>
            )}

            {/* Email Update */}
            <div className="mb-3">
              <h6 className="mb-2">Update Email</h6>
              <input
                type="email"
                className="form-control form-control-sm mb-2"
                placeholder="New email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <input
                type="password"
                className="form-control form-control-sm mb-2"
                placeholder="Current password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={onEmailUpdate}
                disabled={emailUpdateLoading || !newEmail || !emailPassword}
              >
                {emailUpdateLoading ? "Updating..." : "Update Email"}
              </button>
            </div>
            
            {/* Password Update (only for existing password users) */}
            {hasPassword && (
              <div className="mb-3">
                <h6 className="mb-2">Update Password</h6>
                <input
                  type="password"
                  className="form-control form-control-sm mb-2"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <input
                  type="password"
                  className="form-control form-control-sm mb-2"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={onPasswordUpdate}
                  disabled={passwordUpdateLoading || !currentPassword || !newPassword}
                >
                  {passwordUpdateLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
            )}
          </div>

          {/* Actions Tab */}
          <div className={`tab-pane fade ${activeTab === "actions" ? "show active" : ""}`} id="actions">
            <div className="mb-3">
              <h6 className="mb-2">Profile Privacy</h6>
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={profileData.isLocked}
                  onChange={onToggleLock}
                />
                <label className="form-check-label">
                  {profileData.isLocked ? "Locked" : "Public"}
                </label>
              </div>
              <small className="text-muted d-block mt-1">
                {profileData.isLocked ? "Only approved followers can see your content." : "Anyone can see your content."}
              </small>
            </div>
            
            <div className="mb-3">
              <h6 className="mb-2">Session</h6>
              <button className="btn btn-outline-secondary btn-sm" onClick={onLogout}>
                <i className="bi bi-box-arrow-right me-1"></i> Logout
              </button>
            </div>
            
            <div className="mb-3">
              <h6 className="mb-2 text-danger">Danger Zone</h6>
              <DeleteAccount />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;