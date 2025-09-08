import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebaseConfig";
import { ref, onValue, remove, update } from "firebase/database";
import { signOut, updateProfile } from "firebase/auth";
import { useNavigate, useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";

const UserProfile = () => {
  const [profileData, setProfileData] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🔹 Delete Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);

  const [file, setFile] = useState(null);
  const [bio, setBio] = useState("");
  const [uploading, setUploading] = useState(false);

  const navigate = useNavigate();
  const { uid: paramUid } = useParams();

  const imgbbAPI = import.meta.env.VITE_IMGBB_API_KEY;

  useEffect(() => {
    const currentUser = auth.currentUser;
    const uid = paramUid || currentUser?.uid;

    if (!uid) {
      navigate("/login");
      return;
    }

    const userRef = ref(db, `usersData/${uid}`);
    const unsubscribeUser = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setProfileData({
          ...data,
          followers: data.followers ? Object.keys(data.followers).length : 0,
          following: data.following ? Object.keys(data.following).length : 0,
        });
        setBio(data.bio || "");
      } else {
        setProfileData(null);
      }
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
      } else {
        setUserPosts([]);
      }
    });

    return () => {
      unsubscribeUser();
      unsubscribePosts();
    };
  }, [paramUid, navigate]);

  // 🔹 Update Bio only
  const handleBioUpdate = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await update(ref(db, `usersData/${user.uid}`), { bio });
      setProfileData((prev) => ({ ...prev, bio }));
      toast.success("✅ Bio updated successfully!");
    } catch (error) {
      console.error("Error updating bio:", error);
      toast.error("❌ Failed to update bio!");
    }
  };

  // 🔹 Update DP using imgbb
  const handleDpUpdate = async () => {
    const user = auth.currentUser;
    if (!user || !file) {
      toast.warn("Please select an image first!");
      return;
    }

    setUploading(true);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onloadend = async () => {
        const base64Image = reader.result.split(",")[1];

        const formData = new FormData();
        formData.append("image", base64Image);

        const response = await fetch(
          `https://api.imgbb.com/1/upload?key=${imgbbAPI}`,
          {
            method: "POST",
            body: formData,
          }
        );

        const data = await response.json();

        if (data.success) {
          const photoURL = data.data.url;

          await update(ref(db, `usersData/${user.uid}`), { photoURL });
          await updateProfile(user, { photoURL });

          setProfileData((prev) => ({ ...prev, photoURL }));
          toast.success("🎉 Profile picture updated successfully!");
        } else {
          toast.error("❌ Failed to upload image to imgbb.");
        }

        setFile(null);
        setUploading(false);
      };
    } catch (error) {
      console.error("Error updating DP:", error);
      toast.error("❌ Error updating profile picture!");
      setUploading(false);
    }
  };

  // 🔹 Delete Post
  const handleDeletePost = async (postId) => {
    try {
      await remove(ref(db, `galleryImages/${postId}`));
      toast.success("🗑️ Post deleted successfully!");
    } catch (error) {
      toast.error("❌ Failed to delete post.");
    }
  };

  // 🔹 Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.info("👋 Logged out successfully!");
      navigate("/login");
    } catch (error) {
      toast.error("❌ Logout failed!");
    }
  };

  if (loading) return <p>Loading profile...</p>;
  if (!profileData) return <p>No profile data found.</p>;

  return (
    <div className="container my-5" style={{ maxWidth: 900 }}>
      {/* Profile Header */}
      <div className="row d-flex align-items-start justify-content-center">
        <div className="col-4">
          <img
            src={profileData.photoURL || "https://via.placeholder.com/150"}
            alt="Profile"
            className="rounded-circle"
            width={100}
            height={100}
            style={{ objectFit: "cover" }}
          />
          <input
            type="file"
            className="form-control mb-2"
            accept="image/*"
            onChange={(e) => setFile(e.target.files[0])}
            style={{ width: "100px", height: "35px" }}
          />
          <button
            className="btn btn-primary btn-sm border-0"
            onClick={handleDpUpdate}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload DP"}
          </button>
        </div>

        <div className="col-8">
          <h2>{profileData.username}</h2>
          <p>
            <strong>Email:</strong> {profileData.email || "Not provided"}
          </p>
          <p>
            <strong>Bio:</strong> {profileData.bio || "No bio yet"}
          </p>
          <div className="d-flex gap-3 small">
            <Link to={`/followers/${paramUid || auth.currentUser?.uid}`}>
              <button className="btn btn-primary btn-sm border-0">
                Followers:{profileData.followers}
              </button>
            </Link>
            <Link to={`/following/${paramUid || auth.currentUser?.uid}`}>
              <button className="btn btn-primary btn-sm border-0">
                Following:{profileData.following}
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* 🔹 Edit Profile Accordion */}
      {auth.currentUser?.uid === (paramUid || auth.currentUser?.uid) && (
        <div className="accordion my-3" id="profileEditAccordion">
          {/* Bio Edit */}
          <div className="accordion-item">
            <h2 className="accordion-header" id="headingBio">
              <button
                className="accordion-button bg-light"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapseBio"
                style={{ boxShadow: "none" }}
              >
                Edit Bio
              </button>
            </h2>
            <div id="collapseBio" className="accordion-collapse collapse">
              <div className="accordion-body">
                <textarea
                  className="form-control mb-2"
                  rows={3}
                  placeholder="Write your bio..."
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

      {/* Posts */}
      <h4>Posts</h4>
      <div className="row g-3 mb-4">
        {userPosts.length > 0 ? (
          userPosts.map((post) => (
            <div key={post.id} className="col-12 col-sm-6 col-md-4">
              <div className="card shadow-sm">
                <img
                  src={post.src}
                  className="card-img-top rounded"
                  alt={post.caption || ""}
                  style={{ objectFit: "cover", height: 200 }}
                />
                <div className="card-body">
                  <p className="card-text">{post.caption}</p>
                  {auth.currentUser?.uid ===
                    (paramUid || auth.currentUser?.uid) && (
                      <button
                        className="btn btn-sm btn-outline-danger mt-2"
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
          <p>No posts available</p>
        )}
      </div>


      {/* 🔹 Delete Confirmation Modal */}
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
            <div className="modal-content border-0 shadow-lg animate-zoom">
              <div className="modal-header border-0 pb-0">
                <h6 className="modal-title fw-bold">Delete this post?</h6>
              </div>
              <div className="modal-body pt-2">
                <p className="small text-muted mb-0">
                  This action <strong>cannot be undone</strong>.
                  Do you really want to delete this post?
                </p>
              </div>
              <div className="modal-footer border-0 pt-2">
                <button
                  className="btn btn-sm btn-light"
                  onClick={() => setShowDeleteModal(false)}
                >
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

      <style>
        {`
  /* Dark overlay */
  .custom-modal {
    background-color: rgba(0, 0, 0, 0.7);
    z-index: 1055;
  }

  /* Zoom-in animation */
  @keyframes zoomIn {
    from {
      transform: scale(0.7);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .animate-zoom {
    animation: zoomIn 0.25s ease-out;
  }

  /* Compact modal */
  .custom-modal .modal-dialog {
    max-width: 360px;
  }

  .custom-modal .modal-content {
    border-radius: 12px;
    padding: 5px;
  }

  .custom-modal .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  `}
      </style>


      {/* Logout */}
      <button className="btn btn-danger mb-3" onClick={handleLogout}>
        Logout <i class="bi bi-box-arrow-right"></i>
      </button>
      <footer className="text-center py-4  mb-4 border-top bg-light">
        <p className="fw-bold mb-0">Hridesh Bharati</p>
        <small className="text-muted">Founder · Creator of this App</small>
      </footer>


    </div>
  );
};

export default UserProfile;
