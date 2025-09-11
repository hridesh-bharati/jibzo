// src/components/Gallery/GetPost.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import {
  ref,
  onValue,
  set,
  remove,
  push,
  serverTimestamp,
} from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import Heart from "./Heart";
import ShareButton from "./ShareBtn";
import "./Gallery.css";

/* -----------------------
   Skeleton loader
----------------------- */
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
----------------------- */
function FullscreenVideoModal({ show, src, onClose }) {
  if (!show) return null;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ zIndex: 2000, backgroundColor: "rgba(0,0,0,0.95)" }}
    >
      {/* Close button */}
      <button
        className="btn btn-light position-absolute top-0 end-0 m-3 rounded-circle"
        style={{ width: 40, height: 40 }}
        onClick={onClose}
      >
        ✕
      </button>

      <div style={{ width: "100%", maxWidth: 1100, padding: 20 }}>
        <video
          src={src}
          autoPlay
          controls
          playsInline
          style={{
            width: "100%",
            height: "auto",
            maxHeight: "90vh",
            borderRadius: 10,
            background: "#000",
          }}
        />
      </div>
    </div>
  );
}

/* -----------------------
   VideoPreview (All tab)
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
      className="video-preview"
      style={{
        width: "auto",          // actual width
        height: "auto",         // actual height
        maxWidth: "100%",       // prevent overflow
        maxHeight: "80vh",      // limit to viewport
        borderRadius: 8,
        cursor: "pointer",
        background: "#000",     // optional: black bars
      }}
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
----------------------- */
function ReelsPlayer({ posts }) {
  const videoRefs = useRef({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const v = videoRefs.current[entry.target.dataset.id];
          if (!v) return;
          if (entry.isIntersecting && entry.intersectionRatio > 0.8) {
            v.play().catch(() => { });
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
      } catch { }
    });

    return () => {
      try {
        Object.values(videoRefs.current).forEach((el) =>
          observer.unobserve(el)
        );
      } catch { }
    };
  }, [posts]);

  return (
    <div
      className="reels-container"
      style={{ height: "100vh", overflowY: "scroll", scrollSnapType: "y mandatory" }}
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
          <div
            key={post.id}
            style={{
              height: "100vh",
              scrollSnapAlign: "start",
              position: "relative",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              background: "#ffffffff",
            }}
          >
            <video
              ref={(el) => (videoRefs.current[post.id] = el)}
              data-id={post.id}
              src={post.src}
              loop
              playsInline
              style={{
                width: "auto",
                height: "auto",
                maxWidth: "100%",
                maxHeight: "90vh",
                shadow: '2px 2px 10px black',
                background: "#ffffffff",
              }}
            />

            <div
              style={{
                position: "absolute",
                bottom: 20,
                left: 20,
                color: "#fff",
                textShadow: "0 0 5px rgba(255, 255, 255, 0.8)",
              }}
            >
              <strong>{post.user}</strong>
              <p style={{ margin: 0 }}>{post.caption}</p>
            </div>
          </div>

        </div>
      ))}
    </div>
  );
}

/* -----------------------
   PDF Preview Card
----------------------- */
function PdfPreview({ url, name }) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        overflow: "hidden",
        marginBottom: 10,
        background: "#fff",
      }}
    >
      <iframe
        src={`https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(
          url
        )}`}
        title={name || "Document.pdf"}
        style={{
          width: "100%",
          height: "400px",
          border: "none",
        }}
      />


    </div>
  );
}

/* -----------------------
   Main GetPost component
----------------------- */
export default function GetPost({ showFilter = true }) {
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [commentText, setCommentText] = useState("");
  const [offcanvasPost, setOffcanvasPost] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [guestId, setGuestId] = useState(null);
  const [fullscreenSrc, setFullscreenSrc] = useState(null);

  const videoRefs = useRef({});

  // guest id
  useEffect(() => {
    let id = localStorage.getItem("guestId");
    if (!id) {
      id = "guest_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      localStorage.setItem("guestId", id);
    }
    setGuestId(id);
  }, []);

  // auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
    return () => unsub();
  }, []);

  // fetch posts
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

  // like
  const toggleLike = async (id) => {
    const userId = currentUser?.uid || guestId;
    const post = posts.find((p) => p.id === id);
    const already = post?.likes?.[userId];
    if (already) await remove(ref(db, `galleryImages/${id}/likes/${userId}`));
    else await set(ref(db, `galleryImages/${id}/likes/${userId}`), true);
  };

  // comment
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

  // autoplay videos in All tab
  useEffect(() => {
    if (filter !== "all") return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const v = videoRefs.current[entry.target.dataset.id];
          if (!v) return;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            v.muted = false;
            v.play().catch(() => { });
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
      } catch { }
    });

    return () => {
      try {
        Object.values(videoRefs.current).forEach((el) =>
          observer.unobserve(el)
        );
      } catch { }
    };
  }, [posts, filter]);

  // pause feed videos when modal open
  useEffect(() => {
    if (fullscreenSrc) {
      Object.values(videoRefs.current).forEach((v) => {
        try {
          v && v.pause();
        } catch { }
      });
    }
  }, [fullscreenSrc]);

  const visiblePosts =
    filter === "all" ? posts : posts.filter((p) => p.type === filter);

  // render post preview
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
        return <PdfPreview url={post.src} name={post.caption} />;
      }
      return null;
    },
    [videoRefs]
  );

  return (
    <div className="container-fluid p-0 mt-3">
      {/* Tabs → only render if showFilter = true */}
      {showFilter && (
        <div className="d-flex justify-content-center gap-2 mb-3">
          {["all", "image", "video", "pdf"].map((t) => (
            <button
              key={t}
              className={`btn btn-sm threeD-btn ${filter === t ? "active-btn" : ""
                }`}
              onClick={() => setFilter(t)}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

      )}


      {/* Video tab → reels */}
      {filter === "video" ? (
        <ReelsPlayer posts={visiblePosts} />
      ) : (
        <div className="gallery-feed p-0 container">
          {visiblePosts.length === 0 ? (
            [...Array(3)].map((_, i) => <CardSkeleton key={i} />)
          ) : (
            visiblePosts.map((post) => {
              const uid = currentUser?.uid || guestId;
              const liked = post.likes?.[uid];
              const likeCount = post.likes
                ? Object.keys(post.likes).length
                : 0;

              return (
                <div key={post.id} className="card insta-card mb-4">
                  {/* Header */}
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

                  {/* Post Content */}
                  <div className="p-2">{renderPreview(post)}</div>

                  {/* Card Body */}
                  <div className="card-body p-2">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="d-flex align-items-center">
                        <Heart liked={liked} onToggle={() => toggleLike(post.id)} />
                        <small className="ms-2 text-muted">{likeCount} likes</small>

                        <button
                          className="btn btn-link text-muted p-0 mx-3"
                          onClick={() =>
                            document.getElementById(`commentInput_${post.id}`)?.focus()
                          }
                        >
                          <i className="bi bi-chat fs-1"></i>
                        </button>

                        <ShareButton link={post.src} />
                      </div>

                      {post.type === "pdf" && (
                        <button
                          className="btn btn-sm btn-light d-flex align-items-center"
                          onClick={() => window.open(post.url || post.src, "_blank")}
                        >
                          <i className="bi bi-file-earmark-pdf fs-4 text-danger me-2"></i>
                          Open PDF
                        </button>
                      )}
                    </div>

                    {/* Caption */}
                    <p>
                      <strong>{post.user}</strong> {post.caption}
                    </p>

                    {/* Comments */}
                    <div
                      className="comments mb-2"
                      style={{ maxHeight: 150, overflowY: "auto" }}
                    >
                      {post.comments &&
                        Object.entries(post.comments).map(([cid, c]) => (
                          <div
                            key={cid}
                            className="d-flex justify-content-between"
                            style={{ fontSize: "0.9rem" }}
                          >
                            <div>
                              <strong>{c.userName}</strong>: {c.text}
                            </div>
                            {(isAdmin() || currentUser?.uid === c.userId) && (
                              <button
                                className="btn-close btn-sm"
                                onClick={() => deleteComment(post.id, cid, c.userId)}
                              />
                            )}
                          </div>
                        ))}
                    </div>

                    {/* Add Comment */}
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
                      <button
                        className="btn btn-primary"
                        disabled={!commentText.trim()}
                        onClick={() => addComment(post.id)}
                      >
                        Post
                      </button>
                    </div>
                  </div>
                </div>

              );
            })
          )}
        </div>
      )}

      {/* Offcanvas */}
      <div
        className="offcanvas offcanvas-bottom"
        id="imageOffcanvas"
        data-bs-backdrop="false"
        style={{ height: "40vh", zIndex: 1000 }}
      >
        <div className="offcanvas-header">
          <h5>Options</h5>
          <button className="btn-close" data-bs-dismiss="offcanvas" />
        </div>
        <div className="offcanvas-body">
          {offcanvasPost && (
            <>
              <button
                className="btn btn-outline-primary w-100 mb-2"
                onClick={() =>
                  navigator.clipboard.writeText(offcanvasPost.src)
                }
              >
                Copy Link
              </button>
              {(isAdmin() || currentUser?.uid === offcanvasPost.userId) && (
                <button
                  className="btn btn-danger w-100"
                  onClick={() =>
                    deletePost(offcanvasPost.id, offcanvasPost.userId)
                  }
                  data-bs-dismiss="offcanvas"
                >
                  Delete
                </button>
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
