// src/assets/users/AdminProfile.jsx
import React, { useEffect, useState, useRef } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update, remove } from "firebase/database";
import { signOut, updateProfile } from "firebase/auth";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import axios from "axios";

/* =========================
   Fullscreen Video Feed
========================= */
const VideoFeed = ({ videos, startIndex, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const containerRef = useRef(null);
  const videoRefs = useRef([]);

  // Scroll to initial video
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: startIndex * window.innerHeight,
        behavior: "auto",
      });
    }
  }, [startIndex]);

  // Handle scroll snapping
  useEffect(() => {
    const container = containerRef.current;
    const handleScroll = () => {
      const index = Math.round(container.scrollTop / window.innerHeight);
      if (index !== currentIndex) setCurrentIndex(index);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [currentIndex]);

  // Play only current video
  useEffect(() => {
    videoRefs.current.forEach((vid, i) => {
      if (!vid) return;
      if (i === currentIndex) vid.play().catch(() => { });
      else vid.pause();
    });
  }, [currentIndex]);

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 bg-black"
      style={{
        zIndex: 1050,
        overflowY: "scroll",
        scrollSnapType: "y mandatory",
      }}
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
            style={{
              width: "auto",
              height: "auto",
              maxWidth: "100%",
              maxHeight: "90vh",
            }}
            loop
            controls={false}
          />
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              background: "rgba(255, 255, 255, 0.24)",
              padding: "8px 12px",
              borderRadius: "8px",
            }}
          >
            <i className="bi bi-eye"></i> 200k
          </div>
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);

  // Feed & Viewer states
  const [showVideoFeed, setShowVideoFeed] = useState(false);
  const [videoStartIndex, setVideoStartIndex] = useState(0);
  const [showImageViewer, setShowImageViewer] = useState(null);

  // Followers/Following/Requests state
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [requested, setRequested] = useState([]);

  const navigate = useNavigate();
  const { uid: paramUid } = useParams();
  const currentUser = auth.currentUser;
  const uid = paramUid || currentUser?.uid;

  // Cloudinary ENV
  const cloudinaryPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const cloudinaryCloud = import.meta.env.VITE_CLOUDINARY_NAME;

  useEffect(() => {
    if (!uid) {
      navigate("/login");
      return;
    }

    const userRef = ref(db, `usersData/${uid}`);
    const unsubscribeUser = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setProfileData(data);
        setBio(data.bio || "");
        setFollowers(Object.keys(data.followers || {}));
        setFollowing(Object.keys(data.following || {}));
        setRequested(Object.keys(data.followRequests?.received || {}));
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
  }, [uid, navigate]);

  // DP Upload
  let handleDpUpdate = async () => {
    if (!currentUser || !file) return toast.warn("Select an image first!");
    if (!cloudinaryPreset || !cloudinaryCloud) return toast.error("❌ Cloudinary ENV not configured!");
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
      await update(ref(db, `usersData/${currentUser.uid}`), { photoURL });
      await updateProfile(currentUser, { photoURL });
      setProfileData((prev) => ({ ...prev, photoURL }));

      // Update all posts of this user
      const postsRef = ref(db, "galleryImages");
      onValue(postsRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        Object.entries(data).forEach(([id, post]) => {
          if (post.userId === currentUser.uid) {
            update(ref(db, `galleryImages/${id}`), { userPic: photoURL });
          }
        });
      });

      toast.success("🎉 Profile picture updated!");
    } catch (err) {
      console.error(err);
      toast.error("❌ Error uploading DP!");
    } finally {
      setFile(null);
      setUploading(false);
    }
  };

  // Bio Update
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

  // Delete Post
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

  // const handleLogout = async () => {
  //   await signOut(auth);
  //   navigate("/login");
  // };

  if (loading) return <p>Loading profile...</p>;
  if (!profileData) return <p>No profile found.</p>;

  const isOwner = currentUser?.uid === uid;
  const filteredPosts =
    activeTab === "all" ? userPosts : userPosts.filter((p) => p.type === activeTab);

  return (
    <div className="container my-5" style={{ maxWidth: 900 }}>
      {/* Profile Info */}
      <div className="row d-flex align-items-start justify-content-center mb-5 gap-3">
        <div className="col-auto text-center">
          <div className="position-relative">
            <img
              src={profileData.photoURL || "https://via.placeholder.com/150?text=Profile"}
              alt="Profile"
              className="rounded-circle mb-2 shadow"
              width={120}
              height={120}
              style={{ objectFit: "cover", border: "3px solid #007bff" }}
            />
            {isOwner && (
              <input
                type="file"
                className="position-absolute bottom-0 end-0 form-control p-0"
                style={{ width: 35, height: 35, borderRadius: "50%", cursor: "pointer" }}
                accept="image/*"
                onChange={(e) => setFile(e.target.files[0])}
              />
            )}
          </div>
          {isOwner && (
            <button
              className="threeD-btn blueBtn mt-2"
              onClick={handleDpUpdate}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Upload DP"}
            </button>
          )}
        </div>

        <div className="col text-start d-flex flex-column justify-content-center gap-2">
          <h2 className="fw-bold">{profileData.username}</h2>
          <p className="mb-1">
            <strong>Email:</strong> {profileData.email || "Not provided"}
          </p>
          <p className="mb-1">
            <strong>Bio:</strong> {profileData.bio || "No bio yet"}
          </p>
          <div className="d-flex flex-wrap gap-2 mt-2">
            <button className="threeD-btn redBtn" onClick={() => navigate(`/followers/${uid}`)}>
              Followers: {followers.length}
            </button>
            <button className="threeD-btn yellowBtn" onClick={() => navigate(`/following/${uid}`)}>
              Following: {following.length}
            </button>
            <button className="threeD-btn blueBtn" onClick={() => navigate(`/requested/${uid}`)}>
              Requested: {requested.length}
            </button>
            {isOwner && (
              <button
                className={`threeD-btn ${profileData.isLocked ? "redBtn" : "lightGrayBtn"}`}
                onClick={toggleLockProfile}
              >
                {profileData.isLocked ? "Unlock Profile 🔓" : "Lock Profile 🔒"}
              </button>
            )}
            {isOwner && (
              <button
                className="btn btn-primary threeD-btn blueBtn"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapseExample"
                aria-expanded="false"
                aria-controls="collapseExample"
              >
                Edit Bio
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Bio Edit Accordion */}
      {isOwner && (
        <div className="collapse mb-5 text-end" id="collapseExample">
          <div className="accordion-body">
            <textarea
              className="form-control mb-2"
              rows={5}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write something about yourself..."
            />
            <button className="threeD-btn blueBtn" onClick={handleBioUpdate}>
              Save Bio
            </button>
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
        <style>
          {`
.mobile-tab-bar {
  position: sticky;
  bottom: 0;
  width: 100%;
  display: flex;
  justify-content: space-around;
  background: #fff;
  box-shadow: 0 -3px 10px rgba(0,0,0,0.1);
  padding: 8px 0;
  border-top-left-radius: 15px;
  border-top-right-radius: 15px;
  z-index: 100;
}
.mobile-tab-btn {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  border: none;
  background: none;
  font-weight: 600;
  font-size: 0.9rem;
  color: #555;
  transition: all 0.2s ease;
  border-radius: 12px;
  margin: 0 4px;
}
.mobile-tab-btn.active {
  background: #007bff;
  color: #fff;
  box-shadow: 0 4px 8px rgba(0,123,255,0.3);
}
.mobile-tab-btn:active { transform: translateY(2px); }
`}
        </style>
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
                  <p className="card-text mb-0 text-truncate">{post.caption || "No caption"}</p>
                  {isOwner && (
                    <button
                      className="threeD-btn redBtn btn-sm"
                      onClick={() => {
                        setSelectedPostId(post.id);
                        setShowDeleteModal(true);
                      }}
                    >
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

      {/* Delete Modal */}
      {showDeleteModal && (
        <div
          className="modal fade show custom-modal"
          style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content border-0 shadow-lg rounded">
              <div className="modal-header border-0 pb-0">
                <h6 className="modal-title fw-bold">Delete this post?</h6>
              </div>
              <div className="modal-body pt-2">
                <p className="small text-muted mb-0">
                  This action <strong>cannot be undone</strong>. Do you really want to delete this post?
                </p>
              </div>
              <div className="modal-footer border-0 pt-2 gap-2">
                <button
                  className="threeD-btn lightGrayBtn btn-sm"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="threeD-btn redBtn btn-sm"
                  onClick={() => {
                    handleDeletePost(selectedPostId);
                    setShowDeleteModal(false);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Video Feed */}
      {showVideoFeed && (
        <VideoFeed
          videos={filteredPosts.filter((p) => p.type === "video").map((p) => ({ id: p.id, src: p.src }))}
          startIndex={videoStartIndex}
          onClose={() => setShowVideoFeed(false)}
        />
      )}

      {/* Fullscreen Image Viewer */}
      {showImageViewer && <ImageViewer src={showImageViewer} onClose={() => setShowImageViewer(null)} />}

      {/* Logout */}
      <button className="btn btn-outline-danger mb-5" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
};

export default AdminProfile;
