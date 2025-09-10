// src/components/Gallery/GetPost.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, set, remove, push, serverTimestamp } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import Heart from "./Heart";
import ShareButton from "./ShareBtn";
import "./Gallery.css";

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
function VideoPlayer({ src, id, videoRefs }) {
  const refEl = useRef(null);

  useEffect(() => {
    videoRefs.current[id] = refEl.current;
    return () => {
      delete videoRefs.current[id];
    };
  }, [id, videoRefs]);

  const handleUserClick = () => {
    const v = refEl.current;
    if (!v) return;
    try {
      v.muted = false;
      v.play().catch(() => {});
      if (v.requestFullscreen) v.requestFullscreen();
      else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen(); // iOS
    } catch (err) {
      console.error("Fullscreen error", err);
    }
  };

  return (
    <div className="position-relative">
      <video
        ref={refEl}
        data-id={id}
        src={src}
        className="insta-video w-100"
        style={{
          maxHeight: "80vh",
          objectFit: "cover",
          borderRadius: 8,
          cursor: "pointer",
        }}
        loop
        playsInline
        muted
        controls={false} // ✅ remove default browser controls
        onClick={handleUserClick}
      />
      {/* optional play icon overlay */}
      <div
        onClick={handleUserClick}
        className="position-absolute top-50 start-50 translate-middle bg-dark bg-opacity-50 text-white rounded-circle d-flex align-items-center justify-content-center"
        style={{ width: 60, height: 60, fontSize: 30, cursor: "pointer" }}
      >
        ▶
      </div>
    </div>
  );
}


function PdfViewer({ url }) {
  // Use Mozilla PDF.js viewer hosted page as viewer (reliable fallback)
  const viewerUrl = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(url)}`;

  return (
    <div>
      <iframe src={viewerUrl} title="pdf-viewer" style={{ width: "100%", height: 600, border: "none", borderRadius: 8 }} />
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary mt-2 w-100">Open PDF in New Tab</a>
    </div>
  );
}

export default function GetPost() {
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState("all"); // all | image | video | pdf
  const [commentText, setCommentText] = useState("");
  const [offcanvasPost, setOffcanvasPost] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [guestId, setGuestId] = useState(null);
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

  // auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
    return () => unsub();
  }, []);

  // fetch posts realtime
  useEffect(() => {
    const postsRef = ref(db, "galleryImages");
    return onValue(postsRef, (snap) => {
      const data = snap.val();
      if (!data) {
        setPosts([]);
        return;
      }
      const arr = Object.entries(data).map(([id, v]) => ({ id, ...v }));
      // newest first
      arr.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setPosts(arr);
    });
  }, []);

  const isAdmin = () => (currentUser?.email || "").toLowerCase().trim() === (import.meta.env.VITE_ADMIN_EMAIL || "").toLowerCase().trim();

  // like toggle
  const toggleLike = async (id) => {
    const userId = currentUser?.uid || guestId;
    if (!userId) return;
    const post = posts.find((p) => p.id === id);
    const alreadyLiked = post?.likes?.[userId];
    if (alreadyLiked) {
      await remove(ref(db, `galleryImages/${id}/likes/${userId}`));
    } else {
      await set(ref(db, `galleryImages/${id}/likes/${userId}`), true);
    }
  };

  // comments
  const addComment = async (id) => {
    if (!commentText.trim()) return;
    const userId = currentUser?.uid || guestId;
    const userName = currentUser?.displayName || currentUser?.email?.split("@")[0] || "Guest";
    await push(ref(db, `galleryImages/${id}/comments`), {
      userId,
      userName,
      text: commentText.trim(),
      timestamp: serverTimestamp(),
    });
    setCommentText("");
  };

  const deleteComment = async (postId, commentId, commentUserId) => {
    const currentId = currentUser?.uid || guestId;
    if (isAdmin() || currentId === commentUserId) {
      await remove(ref(db, `galleryImages/${postId}/comments/${commentId}`));
    }
  };

  const deletePost = async (postId, postUserId) => {
    const currentId = currentUser?.uid || guestId;
    if (!(isAdmin() || currentId === postUserId)) return;
    await remove(ref(db, `galleryImages/${postId}`));
  };

  // IntersectionObserver for auto play/pause videos
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.dataset.id;
          const v = videoRefs.current[id];
          if (!v) return;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            // keep muted autoplay (browser policy)
            v.muted = true;
            v.play().catch(() => { });
          } else {
            v.pause();
          }
        });
      },
      { threshold: [0.25, 0.5, 0.6, 0.75] }
    );

    Object.values(videoRefs.current).forEach((el) => {
      try { observer.observe(el); } catch { }
    });

    return () => {
      try { Object.values(videoRefs.current).forEach((el) => observer.unobserve(el)); } catch { }
    };
  }, [posts]);

  // visible posts based on filter
  const visiblePosts = filter === "all" ? posts : posts.filter((p) => p.type === filter);

  const renderPreview = useCallback((post) => {
    if (!post?.src) return null;
    if (post.type === "image") {
      return <img src={post.src} alt={post.caption} className="insta-img img-fluid" style={{ borderRadius: 8 }} />;
    }
    if (post.type === "video") {
      return <VideoPlayer src={post.src} id={post.id} videoRefs={videoRefs} />;
    }
    if (post.type === "pdf") {
      return <PdfViewer url={post.src} />;
    }
    return <a href={post.src} target="_blank" rel="noopener noreferrer">Open file</a>;
  }, []);

  return (
    <div className="container py-3">
      {/* Tabs */}
      <div className="d-flex justify-content-center gap-2 mb-3">
        <button className={`btn btn-sm ${filter === "all" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setFilter("all")}>ALL</button>
        <button className={`btn btn-sm ${filter === "image" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setFilter("image")}>PHOTO</button>
        <button className={`btn btn-sm ${filter === "video" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setFilter("video")}>VIDEO</button>
        <button className={`btn btn-sm ${filter === "pdf" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setFilter("pdf")}>PDF</button>
      </div>

      <div className="gallery-feed">
        {visiblePosts.length === 0 ? (
          [...Array(3)].map((_, i) => <CardSkeleton key={i} />)
        ) : (
          visiblePosts.map((post) => {
            const userId = currentUser?.uid || guestId;
            const liked = post.likes?.[userId];
            const likeCount = post.likes ? Object.keys(post.likes).length : 0;

            return (
              <div key={post.id} id={`post_${post.id}`} className="card insta-card mb-4">
                <div className="card-header d-flex align-items-center bg-white border-0">
                  <img src={post.userPic || "icons/avatar.jpg"} alt="profile" className="rounded-circle me-2" style={{ width: 40, height: 40, objectFit: "cover" }} />
                  <strong>{post.user || "Guest User"}</strong>

                  <button className="btn btn-sm border rounded-pill ms-auto" data-bs-toggle="offcanvas" data-bs-target="#imageOffcanvas" onClick={() => setOffcanvasPost(post)} aria-label="Open options">
                    <i className="bi bi-three-dots"></i>
                  </button>
                </div>

                <div className="insta-img-wrapper border border-light p-2">
                  {renderPreview(post)}
                </div>

                <div className="card-body p-2">
                  <div className="d-flex align-items-center mb-2">
                    <div className="d-flex align-items-center">
                      <Heart liked={liked} onToggle={() => toggleLike(post.id)} />
                      <small className="text-muted ms-2">{likeCount} likes</small>
                    </div>

                    <button className="btn btn-link p-0 mx-3 text-dark" onClick={() => {
                      const input = document.getElementById(`commentInput_${post.id}`);
                      if (input) input.focus();
                    }} aria-label="Focus comment">
                      <i className="bi bi-chat fs-4"></i>
                    </button>

                    <ShareButton link={post.src} />
                  </div>

                  <p className="mb-2"><strong>{post.user}</strong> {post.caption}</p>

                  <div className="comments mb-2" style={{ maxHeight: 150, overflowY: "auto" }}>
                    {post.comments && Object.entries(post.comments).sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0)).map(([cid, comment]) => (
                      <div key={cid} className="d-flex justify-content-between align-items-start mb-1" style={{ fontSize: "0.9rem" }}>
                        <div><strong>{comment.userName || "User"}</strong>: {comment.text}</div>
                        {(isAdmin() || currentUser?.uid === comment.userId) && (
                          <button className="btn btn-sm btn-danger btn-close" aria-label="Delete comment" onClick={() => deleteComment(post.id, cid, comment.userId)} />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="input-group">
                    <input id={`commentInput_${post.id}`} type="text" className="form-control" placeholder="Add a comment..." value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addComment(post.id); }} />
                    <button className="btn btn-primary" onClick={() => addComment(post.id)} disabled={!commentText.trim()}>Post</button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Offcanvas */}
      <div className="offcanvas offcanvas-bottom" tabIndex={-1} id="imageOffcanvas" style={{ height: "40vh" }}>
        <div className="offcanvas-header">
          <h5 className="offcanvas-title">Options</h5>
          <button type="button" className="btn-close" data-bs-dismiss="offcanvas" />
        </div>
        <div className="offcanvas-body">
          {offcanvasPost && (
            <>
              <button className="btn btn-outline-primary w-100 mb-2" onClick={() => navigator.clipboard.writeText(offcanvasPost.src)}>Copy Link</button>
              <a href={offcanvasPost.src} target="_blank" rel="noopener noreferrer" className="btn btn-outline-success w-100 mb-2">Open</a>
              {(isAdmin() || currentUser?.uid === offcanvasPost.userId) && (
                <button className="btn btn-danger w-100" onClick={() => deletePost(offcanvasPost.id, offcanvasPost.userId)} data-bs-dismiss="offcanvas">Delete</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
