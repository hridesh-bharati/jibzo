import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebaseConfig";
import { ref, onValue, set, remove, push, serverTimestamp } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import Heart from "./Heart";
import ShareButton from "./ShareBtn";
import "./Gallery.css";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL?.toLowerCase().trim();

// Shuffle function to randomize the posts array
function shuffleArray(array) {
  return array
    .map((item) => ({ item, sortKey: Math.random() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ item }) => item);
}


// Skeleton loader component
function CardSkeleton() {
  return (
    <div className="card insta-card mb-4" aria-busy="true" aria-label="Loading post">
      <div className="card-header d-flex align-items-center bg-white border-0">
        <div
          style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "#ddd", marginRight: "0.5rem" }}
          className="skeleton"
        />
        <div style={{ width: 100, height: 20, backgroundColor: "#ddd", borderRadius: 4 }} className="skeleton" />
        <div style={{ marginLeft: "auto" }}>
          <div style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: "#ddd" }} className="skeleton" />
        </div>
      </div>

      <div className="insta-img-wrapper border border-light" style={{ height: 300, backgroundColor: "#eee" }} />

      <div className="card-body p-2">
        <div className="d-flex align-items-center mb-2">
          <div className="p-0 m-0 d-flex align-items-center">
            <div style={{ width: 24, height: 24, backgroundColor: "#ddd", borderRadius: 4 }} className="skeleton" />
            <small
              style={{ width: 40, height: 14, backgroundColor: "#ddd", borderRadius: 4, marginLeft: "0.5rem" }}
              className="skeleton"
            />
          </div>

          <div style={{ width: 30, height: 30, marginLeft: "2rem", backgroundColor: "#ddd", borderRadius: 4 }} className="skeleton" />
          <div style={{ width: 30, height: 30, marginLeft: "1rem", backgroundColor: "#ddd", borderRadius: 4 }} className="skeleton" />
        </div>

        <div>
          <div style={{ width: "60%", height: 16, backgroundColor: "#ddd", borderRadius: 4 }} className="skeleton mb-2" />
          <div style={{ width: "90%", height: 16, backgroundColor: "#ddd", borderRadius: 4 }} className="skeleton" />
        </div>

        <div className="comments mb-2" style={{ maxHeight: 150, overflowY: "auto" }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ width: "70%", height: 14, backgroundColor: "#ddd", borderRadius: 4 }} className="skeleton" />
              <div style={{ width: 20, height: 20, backgroundColor: "#ddd", borderRadius: 4 }} className="skeleton" />
            </div>
          ))}
        </div>

        <div className="input-group">
          <div style={{ flex: 1, height: 38, backgroundColor: "#ddd", borderRadius: 4 }} className="skeleton" />
          <div style={{ width: 60, height: 38, backgroundColor: "#ddd", borderRadius: 4, marginLeft: 8 }} className="skeleton" />
        </div>
      </div>

      <style>{`
        .skeleton {
          animation: pulse 1.5s infinite ease-in-out;
        }
        @keyframes pulse {
          0% { background-color: #ddd; }
          50% { background-color: #ccc; }
          100% { background-color: #ddd; }
        }
      `}</style>
    </div>
  );
}

export default function GetPost() {
  const [rawImages, setRawImages] = useState([]);
  const [shuffledImages, setShuffledImages] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [offcanvasImage, setOffcanvasImage] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [guestId, setGuestId] = useState(null);

  // Copy Link (cross-browser + mobile safe)
  const copyLink = async (url) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        alert("✅ Link copied!");
      } else {
        // Fallback (mobile safe)
        const input = document.createElement("input");
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
        alert("✅ Link copied!");
      }
    } catch (err) {
      alert("❌ Failed to copy link!");
    }
  };

  // Download Image (forces browser download)
  const downloadImage = (url, filename) => {
    try {
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename); // ✅ triggers real download
      link.setAttribute("target", "_blank");   // ✅ works better on mobile
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("❌ Download failed!");
    }
  };
  const saveToGallery = async (url, filename) => {
    if ("showSaveFilePicker" in window) {
      // ✅ Modern browsers (Chrome, Edge, Android Chrome)
      const response = await fetch(url);
      const blob = await response.blob();

      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "Image", accept: { "image/jpeg": [".jpg"] } }],
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();

      alert("✅ Saved directly to chosen folder!");
    } else {
      // Fallback normal download
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };


  // Generate guest ID
  useEffect(() => {
    let id = localStorage.getItem("guestId");
    if (!id) {
      id = "guest_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      localStorage.setItem("guestId", id);
    }
    setGuestId(id);
  }, []);

  // Listen to auth changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  // Fetch images from Firebase
  useEffect(() => {
    const galleryRef = ref(db, "galleryImages");
    return onValue(galleryRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const imagesArray = Object.entries(data).map(([id, v]) => ({ id, ...v }));

        if (shuffledImages.length === 0) {
          setShuffledImages(shuffleArray(imagesArray));
        } else {
          setShuffledImages((prev) => {
            const oldMap = new Map(prev.map((img) => [img.id, img]));
            imagesArray.forEach((img) => oldMap.set(img.id, img));
            const ordered = prev.map((img) => oldMap.get(img.id)).filter(Boolean);
            const newImages = imagesArray.filter((img) => !prev.some((p) => p.id === img.id));
            return [...ordered, ...newImages];
          });
        }
        setRawImages(imagesArray);
      } else {
        setRawImages([]);
        setShuffledImages([]);
      }
    });
  }, [shuffledImages.length]);

  const isAdmin = () => (currentUser?.email || "").toLowerCase().trim() === ADMIN_EMAIL;

  // Toggle like
  const toggleLike = async (id) => {
    const userId = currentUser?.uid || guestId;
    if (!userId) return;
    const img = shuffledImages.find((img) => img.id === id);
    const alreadyLiked = img?.likes?.[userId];

    if (alreadyLiked) {
      await remove(ref(db, `galleryImages/${id}/likes/${userId}`));
    } else {
      await set(ref(db, `galleryImages/${id}/likes/${userId}`), true);
    }
  };

  // Add comment
  const addComment = async (id) => {
    if (!commentText.trim()) return;
    const userId = currentUser?.uid || guestId;
    let userName = currentUser ? currentUser.displayName || currentUser.email?.split("@")[0] || "User" : "Guest";

    await push(ref(db, `galleryImages/${id}/comments`), {
      userId,
      userName,
      text: commentText,
      timestamp: serverTimestamp(),
    });

    setCommentText("");
  };

  // Delete comment
  const deleteComment = async (postId, commentId, commentUserId) => {
    const currentId = currentUser?.uid || guestId;
    if (isAdmin() || currentId === commentUserId) {
      await remove(ref(db, `galleryImages/${postId}/comments/${commentId}`));

      setShuffledImages((prevImages) =>
        prevImages.map((img) => {
          if (img.id === postId) {
            const updatedComments = Object.entries(img.comments)
              .filter(([id]) => id !== commentId)
              .reduce((acc, [id, comment]) => ({ ...acc, [id]: comment }), {});
            return { ...img, comments: updatedComments };
          }
          return img;
        })
      );
    }
  };

  // Delete image
  const deleteImage = async (imgId, imgUserId) => {
    const currentId = currentUser?.uid || guestId;
    if (!(isAdmin() || currentId === imgUserId)) return;

    await remove(ref(db, `galleryImages/${imgId}`));

    setShuffledImages((prev) => prev.filter((img) => img.id !== imgId));
    setRawImages((prev) => prev.filter((img) => img.id !== imgId));
    setOffcanvasImage(null);
  };

  return (
    <div>
      <div className="gallery-feed">
        {shuffledImages.length === 0
          ? [...Array(3)].map((_, i) => <CardSkeleton key={i} />)
          : shuffledImages.map((img) => {
            const userId = currentUser?.uid || guestId;
            const liked = img.likes?.[userId];
            const likeCount = img.likes ? Object.keys(img.likes).length : 0;

            return (
              <div key={img.id} className="card insta-card mb-4">
                <div className="card-header d-flex align-items-center bg-white border-0">
                  <img
                    src={img.userPic || "icons/avatar.jpg"}
                    alt="profile"
                    className="rounded-circle me-2"
                    style={{ width: "40px", height: "40px", objectFit: "cover" }}
                  />
                  <strong>{img.user || "Guest User"}</strong>
                  <button
                    className="btn btn-sm border rounded-pill ms-auto"
                    data-bs-toggle="offcanvas"
                    data-bs-target="#imageOffcanvas"
                    onClick={() => setOffcanvasImage(img)}
                  >
                    <i className="bi bi-three-dots"></i>
                  </button>
                </div>

                <div className="insta-img-wrapper border border-light">
                  <img src={img.src} alt="Gallery" className="insta-img img-fluid" />
                </div>

                <div className="card-body p-2">
                  <div className="d-flex align-items-center mb-2">
                    <div className="p-0 m-0 d-flex align-items-center">
                      <Heart liked={liked} onToggle={() => toggleLike(img.id)} />
                      <small className="text-muted ms-2">{likeCount} likes</small>
                    </div>

                    <button
                      className="btn btn-link p-0 mx-4 text-dark"
                      onClick={() => {
                        const input = document.getElementById(`commentInput_${img.id}`);
                        if (input) input.focus();
                      }}
                    >
                      <i className="bi bi-chat fs-1"></i>
                    </button>
                    <ShareButton link={img.src} />
                  </div>

                  <p className="mb-2">
                    <strong>{img.user || "Guest User"}</strong> {img.caption}
                  </p>

                  <div className="comments mb-2" style={{ maxHeight: "150px", overflowY: "auto" }}>
                    {img.comments &&
                      Object.entries(img.comments)
                        .sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0))
                        .map(([commentId, comment]) => (
                          <div
                            key={commentId}
                            className="d-flex justify-content-between align-items-start mb-1"
                            style={{ fontSize: "0.9rem" }}
                          >
                            <div>
                              <strong>{comment.userName || "User"}</strong>: {comment.text}
                            </div>
                            {(isAdmin() || currentUser?.uid === comment.userId) && (
                              <button
                                className="btn btn-sm btn-danger btn-close"
                                aria-label="Delete comment"
                                onClick={() => deleteComment(img.id, commentId, comment.userId)}
                              />
                            )}
                          </div>
                        ))}
                  </div>

                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Add a comment..."
                      id={`commentInput_${img.id}`}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addComment(img.id);
                      }}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={() => addComment(img.id)}
                      disabled={!commentText.trim()}
                    >
                      Post
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Offcanvas/modal for image options */}
      <div
        className="offcanvas offcanvas-bottom"
        tabIndex={-1}
        id="imageOffcanvas"
        aria-labelledby="imageOffcanvasLabel"
        style={{ zIndex: 999, height: "40vh" }}
        data-bs-backdrop="false"
      >
        <div className="offcanvas-header">
          <h5 className="offcanvas-title" id="imageOffcanvasLabel">
            Options
          </h5>
          <button
            type="button"
            className="btn-close text-reset"
            data-bs-dismiss="offcanvas"
            aria-label="Close"
          ></button>
        </div>

        <div className="offcanvas-body">
          {offcanvasImage && (
            <>
              {/* ✅ Timestamp */}
              {offcanvasImage.timestamp && (
                <small className="text-muted d-block mb-3" style={{ fontSize: "0.8rem" }}>
                  {new Date(offcanvasImage.timestamp).toLocaleString()}
                </small>
              )}

              {/* ✅ Copy Link */}
              <button
                className="btn btn-outline-primary w-100 mb-2"
                onClick={() => copyLink(offcanvasImage.src)}
              >
                <i className="bi bi-link-45deg me-2"></i> Copy Link
              </button>

              {/* ✅ Download Image */}
              <button
                className="btn btn-outline-success w-100 mb-2"
                onClick={() =>
                  downloadImage(offcanvasImage.src, `post_${offcanvasImage.id || Date.now()}.jpg`)
                }
              >
                <i className="bi bi-download me-2"></i> Download Image
              </button>

              {/* ✅ Delete button for admin or owner */}
              {(isAdmin() || currentUser?.uid === offcanvasImage.userId) && (
                <button
                  className="btn btn-danger w-100"
                  onClick={() => deleteImage(offcanvasImage.id, offcanvasImage.userId)}
                  data-bs-dismiss="offcanvas"
                >
                  Delete Image
                </button>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
}
