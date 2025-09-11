// src/assets/users/AdminProfile.jsx
import React, { useEffect, useState, useRef } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update, get, remove } from "firebase/database";
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

  useEffect(() => {
    setCurrentIndex(startIndex);
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: startIndex * window.innerHeight,
        behavior: "instant",
      });
    }
  }, [startIndex]);

  useEffect(() => {
    const container = containerRef.current;
    const handleScroll = () => {
      const index = Math.round(container.scrollTop / window.innerHeight);
      if (index !== currentIndex) setCurrentIndex(index);
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [currentIndex]);

  useEffect(() => {
    videoRefs.current.forEach((vid, i) => {
      if (vid) {
        if (i === currentIndex) {
          vid.play().catch(() => { });
        } else {
          vid.pause();
        }
      }
    });
  }, [currentIndex]);

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 bg-black"
      style={{ zIndex: 1050, overflowY: "scroll", scrollSnapType: "y mandatory" }}
      ref={containerRef}
      onClick={onClose}
    >
      {videos.map((video, i) => (
        <div
          key={video.id}
          className="w-100 d-flex justify-content-center align-items-center"
          style={{ height: "100vh", scrollSnapAlign: "start" }}
        >
          <video
            ref={(el) => (videoRefs.current[i] = el)}
            src={video.src}
            className="w-100 h-100 object-fit-cover"
            style={{ maxHeight: "100vh" }}
            loop
            controls
          />
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
      className="img-fluid"
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
        + setFollowers(Object.keys(data.followers || {}));
        + setFollowing(Object.keys(data.following || {}));
        + setRequested(Object.keys(data.followRequests?.received || {}));
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

  // Bio Update
  const handleBioUpdate = async () => {
    if (!currentUser) return;
    try {
      await update(ref(db, `usersData/${currentUser.uid}`), { bio });
      setProfileData((prev) => ({ ...prev, bio }));
      toast.success("✅ Bio updated!");
    } catch {
      toast.error("❌ Failed to update bio!");
    }
  };

  // DP Upload
  const handleDpUpdate = async () => {
    if (!currentUser || !file) return toast.warn("Select an image first!");
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

      toast.success("🎉 Profile picture updated!");
    } catch (err) {
      console.error(err);
      toast.error("❌ Error uploading DP!");
    } finally {
      setFile(null);
      setUploading(false);
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
      toast.info("👋 Logged out!");
    } catch {
      toast.error("❌ Logout failed!");
    }
  };

  if (loading) return <p>Loading profile...</p>;
  if (!profileData) return <p>No profile found.</p>;

  const isOwner = currentUser?.uid === uid;
  const filteredPosts =
    activeTab === "all" ? userPosts : userPosts.filter((p) => p.type === activeTab);

  return (
    <div className="container my-5" style={{ maxWidth: 900 }}>
      {/* Profile Info */}
      <div className="row d-flex align-items-start justify-content-center mb-4">
        <div className="col-4 d-flex flex-column justify-content-center align-items-center text-center">
          <img
            src={profileData.photoURL || "https://via.placeholder.com/150"}
            alt="Profile"
            className="rounded-circle mb-2"
            width={100}
            height={100}
            style={{ objectFit: "cover" }}
          />
          {isOwner && (
            <>
              <input
                type="file"
                className="form-control mb-2"
                accept="image/*"
                onChange={(e) => setFile(e.target.files[0])}
                style={{ width: "100px", height: "35px" }}
              />
              <button
                className="btn btn-primary btn-sm mb-2"
                onClick={handleDpUpdate}
                disabled={uploading}
              >
                {uploading ? "Uploading..." : "Upload DP"}
              </button>
            </>
          )}
          {isOwner && (
            <button
              className={`btn ${profileData.isLocked ? "btn-warning" : "btn-outline-warning"} btn-sm`}
              onClick={toggleLockProfile}
            >
              {profileData.isLocked ? "Unlock Profile 🔓" : "Lock Profile 🔒"}
            </button>
          )}
        </div>
        <div className="col-8">
          <h2>{profileData.username}</h2>
          <p>
            <strong>Email:</strong> {profileData.email || "Not provided"}
          </p>
          <p>
            <strong>Bio:</strong> {profileData.bio || "No bio yet"}
          </p>

          {/* Followers/Following/Requested */}
          <div className="d-flex gap-1 small p-0  my-2 mx-0">
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => navigate(`/followers/${uid}`)}
            >
              Followers ({followers.length})
            </button>
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => navigate(`/following/${uid}`)}
            >
              Following ({following.length})
            </button>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => navigate(`/requested/${uid}`)}
            >
              Requested ({requested.length})
            </button>
          </div>

        </div>
      </div>

      {/* Bio Edit */}
      {isOwner && (
        <div className="accordion my-3" id="profileEditAccordion">
          <div className="accordion-item">
            <h2 className="accordion-header" id="headingBio">
              <button
                className="accordion-button bg-light"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapseBio"
              >
                Edit Bio
              </button>
            </h2>
            <div id="collapseBio" className="accordion-collapse collapse">
              <div className="accordion-body">
                <textarea
                  className="form-control mb-2"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
                <button className="btn btn-success" onClick={handleBioUpdate}>
                  Save Bio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <ul className="nav nav-tabs mb-3">
        {"all,image,video,pdf".split(",").map((tab) => (
          <li key={tab} className="nav-item">
            <button
              className={`nav-link ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          </li>
        ))}
      </ul>

      {/* Posts */}
      <h4>Posts</h4>
      <div className="row g-3 mb-4">
        {filteredPosts.length > 0 ? (
          filteredPosts.map((post) => (
            <div key={post.id} className="col-12 col-sm-6 col-md-4">
              <div className="card shadow-sm">
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
                    muted
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
                    src={`https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(
                      post.src
                    )}`}
                    className="card-img-top rounded"
                    style={{ height: 200 }}
                    title="PDF Preview"
                  />
                )}
                <div className="card-body">
                  <p className="card-text">{post.caption || "No caption"}</p>
                  {isOwner && (
                    <button
                      className="btn btn-sm btn-danger"
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
          <p>No posts yet.</p>
        )}
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div
          className="modal fade show custom-modal"
          style={{ display: "block" }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered modal-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-0 pb-0">
                <h6 className="modal-title fw-bold">Delete this post?</h6>
              </div>
              <div className="modal-body pt-2">
                <p className="small text-muted mb-0">
                  This action <strong>cannot be undone</strong>. Do you really want to delete this post?
                </p>
              </div>
              <div className="modal-footer border-0 pt-2">
                <button className="btn btn-sm btn-light" onClick={() => setShowDeleteModal(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={async () => {
                    await handleDeletePost(selectedPostId);
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

      {/* Logout */}
      {isOwner && (
        <button className="btn btn-danger mb-2" onClick={handleLogout}>
          Logout
        </button>
      )}
      <div className="bg-light p-4 rounded shadow-sm text-center mb-5">
        <h6 className="mb-1 fw-bold">Hridesh Bharati</h6>
        <p className="mb-0 text-muted small">Founder & Creator of this App</p>
      </div>
      {/* Fullscreen Viewers */}
      {showVideoFeed && (
        <VideoFeed
          videos={filteredPosts.filter((p) => p.type === "video")}
          startIndex={videoStartIndex}
          onClose={() => setShowVideoFeed(false)}
        />
      )}

      {showImageViewer && (
        <ImageViewer src={showImageViewer} onClose={() => setShowImageViewer(null)} />
      )}
    </div>
  );
};

export default AdminProfile;