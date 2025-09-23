import React, { useEffect, useState } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update } from "firebase/database";
import { signOut, updateProfile, onAuthStateChanged, reauthenticateWithCredential, EmailAuthProvider, sendEmailVerification, updatePassword } from "firebase/auth";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import DeleteAccount from "./DeleteAccount";
import "./AdminProfile.css";
import GetPost from "../uploads/GetPost";
import VisitorLenght from "./VisitorLenght";

const AdminProfile = () => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [bio, setBio] = useState("");
  const [uploading, setUploading] = useState(false);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [requested, setRequested] = useState([]);
  const [socialLinks, setSocialLinks] = useState({ list: [] });
  const [wallpaper, setWallpaper] = useState("");

  const [currentEmail, setCurrentEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailUpdateLoading, setEmailUpdateLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordUpdateLoading, setPasswordUpdateLoading] = useState(false);

  const navigate = useNavigate();
  const { uid: paramUid } = useParams();
  const [currentUser, setCurrentUser] = useState(null);
  const uid = paramUid || currentUser?.uid;

  const cloudinaryPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const cloudinaryCloud = import.meta.env.VITE_CLOUDINARY_NAME;

  // Firebase auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user && !paramUid) navigate("/login");
      setCurrentUser(user);
      if (user) setCurrentEmail(user.email || "");
    });
    return () => unsubscribe();
  }, [paramUid, navigate]);

  // Fetch user data
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
    return () => unsubscribeUser();
  }, [uid]);

  // Profile DP upload
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

  // Wallpaper upload
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

  // Bio update
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

  // Email verification
  const handleEmailUpdate = async () => {
    const passwordToUse = emailPassword || currentPassword;
    if (!currentUser || !passwordToUse) return toast.warn("Enter your current password!");
    setEmailUpdateLoading(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, passwordToUse);
      await reauthenticateWithCredential(currentUser, credential);
      await sendEmailVerification(currentUser);
      setEmailPassword("");
      setCurrentPassword("");
      toast.success("✅ Email verified!");
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setEmailUpdateLoading(false);
    }
  };

  // Password update
  const handlePasswordUpdate = async () => {
    if (!currentUser || !currentPassword || !newPassword) return toast.warn("Fill all required fields!");
    const isValid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/.test(newPassword);
    if (!isValid) return toast.error("Password must include uppercase, lowercase, number, and special character!");
    setPasswordUpdateLoading(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      toast.success("🔒 Password updated successfully!");
    } catch (err) {
      console.error(err);
      toast.error(err.message);
    } finally {
      setPasswordUpdateLoading(false);
    }
  };

  // Social links update
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

  // Lock/Unlock profile
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
  const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
  const isAdmin = currentUser?.email === ADMIN_EMAIL;

  return (
    <div className="container p-0" style={{ maxWidth: 900 }}>
      {/* Profile Info */}
      <div className="row d-flex align-items-start justify-content-center mb-4 gap-3">
        <div className="col-md-6 d-flex flex-column align-items-center">
          <div className="position-relative w-100" style={{ height: 200 }}>
            <div className="position-relative w-100 h-100" style={{ backgroundImage: `url(${wallpaper})`, backgroundSize: "cover", backgroundPosition: "center" }}></div>
            <img
              src={profileData.photoURL || "icons/avatar.jpg"}
              alt="Profile"
              className="rounded-circle border border-3"
              width={120} height={120}
              style={{ objectFit: "cover", position: "absolute", zIndex: 10, top: "80%", left: "10px", transform: "translateY(-50%)" }}
            />
            {isOwner && <button onClick={handleChangeWallpaper} className="btn position-absolute bottom-0 end-0 m-3 px-2 border bg-light" style={{ zIndex: 20 }} title="Change wallpaper"><i className="bi bi-camera-fill"></i></button>}
          </div>
        </div>

        <div className="col-md-6 text-start d-flex flex-column justify-content-center gap-2">
          <div className="d-flex justify-content-between m-3">
            <h2 className="fw-bold">{profileData.username}</h2>
            {isOwner && <button className="theme-btn" data-bs-toggle="offcanvas" data-bs-target="#editProfileCanvas">Edit Profile</button>}
          </div>
          <p className="mx-2 my-0"><strong>Email:</strong> {profileData.email || "Not provided"}</p>
          <p className="mx-2 my-0"><strong>Bio:</strong> {profileData.bio || "No bio yet"}</p>
          {isAdmin && <VisitorLenght />}
          {/* Social Links */}
          <div className="mx-2">
            {profileData.socialLinks && Object.values(profileData.socialLinks).filter(link => link).map((link, i) => (
              <div key={i}><a href={link} target="_blank" rel="noopener noreferrer">{link}</a></div>
            ))}
          </div>

          <hr />
          {/* Followers / Following / Requested buttons */}
          <div className="d-flex flex-wrap p-2" style={{ gap: "0.5rem" }}>
            <button className="threeD-btn greenBtn" style={{ width: "calc(50% - 0.25rem)", opacity: 0.5, cursor: "not-allowed", pointerEvents: "none" }}>Profile Views...</button>
            <button className="threeD-btn redBtn" style={{ width: "calc(50% - 0.25rem)" }} onClick={() => navigate(`/followers/${uid}`)}>Followers: {followers.length}</button>
            <button className="threeD-btn yellowBtn" style={{ width: "calc(50% - 0.25rem)" }} onClick={() => navigate(`/following/${uid}`)}>Following: {following.length}</button>
            <button className="threeD-btn blueBtn" style={{ width: "calc(50% - 0.25rem)" }} onClick={() => navigate(`/requested/${uid}`)}>Requested: {requested.length}</button>
          </div>
        </div>
      </div>

      {/* Edit Profile Offcanvas */}
      {isOwner && (
        <div className="offcanvas offcanvas-end" tabIndex="-1" id="editProfileCanvas" style={{ width: 520 }}>
          <div className="offcanvas-header border-bottom text-white"
            style={{ background: "#002e69ff" }}>
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
            <ul className="nav nav-pills mb-4" id="editProfileTabs" role="tablist">
              <li className="nav-item" role="presentation">
                <button className="nav-link active" id="profile-tab" data-bs-toggle="pill" data-bs-target="#profile" type="button" role="tab">Profile</button>
              </li>
              {/* <li className="nav-item" role="presentation">
                <button className="nav-link" id="security-tab" data-bs-toggle="pill" data-bs-target="#security" type="button" role="tab">Security</button>
              </li> */}
              <li className="nav-item" role="presentation">
                <button className="nav-link" id="actions-tab" data-bs-toggle="pill" data-bs-target="#actions" type="button" role="tab">Account & Privacy</button>
              </li>
            </ul>

            <div className="tab-content" id="editProfileTabsContent">
              {/* Profile Tab */}
              <div className="tab-pane fade show active" id="profile" role="tabpanel">
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
                          onClick={handleDpUpdate}
                          disabled={uploading}
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
                      e.target.style.height = "auto"; // Reset height
                      e.target.style.height = e.target.scrollHeight + "px"; // Auto-grow
                    }}
                    placeholder="Describe yourself..."
                    rows={2}
                    style={{ overflow: "hidden" }}
                  ></textarea>

                  <div className="mt-2 d-flex gap-2">
                    <button className="btn btn-primary btn-sm" onClick={handleBioUpdate}>Save Bio</button>
                    {/* <button className="btn btn-outline-secondary btn-sm" onClick={() => { setBio(profileData.bio || ""); }}>Reset</button> */}
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
                  <div className="d-flex justify-content-between gap-2">
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => setSocialLinks({ list: [...socialLinks.list, { url: "" }] })}><i className="bi bi-plus"></i>Add Link</button>
                    <button className="btn btn-primary btn-sm" onClick={handleSocialLinksUpdate}><i class="bi bi-save"></i> Save Links</button>
                  </div>
                </div>
              </div>

              {/* Security Tab */}
              {/* Email Verification Section */}
              {/* <div className="tab-pane fade" id="security" role="tabpanel">
                <div className="mb-3">
                  <h6 className="mb-2">Verify Email</h6>
                  <input type="email" className="form-control mb-2" value={currentEmail} disabled />
                  <input type="password" className="form-control mb-2" placeholder="Current password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} />
                  <button className="btn btn-primary btn-sm" onClick={handleEmailUpdate} disabled={emailUpdateLoading}>
                    {emailUpdateLoading ? "Verifying..." : "Verify Email"}
                  </button>
                </div>
              </div> */}

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
      {/* Posts */}
      <GetPost uid={uid} />

      <div className="bg-light text-center p-4 rounded shadow-sm mb-5">
        <h5 className="fw-bold mb-1">Hridesh</h5>
        <p className="text-muted mb-0" style={{ fontSize: "0.7rem" }}>Founder & Creator of Jibzo App</p>
      </div>
    </div>
  );
};

export default AdminProfile;
