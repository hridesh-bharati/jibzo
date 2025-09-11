// src/components/Gallery/GetPost.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, set, remove, push, serverTimestamp } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import Heart from "./Heart";
import ShareButton from "./ShareBtn";
import "./Gallery.css";

// Skeleton loader
function CardSkeleton() {
  return (
    <div className="card insta-card mb-4" aria-busy="true">
      <div
        style={{ height: 300, background: "#eee", borderRadius: 8 }}
        className="skeleton"
      />
    </div>
  );
}

/* -----------------------
   Fullscreen Modal Player
   (opens when user clicks a feed video)
   ----------------------- */
function FullscreenVideoModal({ show, src, onClose }) {
  if (!show) return null;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-75 d-flex align-items-center justify-content-center"
      style={{ zIndex: 2000, backgroundColor: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 1100, padding: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <video
          src={src}
          autoPlay
          controls
          playsInline
          style={{ width: "100%", height: "auto", borderRadius: 10, background: "#000" }}
        />
        {/* <div className="text-end mt-2">
          <button className="btn btn-light btn-sm" onClick={onClose}>Close</button>
        </div> */}
      </div>
    </div>
  );
}

/* -----------------------
   VideoPreview (All tab)
   - muted autoplay
   - onClick opens Fullscreen modal
   ----------------------- */
function VideoPreview({ src, id, videoRefs, onOpen }) {
  const refEl = useRef(null);

  useEffect(() => {
    videoRefs.current[id] = refEl.current;
    return () => delete videoRefs.current[id];
  }, [id, videoRefs]);

  return (
    <video
      ref={refEl}
      data-id={id}
      src={src}
      className="w-100"
      style={{ maxHeight: "80vh", borderRadius: 8, objectFit: "cover", cursor: "pointer" }}
      loop
      playsInline
      autoPlay
      controls={false}
      onClick={() => onOpen(src)}
    />
  );
}

/* -----------------------
   ReelsPlayer (Video tab)
   - vertical fullscreen scrolling with one video active
   ----------------------- */
function ReelsPlayer({ posts }) {
  const containerRef = useRef(null);
  const videoRefs = useRef({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const v = videoRefs.current[entry.target.dataset.id];
          if (!v) return;
          if (entry.isIntersecting && entry.intersectionRatio > 0.8) {
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        });
      },
      { threshold: [0.5, 0.8] }
    );

    Object.values(videoRefs.current).forEach((el) => {
      try {
        observer.observe(el);
      } catch {}
    });

    return () => {
      try {
        Object.values(videoRefs.current).forEach((el) => observer.unobserve(el));
      } catch {}
    };
  }, [posts]);

  return (
    <div
      ref={containerRef}
      className="reels-container"
      style={{
        height: "100vh",
        overflowY: "scroll",
        scrollSnapType: "y mandatory",
      }}
    >
      {posts.map((post) => (
        <div
          key={post.id}
          style={{
            height: "100vh",
            scrollSnapAlign: "start",
            position: "relative",
          }}
        >
          <video
            ref={(el) => (videoRefs.current[post.id] = el)}
            data-id={post.id}
            src={post.src}
            className="w-100 h-100"
            style={{ objectFit: "cover" }}
            loop
            controls
            playsInline
          />
          <div
            style={{
              position: "absolute",
              bottom: 20,
              left: 20,
              color: "#fff",
              textShadow: "0 0 5px rgba(0,0,0,0.8)",
            }}
          >
            <strong>{post.user}</strong>
            <p style={{ margin: 0 }}>{post.caption}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -----------------------
   PDF Viewer (simple iframe preview)
   ----------------------- */
function PdfViewer({ url }) {
  return (
    <iframe
      src={url}
      title="pdf-viewer"
      style={{
        width: "100%",
        height: "80vh",
        border: "none",
        borderRadius: 8,
        display: "block",
      }}
    />
  );
}

/* -----------------------
   Main GetPost component
   ----------------------- */
export default function GetPost() {
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [commentText, setCommentText] = useState("");
  const [offcanvasPost, setOffcanvasPost] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [guestId, setGuestId] = useState(null);

  // video refs used in All tab auto-play logic
  const videoRefs = useRef({});

  // fullscreen modal state
  const [fullscreenSrc, setFullscreenSrc] = useState(null);

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
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
    return () => unsub();
  }, []);

  // realtime posts fetch
  useEffect(() => {
    const postsRef = ref(db, "galleryImages");
    return onValue(postsRef, (snap) => {
      const data = snap.val();
      if (!data) return setPosts([]);
      const arr = Object.entries(data).map(([id, v]) => ({ id, ...v }));
      arr.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setPosts(arr);
    });
  }, []);

  const isAdmin = () =>
    (currentUser?.email || "").toLowerCase() ===
    (import.meta.env.VITE_ADMIN_EMAIL || "").toLowerCase();

  // likes
  const toggleLike = async (id) => {
    const userId = currentUser?.uid || guestId;
    const post = posts.find((p) => p.id === id);
    const already = post?.likes?.[userId];
    if (already) await remove(ref(db, `galleryImages/${id}/likes/${userId}`));
    else await set(ref(db, `galleryImages/${id}/likes/${userId}`), true);
  };

  // comments
  const addComment = async (id) => {
    if (!commentText.trim()) return;
    const userId = currentUser?.uid || guestId;
    const userName =
      currentUser?.displayName ||
      currentUser?.email?.split("@")[0] ||
      "Guest";
    await push(ref(db, `galleryImages/${id}/comments`), {
      userId,
      userName,
      text: commentText.trim(),
      timestamp: serverTimestamp(),
    });
    setCommentText("");
  };

  const deleteComment = async (postId, cid, commentUserId) => {
    const uid = currentUser?.uid || guestId;
    if (isAdmin() || uid === commentUserId) {
      await remove(ref(db, `galleryImages/${postId}/comments/${cid}`));
    }
  };

  const deletePost = async (postId, userId) => {
    const uid = currentUser?.uid || guestId;
    if (!(isAdmin() || uid === userId)) return;
    await remove(ref(db, `galleryImages/${postId}`));
  };

  // Auto-play/pause videos in All tab (muted autoplay)
  useEffect(() => {
    if (filter !== "all") return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const v = videoRefs.current[entry.target.dataset.id];
          if (!v) return;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            // muted autoplay in feed
            v.muted = false;
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        });
      },
      { threshold: [0.5, 0.6, 0.75] }
    );

    Object.values(videoRefs.current).forEach((el) => {
      try {
        observer.observe(el);
      } catch {}
    });

    return () => {
      try {
        Object.values(videoRefs.current).forEach((el) => observer.unobserve(el));
      } catch {}
    };
  }, [posts, filter]);

  // Pause all feed videos when modal is open
  useEffect(() => {
    if (fullscreenSrc) {
      Object.values(videoRefs.current).forEach((v) => {
        try { v && v.pause(); } catch {}
      });
    }
  }, [fullscreenSrc]);

  const visiblePosts = filter === "all" ? posts : posts.filter((p) => p.type === filter);

  // Render preview depending on type
  const renderPreview = useCallback(
    (post) => {
      if (post.type === "image") {
        return (
          <img
            src={post.src}
            alt={post.caption}
            className="img-fluid"
            style={{ borderRadius: 8 }}
          />
        );
      }
      if (post.type === "video") {
        // pass onOpen to open fullscreen modal
        return (
          <VideoPreview
            src={post.src}
            id={post.id}
            videoRefs={videoRefs}
            onOpen={(src) => setFullscreenSrc(src)}
          />
        );
      }
      if (post.type === "pdf") {
        return <PdfViewer url={post.src} />;
      }
      return (
        <a href={post.src} target="_blank" rel="noopener noreferrer">
          Open file
        </a>
      );
    },
    [videoRefs]
  );

  return (
    <div className="container-fluid p-0">
      {/* Tabs */}
      <div className="d-flex justify-content-center gap-2 mb-3">
        {["all", "image", "video", "pdf"].map((t) => (
          <button
            key={t}
            className={`btn btn-sm ${filter === t ? "btn-primary" : "btn-outline-primary"}`}
            onClick={() => setFilter(t)}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Video tab: reels style */}
      {filter === "video" ? (
        <ReelsPlayer posts={visiblePosts} />
      ) : (
        <div className="gallery-feed container">
          {visiblePosts.length === 0 ? (
            [...Array(3)].map((_, i) => <CardSkeleton key={i} />)
          ) : (
            visiblePosts.map((post) => {
              const uid = currentUser?.uid || guestId;
              const liked = post.likes?.[uid];
              const likeCount = post.likes ? Object.keys(post.likes).length : 0;

              return (
                <div key={post.id} className="card insta-card mb-4">
                  <div className="card-header d-flex align-items-center bg-white border-0">
                    <img
                      src={post.userPic || "icons/avatar.jpg"}
                      alt="profile"
                      className="rounded-circle me-2"
                      style={{ width: 40, height: 40, objectFit: "cover" }}
                    />
                    <strong>{post.user || "Guest"}</strong>
                    <button
                      className="btn btn-sm border ms-auto"
                      data-bs-toggle="offcanvas"
                      data-bs-target="#imageOffcanvas"
                      onClick={() => setOffcanvasPost(post)}
                    >
                      <i className="bi bi-three-dots"></i>
                    </button>
                  </div>

                  <div className="p-2">{renderPreview(post)}</div>

                  <div className="card-body p-2">
                    <div className="d-flex align-items-center mb-2">
                      <Heart liked={liked} onToggle={() => toggleLike(post.id)} />
                      <small className="ms-2 text-muted">{likeCount} likes</small>
                      <button
                        className="btn btn-link p-0 mx-3"
                        onClick={() => document.getElementById(`commentInput_${post.id}`)?.focus()}
                      >
                        <i className="bi bi-chat fs-4"></i>
                      </button>
                      <ShareButton link={post.src} />
                    </div>

                    <p><strong>{post.user}</strong> {post.caption}</p>

                    {/* Comments */}
                    <div className="comments mb-2" style={{ maxHeight: 150, overflowY: "auto" }}>
                      {post.comments && Object.entries(post.comments).map(([cid, c]) => (
                        <div key={cid} className="d-flex justify-content-between" style={{ fontSize: "0.9rem" }}>
                          <div><strong>{c.userName}</strong>: {c.text}</div>
                          {(isAdmin() || currentUser?.uid === c.userId) && (
                            <button className="btn-close btn-sm" onClick={() => deleteComment(post.id, cid, c.userId)} />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="input-group">
                      <input
                        id={`commentInput_${post.id}`}
                        type="text"
                        className="form-control"
                        placeholder="Add a comment..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addComment(post.id)}
                      />
                      <button className="btn btn-primary" disabled={!commentText.trim()} onClick={() => addComment(post.id)}>Post</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Offcanvas */}
      <div className="offcanvas offcanvas-bottom" id="imageOffcanvas" style={{ height: "40vh" }}>
        <div className="offcanvas-header">
          <h5>Options</h5>
          <button className="btn-close" data-bs-dismiss="offcanvas" />
        </div>
        <div className="offcanvas-body">
          {offcanvasPost && (
            <>
              <button className="btn btn-outline-primary w-100 mb-2" onClick={() => navigator.clipboard.writeText(offcanvasPost.src)}>Copy Link</button>
              {(isAdmin() || currentUser?.uid === offcanvasPost.userId) && (
                <button className="btn btn-danger w-100" onClick={() => deletePost(offcanvasPost.id, offcanvasPost.userId)} data-bs-dismiss="offcanvas">Delete</button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Fullscreen video modal */}
      <FullscreenVideoModal
        show={!!fullscreenSrc}
        src={fullscreenSrc}
        onClose={() => setFullscreenSrc(null)}
      />
    </div>
  );
}
