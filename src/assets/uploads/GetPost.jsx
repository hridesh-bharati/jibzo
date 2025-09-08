import React, { useEffect, useState, useRef } from "react";
import { db, auth } from "../../firebaseConfig";
import { ref, onValue, set, remove, push, serverTimestamp, get } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { useParams } from "react-router-dom";
import Heart from "./Heart";
import ShareButton from "./ShareBtn";
import "./Gallery.css";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL?.toLowerCase().trim();

// Shuffle function
function shuffleArray(array) {
  return array
    .map((item) => ({ item, sortKey: Math.random() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ item }) => item);
}

// Skeleton loader (kept same)
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
  const { postId } = useParams();
  const feedRef = useRef(null);

  // Copy link
  const copyLink = async (url) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        alert("✅ Link copied!");
      } else {
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

  // Download helper
  const downloadImage = (url, filename) => {
    try {
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      link.setAttribute("target", "_blank");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert("❌ Download failed!");
    }
  };

  const saveToGallery = async (url, filename) => {
    if ("showSaveFilePicker" in window) {
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
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // guest id
  useEffect(() => {
    let id = localStorage.getItem("guestId");
    if (!id) {
      id = "guest_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      localStorage.setItem("guestId", id);
    }
    setGuestId(id);
  }, []);

  // auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsub();
  }, []);

  // fetch gallery images
  useEffect(() => {
    const galleryRef = ref(db, "galleryImages");
    const unsub = onValue(galleryRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const imagesArray = Object.entries(data).map(([id, v]) => ({ id, ...v }));
        // maintain shuffle while supporting new items update
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

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffledImages.length]);

  const isAdmin = () => (currentUser?.email || "").toLowerCase().trim() === ADMIN_EMAIL;

  // toggle like
  const toggleLike = async (id) => {
    const userId = currentUser?.uid || guestId;
    if (!userId) return;

    const img = shuffledImages.find((img) => img.id === id);
    const alreadyLiked = img?.likes?.[userId];

    if (alreadyLiked) {
      // Unlike → remove like & notification
      await remove(ref(db, `galleryImages/${id}/likes/${userId}`));

      if (img.userId && userId !== img.userId) {
        // remove notification
        const notifRef = ref(db, `notifications/${img.userId}`);
        const snap = await get(notifRef);
        if (snap.exists()) {
          const notifs = snap.val();
          const notifEntry = Object.entries(notifs).find(
            ([, v]) => v.likerId === userId && v.postId === id
          );
          if (notifEntry) {
            const [notifId] = notifEntry;
            await remove(ref(db, `notifications/${img.userId}/${notifId}`));
          }
        }
      }
    } else {
      // Like → add like
      await set(ref(db, `galleryImages/${id}/likes/${userId}`), true);

      if (img.userId && userId !== img.userId) {
        // add notification
        const notifRef = ref(db, `notifications/${img.userId}`);
        const newNotifRef = push(notifRef);
        await set(newNotifRef, {
          likerId: userId,
          postId: id,
          postCaption: img.caption || "your post",
          timestamp: Date.now(),
          seen: false,
        });
      }
    }
  };

  // add comment
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

  // delete comment
  const deleteComment = async (postId, commentId, commentUserId) => {
    const currentId = currentUser?.uid || guestId;
    if (isAdmin() || currentId === commentUserId) {
      await remove(ref(db, `galleryImages/${postId}/comments/${commentId}`));
      setShuffledImages((prevImages) =>
        prevImages.map((img) => {
          if (img.id === postId) {
            const updatedComments = Object.entries(img.comments || {})
              .filter(([id]) => id !== commentId)
              .reduce((acc, [id, comment]) => ({ ...acc, [id]: comment }), {});
            return { ...img, comments: updatedComments };
          }
          return img;
        })
      );
    }
  };

  // delete image
  const deleteImage = async (imgId, imgUserId) => {
    const currentId = currentUser?.uid || guestId;
    if (!(isAdmin() || currentId === imgUserId)) return;
    await remove(ref(db, `galleryImages/${imgId}`));
    setShuffledImages((prev) => prev.filter((img) => img.id !== imgId));
    setRawImages((prev) => prev.filter((img) => img.id !== imgId));
    setOffcanvasImage(null);
  };

  // Scroll to post when route contains postId
  useEffect(() => {
    if (!postId) return;
    // wait a tick so DOM is rendered
    const tryScroll = () => {
      const el = document.getElementById(`post_${postId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        // optionally highlight
        el.style.transition = "box-shadow 0.3s ease";
        el.style.boxShadow = "0 6px 20px rgba(0,0,0,0.12)";
        setTimeout(() => {
          el.style.boxShadow = "";
        }, 2200);
      }
    };

    // If images are not loaded yet, wait until they are
    if (shuffledImages.length === 0) {
      // watch for when images load then scroll
      const unwatch = setInterval(() => {
        const el = document.getElementById(`post_${postId}`);
        if (el) {
          clearInterval(unwatch);
          tryScroll();
        }
      }, 250);
      // clear interval after some time to avoid infinite loop
      setTimeout(() => clearInterval(unwatch), 8000);
    } else {
      tryScroll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, shuffledImages]);

  return (
    <div ref={feedRef}>
      <div className="gallery-feed">
        {shuffledImages.length === 0
          ? [...Array(3)].map((_, i) => <CardSkeleton key={i} />)
          : shuffledImages.map((img) => {
            const userId = currentUser?.uid || guestId;
            const liked = img.likes?.[userId];
            const likeCount = img.likes ? Object.keys(img.likes).length : 0;

            return (
              <div key={img.id} id={`post_${img.id}`} className="card insta-card mb-4">
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
                    aria-label="Open options"
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
                      aria-label="Focus comment"
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
                      aria-label="Add comment"
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
              {offcanvasImage.timestamp && (
                <small className="text-muted d-block mb-3" style={{ fontSize: "0.8rem" }}>
                  {new Date(offcanvasImage.timestamp).toLocaleString()}
                </small>
              )}

              <button
                className="btn btn-outline-primary w-100 mb-2"
                onClick={() => copyLink(offcanvasImage.src)}
              >
                <i className="bi bi-link-45deg me-2"></i> Copy Link
              </button>

              <button
                className="btn btn-outline-success w-100 mb-2"
                onClick={() =>
                  downloadImage(offcanvasImage.src, `post_${offcanvasImage.id || Date.now()}.jpg`)
                }
              >
                <i className="bi bi-download me-2"></i> Download Image
              </button>

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
