// src/assets/users/AdminProfile.jsx
import React, { useEffect, useState, useRef } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update, remove } from "firebase/database";
import { signOut, updateProfile, onAuthStateChanged } from "firebase/auth";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";
import DeleteAccount from "./DeleteAccount";

/* =========================
   Fullscreen Video Feed
========================= */
const VideoFeed = ({ videos, startIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const containerRef = useRef(null);
  const videoRefs = useRef([]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: startIndex * window.innerHeight,
        behavior: "auto",
      });
    }
  }, [startIndex]);

  useEffect(() => {
    const container = containerRef.current;
    const handleScroll = () => {
      const index = Math.round(container.scrollTop / window.innerHeight);
      if (index !== currentIndex) setCurrentIndex(index);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [currentIndex]);

  useEffect(() => {
    videoRefs.current.forEach((vid, i) => {
      if (!vid) return;
      if (i === currentIndex) vid.play().catch(() => {});
      else vid.pause();
    });
  }, [currentIndex]);

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 bg-black"
      style={{ zIndex: 1050, overflowY: "scroll", scrollSnapType: "y mandatory" }}
      ref={containerRef}
    >
      {videos.map((video, i) => (
        <div
          key={video.id}
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
            style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: "90vh" }}
            loop
            controls={false}
          />
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "rgba(12, 4, 4, 0.5)",
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
    <img
      src={src}
      alt="Fullscreen"
      className="img-fluid rounded"
      style={{ maxHeight: "90%", maxWidth: "90%" }}
    />
  </div>
);

const AdminProfile = () => {
  const [profileData, setProfileData] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
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
      } else setProfileData(null);
      setLoading(false);
    });

    const postsRef = ref(db, "galleryImages");
    const unsubscribePosts = onValue(postsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const postsArray = Object.entries(data)
          .map(([id, value]) => ({ id, ...value }))
          .filter((post) => post.userId === uid);
        setUserPosts(postsArray);
      } else setUserPosts([]);
    });

    return () => {
      unsubscribeUser();
      unsubscribePosts();
    };
  }, [uid]);

  // Update DP
  const handleDpUpdate = async () => {
    if (!currentUser || !file) return toast.warn("Select an image first!");
    if (!cloudinaryPreset || !cloudinaryCloud)
      return toast.error("❌ Cloudinary ENV not configured!");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", cloudinaryPreset);
      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudinaryCloud}/image/upload`,
        formData
      );
      const photoURL = res.data.secure_url;

      // Update in DB
      await update(ref(db, `usersData/${currentUser.uid}`), { photoURL });
      // Update Firebase Auth
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

  // Update Wallpaper
  const handleChangeWallpaper = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!cloudinaryPreset || !cloudinaryCloud) return toast.error("Cloudinary ENV missing");

      try {
        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", cloudinaryPreset);
        const res = await axios.post(
          `https://api.cloudinary.com/v1_1/${cloudinaryCloud}/image/upload`,
          formData
        );
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

  // Update bio
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

  // Update social links
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

  // Delete post
  const handleDeletePost = async (postId) => {
    if (!postId) return;
    try {
      await remove(ref(db, `galleryImages/${postId}`));
      setUserPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success("🗑️ Post deleted!");
    } catch (err) {
      console.error(err);
      toast.error("❌ Failed to delete post!");
    }
  };

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
  const filteredPosts =
    activeTab === "all" ? userPosts : userPosts.filter((p) => p.type === activeTab);

  return (
    <div className="container" style={{ maxWidth: 900 }}>
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
                top: "50%",
                left: "20px",
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
                <i className="bi bi-pencil-square"></i>
              </button>
            )}
          </div>
        </div>

        <div className="col-md-6 text-start d-flex flex-column justify-content-center gap-2">
          <div className="d-flex justify-content-between">
            <h2 className="fw-bold">{profileData.username}</h2>
            {isOwner && (
              <button
                className="threeD-btn greenBtn"
                data-bs-toggle="offcanvas"
                data-bs-target="#editProfileCanvas"
              >
                Edit Profile
              </button>
            )}
          </div>

          <p className="mb-1"><strong>Email:</strong> {profileData.email || "Not provided"}</p>
          <p className="mb-1"><strong>Bio:</strong> {profileData.bio || "No bio yet"}</p>

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
        <div className="offcanvas offcanvas-end" tabIndex="-1" id="editProfileCanvas">
          <div className="offcanvas-header">
            <h5 className="offcanvas-title">Edit Your Profile</h5>
            <button type="button" className="btn-close text-reset" data-bs-dismiss="offcanvas"></button>
          </div>
          <div className="offcanvas-body d-flex flex-column gap-3">
            {/* Profile Picture */}
            <div>
              <label className="form-label fw-bold">Profile Picture</label>
              <input type="file" className="form-control mb-2" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
              <button className="threeD-btn blueBtn" onClick={handleDpUpdate} disabled={uploading}>
                {uploading ? "Uploading..." : "Upload DP"}
              </button>
            </div>

            {/* Bio */}
            <div>
              <label className="form-label fw-bold">Bio</label>
              <textarea className="form-control" rows={6} value={bio} onChange={(e) => setBio(e.target.value)} />
              <button className="threeD-btn blueBtn mt-2" onClick={handleBioUpdate}>Save Bio</button>
            </div>

            {/* Social Links */}
            <hr />
            <div>
              <label className="form-label fw-bold">Social Links</label>
              {socialLinks.list?.map((linkObj, idx) => (
                <div key={idx} className="d-flex gap-2 mb-2">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter link"
                    value={linkObj.url}
                    onChange={(e) => {
                      const newList = [...socialLinks.list];
                      newList[idx].url = e.target.value;
                      setSocialLinks({ list: newList });
                    }}
                  />
                  <button className="threeD-btn redBtn" onClick={() => {
                    const newList = socialLinks.list.filter((_, i) => i !== idx);
                    setSocialLinks({ list: newList });
                  }}>✕</button>
                </div>
              ))}
              <hr />
              <div className="d-flex justify-content-between">
                <button className="threeD-btn greenBtn m-1" onClick={() => setSocialLinks({ list: [...socialLinks.list, { url: "" }] })}>
                  + Add Link
                </button>
                <button className="threeD-btn blueBtn m-1" onClick={handleSocialLinksUpdate}>Save Social Links</button>
              </div>
            </div>

            {/* Profile Actions */}
            <button
              className="threeD-btn yellowBtn mt-2"
              data-bs-toggle="offcanvas"
              data-bs-target="#profileActionsCanvas"
            >
              Profile Actions
            </button>
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
          <div className="offcanvas-body d-flex flex-column gap-3">
            <button className={`threeD-btn ${profileData.isLocked ? "redBtn" : "lightGrayBtn"}`} onClick={toggleLockProfile}>
              {profileData.isLocked ? "Unlock Profile 🔓" : "Lock Profile 🔒"}
            </button>
            <button className="threeD-btn redBtn" onClick={handleLogout}>Logout</button>
            <DeleteAccount />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mobile-tab-bar">
        {"all,image,video,pdf".split(",").map((tab) => (
          <button
            key={tab}
            className={`mobile-tab-btn ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        <style>{`
          .mobile-tab-bar { position: sticky; bottom:0; display:flex; justify-content:space-around; background:#fff; box-shadow:0 -3px 10px rgba(0,0,0,0.1); padding:8px 0; border-top-left-radius:15px; border-top-right-radius:15px; z-index:100;}
          .mobile-tab-btn { flex:1; text-align:center; padding:10px 0; border:none; background:none; font-weight:600; font-size:0.9rem; color:#555; transition: all 0.2s ease; border-radius:12px; margin:0 4px;}
          .mobile-tab-btn.active { background:#007bff; color:#fff; box-shadow:0 4px 8px rgba(0,123,255,0.3);}
          .mobile-tab-btn:active { transform: translateY(2px);}
        `}</style>
      </div>

      {/* Posts */}
      <div className="row g-3 mb-4">
        {filteredPosts.length > 0 ? (
          filteredPosts.map((post) => (
            <div key={post.id} className="col-12 col-sm-6 col-md-4">
              <div className="card shadow-sm hover-shadow rounded">
                {post.type === "image" && (
                  <img
                    src={post.src}
                    className="card-img-top rounded"
                    alt={post.caption || ""}
                    style={{ objectFit: "cover", height: 200, cursor: "pointer" }}
                    onClick={() => setShowImageViewer(post.src)}
                  />
                )}
                {post.type === "video" && (
                  <video
                    src={post.src}
                    className="card-img-top rounded"
                    style={{ objectFit: "cover", height: 200, cursor: "pointer" }}
                    onClick={() => {
                      const videoPostsFiltered = filteredPosts.filter((p) => p.type === "video");
                      const index = videoPostsFiltered.findIndex((v) => v.id === post.id);
                      setVideoStartIndex(index);
                      setShowVideoFeed(true);
                    }}
                  />
                )}
                {post.type === "pdf" && (
                  <iframe
                    src={`https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(post.src)}`}
                    className="card-img-top rounded"
                    style={{ height: 200 }}
                    title="PDF Preview"
                  />
                )}
                <div className="card-body d-flex justify-content-between align-items-center">
                  <p className="card-text mb-0">{post.caption || ""}</p>
                  {isOwner && (
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeletePost(post.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center">No posts yet.</p>
        )}
      </div>

      {showVideoFeed && (
        <VideoFeed
          videos={filteredPosts.filter((p) => p.type === "video")}
          startIndex={videoStartIndex}
          onClose={() => setShowVideoFeed(false)}
        />
      )}

      {showImageViewer && <ImageViewer src={showImageViewer} onClose={() => setShowImageViewer(null)} />}
    </div>
  );
};

export default AdminProfile;
