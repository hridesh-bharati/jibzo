// src/components/Gallery/GetPost.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import {
  ref,
  onValue,
  set,
  remove,
  push,
} from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import Heart from "./Heart";
import ShareButton from "./ShareBtn";
import "./Gallery.css";
import DownloadBtn from "./DownloadBtn";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "";

/* -----------------------
   IMPROVED linkify function
----------------------- */
function linkify(text) {
  if (!text || typeof text !== 'string') return [text || ""];

  try {
    const urlRegex = /(https?:\/\/[^\s<>]+|www\.[^\s<>]+\.[^\s<>]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s<>]*)?)/gi;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
      const url = match[0];
      const offset = match.index;

      if (offset > lastIndex) {
        parts.push(text.slice(lastIndex, offset));
      }

      let fullUrl = url;
      if (!url.startsWith('http') && !url.startsWith('www.')) {
        if (url.includes('.') && url.length > 3) {
          fullUrl = `https://${url}`;
        } else {
          parts.push(url);
          lastIndex = offset + url.length;
          continue;
        }
      } else if (url.startsWith('www.')) {
        fullUrl = `https://${url}`;
      }

      parts.push(
        <a
          key={offset}
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#0d6efd",
            textDecoration: "underline",
            wordBreak: "break-all",
            cursor: "pointer"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      );

      lastIndex = offset + url.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
  } catch (error) {
    console.error('Linkify error:', error);
    return [text];
  }
}

/* -----------------------
   Skeleton loader
----------------------- */
function CardSkeleton() {
  return (
    <div className="card insta-card mb-4" aria-busy="true">
      <div className="card-header bg-white d-flex align-items-center p-3 border-0">
        <div className="skeleton-avatar skeleton"></div>
        <div className="ms-3 flex-grow-1">
          <div className="skeleton-text skeleton" style={{ width: '120px', height: '16px' }}></div>
          <div className="skeleton-text skeleton" style={{ width: '80px', height: '12px' }}></div>
        </div>
      </div>
      <div
        style={{ height: 300, background: "#f8f9fa", borderRadius: 0 }}
        className="skeleton"
      />
      <div className="card-body p-3">
        <div className="skeleton-text skeleton mb-2" style={{ width: '100%', height: '14px' }}></div>
        <div className="skeleton-text skeleton" style={{ width: '70%', height: '14px' }}></div>
      </div>
    </div>
  );
}

/* -----------------------
   Fullscreen Modal Player
----------------------- */
function FullscreenVideoModal({ show, src, onClose }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (show && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => { });
    }
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ zIndex: 2000, backgroundColor: "rgba(0,0,0,0.95)" }}
    >
      <button
        className="btn btn-light position-absolute top-0 end-0 m-3 rounded-circle d-flex align-items-center justify-content-center"
        style={{ width: 44, height: 44, zIndex: 2001 }}
        onClick={onClose}
      >
        <i className="bi bi-x-lg"></i>
      </button>

      <div style={{ width: "100%", maxWidth: 1100, padding: 20 }}>
        <video
          ref={videoRef}
          src={src}
          autoPlay
          controls
          playsInline
          style={{
            width: "100%",
            height: "auto",
            maxHeight: "90vh",
            background: "#000",
            borderRadius: 12,
          }}
        />
      </div>
    </div>
  );
}

/* -----------------------
   Fullscreen Image Modal
----------------------- */
function FullscreenImageModal({ show, src, onClose }) {
  if (!show) return null;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ zIndex: 2000, backgroundColor: "rgba(0,0,0,0.95)" }}
      onClick={onClose}
    >
      <button
        className="btn btn-light position-absolute top-0 end-0 m-3 rounded-circle d-flex align-items-center justify-content-center"
        style={{ width: 44, height: 44, zIndex: 2001 }}
        onClick={onClose}
      >
        <i className="bi bi-x-lg"></i>
      </button>

      <div style={{ width: "100%", maxWidth: 1100, padding: 20 }}>
        <img
          src={src}
          style={{
            width: "100%",
            height: "auto",
            maxHeight: "90vh",
            objectFit: "contain",
            borderRadius: 12,
          }}
          alt="Fullscreen"
        />
      </div>
    </div>
  );
}

/* -----------------------
   VideoPreview (All tab) - FIXED AUDIO ISSUE
----------------------- */
function VideoPreview({ src, id, videoRefs, onOpen, isPlaying, onPlayStateChange }) {
  const refEl = useRef(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    videoRefs.current[id] = refEl.current;
    return () => delete videoRefs.current[id];
  }, [id, videoRefs]);

  useEffect(() => {
    if (!refEl.current) return;

    if (isPlaying) {
      // Only play if not already playing and not muted
      if (refEl.current.paused) {
        refEl.current.play().catch(() => { });
      }
    } else {
      refEl.current.pause();
    }
  }, [isPlaying]);

  const handleVideoClick = () => {
    // First pause ALL other videos
    Object.values(videoRefs.current).forEach((video) => {
      if (video && video !== refEl.current) {
        video.pause();
        video.currentTime = 0;
      }
    });
    
    // Then open the fullscreen modal
    onOpen(src);
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (refEl.current) {
      refEl.current.muted = !refEl.current.muted;
      setIsMuted(refEl.current.muted);
    }
  };

  return (
    <div className="position-relative" style={{ cursor: "pointer" }}>
      <video
        ref={refEl}
        data-id={id}
        src={src}
        className="video-preview"
        style={{
          width: "100%",
          height: "40vh",
          maxWidth: "100%",
          maxHeight: "80vh",
          background: "#000",
          borderRadius: 12,
          objectFit: "cover"
        }}
        loop
        playsInline
        muted={false}
        controls={false}
        onClick={handleVideoClick}
        onPlay={() => onPlayStateChange(id, true)}
        onPause={() => onPlayStateChange(id, false)}
      />
      
      {/* Mute/Unmute Button */}
      <button
        className="btn btn-dark bg-dark bg-opacity-50 rounded-circle position-absolute bottom-0 end-0 m-2 d-flex align-items-center justify-content-center"
        onClick={toggleMute}
        style={{ width: 36, height: 36, zIndex: 10 }}
      >
        <i className={`bi ${isMuted ? 'bi-volume-mute-fill' : 'bi-volume-up-fill'} text-white`}></i>
      </button>

      {!isPlaying && (
        <div className="position-absolute top-50 start-50 translate-middle">
          <div className="bg-dark bg-opacity-50 rounded-circle p-3">
            <i className="bi bi-play-fill text-white fs-1"></i>
          </div>
        </div>
      )}
    </div>
  );
}

/* -----------------------
   Comments Offcanvas (YouTube Style)
----------------------- */
function CommentsOffcanvas({
  postId,
  currentUser,
  guestId,
  commentText,
  setCommentText,
  addComment,
  deleteComment,
  isAdmin,
  show,
  onClose
}) {
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);

  useEffect(() => {
    if (!postId || !show) return;

    const postRef = ref(db, `galleryImages/${postId}`);
    const unsubscribe = onValue(postRef, (snapshot) => {
      const postData = snapshot.val();
      if (postData) {
        setPost(postData);
        const commentsData = postData.comments ? Object.entries(postData.comments) : [];
        setComments(commentsData);
      }
    });

    return () => unsubscribe();
  }, [postId, show]);

  if (!postId || !show) return null;

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    await addComment(postId, commentText);
    setCommentText("");
  };

  const handleDeleteComment = async (cid, commentUserId) => {
    await deleteComment(postId, cid, commentUserId);
  };

  return (
    <div
      className="position-fixed bottom-0 start-0 w-100 bg-white"
      style={{
        height: "70vh",
        zIndex: 1050,
        borderTopLeftRadius: "20px",
        borderTopRightRadius: "20px",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.15)"
      }}
    >
      <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
        <h5 className="m-0 fw-bold">Comments ({comments.length})</h5>
        <button
          type="button"
          className="btn-close"
          onClick={onClose}
        ></button>
      </div>
      <div className="d-flex flex-column h-100">
        <div className="flex-grow-1 overflow-auto p-3" style={{ maxHeight: "calc(70vh - 140px)" }}>
          {comments.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-chat fs-1 d-block mb-2 opacity-50"></i>
              <p className="mb-0">No comments yet</p>
              <small>Be the first to comment!</small>
            </div>
          ) : (
            comments.map(([cid, c]) => (
              <div
                key={cid}
                className="d-flex mb-3 p-2 rounded-3"
                style={{ backgroundColor: "#f8f9fa" }}
              >
                <img
                  src={c.userPic || "icons/avatar.jpg"}
                  alt="profile"
                  className="rounded-circle me-3"
                  style={{ width: 40, height: 40, objectFit: "cover", flexShrink: 0 }}
                />
                <div className="flex-grow-1">
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <div className="flex-grow-1">
                      <strong className="d-block">@{c.userName}</strong>
                      <p className="mb-1" style={{ wordBreak: "break-word", lineHeight: 1.4 }}>
                        {linkify(c.text).map((part, index) =>
                          React.isValidElement(part)
                            ? React.cloneElement(part, { key: index })
                            : part
                        )}
                      </p>
                    </div>
                    {(isAdmin() || currentUser?.uid === c.userId || guestId === c.userId) && (
                      <button
                        className="btn btn-sm btn-link text-danger p-0 ms-2 flex-shrink-0"
                        onClick={() => handleDeleteComment(cid, c.userId)}
                        style={{ marginTop: 2 }}
                      >
                        <i className="bi bi-trash3"></i>
                      </button>
                    )}
                  </div>
                  <small className="text-muted">
                    {c.timestamp ? new Date(c.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : "Just now"}
                  </small>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-top bg-light">
          <div className="input-group">
            <input
              type="text"
              className="form-control border-end-0"
              placeholder="Add a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
              style={{
                borderRadius: "25px 0 0 25px",
                padding: "12px 20px",
                border: "2px solid #e9ecef",
                borderRight: "none"
              }}
            />
            <button
              className="btn btn-primary d-flex align-items-center justify-content-center"
              disabled={!commentText.trim()}
              onClick={handleAddComment}
              style={{
                borderRadius: "0 25px 25px 0",
                padding: "12px 20px",
                border: "2px solid #0d6efd",
                borderLeft: "none",
                minWidth: 80
              }}
            >
              <i className="bi bi-send-fill"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -----------------------
   ReelsPlayer (TikTok style) - FIXED AUDIO ISSUE
----------------------- */
function ReelsPlayer({
  posts,
  videoRefs,
  currentUser,
  guestId,
  toggleLike,
  addComment,
  deleteComment,
  isAdmin,
}) {
  const [activeVideo, setActiveVideo] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [currentPostId, setCurrentPostId] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [mutedVideos, setMutedVideos] = useState({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const videoId = entry.target.dataset.id;
          if (entry.isIntersecting && entry.intersectionRatio > 0.75) {
            setActiveVideo(videoId);
          }
        });
      },
      { threshold: [0.75] }
    );

    Object.values(videoRefs.current).forEach((el) => {
      try {
        observer.observe(el);
      } catch { }
    });

    return () => {
      Object.values(videoRefs.current).forEach((el) => {
        try {
          observer.unobserve(el);
        } catch { }
      });
    };
  }, [posts]);

  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([id, videoEl]) => {
      if (!videoEl) return;

      if (id === activeVideo) {
        videoEl.muted = mutedVideos[id] || false;
        videoEl.play().catch(() => { });
      } else {
        videoEl.pause();
        videoEl.currentTime = 0;
      }
    });
  }, [activeVideo, mutedVideos]);

  const toggleMute = (videoId, e) => {
    e.stopPropagation();
    setMutedVideos(prev => ({
      ...prev,
      [videoId]: !prev[videoId]
    }));
  };

  const openComments = (post) => {
    setCurrentPostId(post.id);
    setShowComments(true);
    setCommentText("");
  };

  const handleAddComment = async (postId, text) => {
    if (!text.trim()) return;
    const userId = currentUser?.uid || guestId;
    const userName =
      currentUser?.displayName ||
      currentUser?.email?.split("@")[0] ||
      "Guest";
    const userPic = currentUser?.photoURL || "";

    await push(ref(db, `galleryImages/${postId}/comments`), {
      userId,
      userName,
      userPic,
      text: text.trim(),
      timestamp: Date.now(),
    });
  };

  return (
    <>
      <div
        className="reels-container"
        style={{
          height: "100vh",
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          background: "#000",
        }}
      >
        {posts.map((post) => {
          const uid = currentUser?.uid || guestId;
          const liked = post.likes?.[uid];
          const likeCount = post.likes ? Object.keys(post.likes).length : 0;
          const commentCount = post.comments ? Object.keys(post.comments).length : 0;
          const isMuted = mutedVideos[post.id] || false;

          return (
            <div
              key={post.id}
              style={{
                height: "100vh",
                width: "100%",
                scrollSnapAlign: "start",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <video
                ref={(el) => (videoRefs.current[post.id] = el)}
                data-id={post.id}
                src={post.src}
                loop
                playsInline
                muted={isMuted}
                className="p-0"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover"
                }}
              />

              {/* Gradient Overlay */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: "40%",
                  background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                }}
              />

              {/* Mute/Unmute Button */}
              <button
                className="btn btn-dark bg-dark bg-opacity-50 rounded-circle position-absolute top-0 end-0 m-3 d-flex align-items-center justify-content-center"
                onClick={(e) => toggleMute(post.id, e)}
                style={{ width: 44, height: 44, zIndex: 10 }}
              >
                <i className={`bi ${isMuted ? 'bi-volume-mute-fill' : 'bi-volume-up-fill'} text-white`}></i>
              </button>

              {/* User Info & Caption */}
              <div
                style={{
                  position: "absolute",
                  bottom: 120,
                  left: 15,
                  color: "#fff",
                  fontSize: "0.95rem",
                  textShadow: "0 2px 4px rgba(0,0,0,0.8)",
                  maxWidth: "75%",
                }}
              >
                <div className="d-flex align-items-center mb-2">
                  <img
                    src={post.userPic || "icons/avatar.jpg"}
                    alt="profile"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid #fff",
                      marginRight: 8,
                    }}
                  />
                  <strong className="me-2">{post.user}</strong>
                  {post.userEmail?.toLowerCase() === ADMIN_EMAIL?.toLowerCase() && (
                    <span
                      style={{
                        backgroundColor: "gold",
                        color: "#000",
                        fontWeight: "bold",
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontSize: "0.7rem",
                      }}
                    >
                      ADMIN
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, wordBreak: "break-word", lineHeight: 1.4 }}>
                  {linkify(post.caption).map((part, index) =>
                    React.isValidElement(part)
                      ? React.cloneElement(part, { key: index })
                      : part
                  )}
                </p>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  position: "absolute",
                  right: 15,
                  bottom: 120,
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  alignItems: "center",
                  color: "#fff",
                }}
              >
                <div className="text-center">
                  <button
                    className="btn btn-dark bg-dark bg-opacity-50 rounded-circle p-3 d-flex align-items-center justify-content-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLike(post.id);
                    }}
                    style={{ width: 50, height: 50 }}
                  >
                    <i
                      className={`bi bi-heart-fill fs-5 ${liked ? "text-danger" : "text-white"}`}
                    ></i>
                  </button>
                  <small style={{ color: "#fff", fontSize: "0.8rem" }}>{likeCount}</small>
                </div>

                <div className="text-center">
                  <button
                    className="btn btn-dark bg-dark bg-opacity-50 rounded-circle p-3 d-flex align-items-center justify-content-center"
                    onClick={() => openComments(post)}
                    style={{ width: 50, height: 50 }}
                  >
                    <i className="bi bi-chat-fill fs-5 text-white"></i>
                  </button>
                  <small style={{ color: "#fff", fontSize: "0.8rem" }}>{commentCount}</small>
                </div>

                <div className="text-center">
                  <div className="btn btn-dark bg-dark bg-opacity-50 rounded-circle p-3 d-flex align-items-center justify-content-center" style={{ width: 50, height: 50 }}>
                    <ShareButton link={post.src} />
                  </div>
                </div>
              </div>

              {/* Comment Input */}
              <div
                style={{
                  position: "absolute",
                  bottom: 15,
                  left: 15,
                  right: 15,
                  display: "flex",
                  gap: "8px",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Add a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddComment(post.id, commentText).then(() => setCommentText(""))}
                  style={{
                    borderRadius: "25px",
                    padding: "10px 15px",
                    background: "rgba(255,255,255,0.9)",
                    border: "none"
                  }}
                />
                <button
                  className="btn btn-primary btn-sm px-3 d-flex align-items-center justify-content-center"
                  disabled={!commentText.trim()}
                  onClick={() => handleAddComment(post.id, commentText).then(() => setCommentText(""))}
                  style={{ borderRadius: "25px", minWidth: 60 }}
                >
                  <i className="bi bi-send-fill"></i>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <CommentsOffcanvas
        postId={currentPostId}
        currentUser={currentUser}
        guestId={guestId}
        commentText={commentText}
        setCommentText={setCommentText}
        addComment={handleAddComment}
        deleteComment={deleteComment}
        isAdmin={isAdmin}
        show={showComments}
        onClose={() => {
          setShowComments(false);
          setCommentText("");
        }}
      />
    </>
  );
}

/* -----------------------
   PdfPreview
----------------------- */
function PdfPreview({ url, name }) {
  return (
    <div
      style={{
        border: "1px solid #e9ecef",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 10,
        background: "#fff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
      }}
    >
      <iframe
        src={`https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(
          url
        )}`}
        title={name || "Document.pdf"}
        style={{ width: "100%", height: "400px", border: "none" }}
      />
    </div>
  );
}

/* -----------------------
   Main GetPost component - UPDATED
----------------------- */
export default function GetPost({ showFilter = true, uid }) {
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [offcanvasPost, setOffcanvasPost] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [guestId, setGuestId] = useState(null);
  const [fullscreenSrc, setFullscreenSrc] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [playingVideos, setPlayingVideos] = useState({});
  const [showComments, setShowComments] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState(null);
  const [commentsText, setCommentsText] = useState({});

  const videoRefs = useRef({});

  useEffect(() => {
    let id = localStorage.getItem("guestId");
    if (!id) {
      id = "guest_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
      localStorage.setItem("guestId", id);
    }
    setGuestId(id);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setCurrentUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    const postsRef = ref(db, "galleryImages");
    return onValue(postsRef, (snap) => {
      const data = snap.val();
      if (!data) return setPosts([]);

      let arr = Object.entries(data).map(([id, v]) => ({ id, ...v }));
      arr = arr.sort((a, b) => b.timestamp - a.timestamp);
      setPosts(arr);
    });
  }, []);

  const isAdmin = () =>
    (currentUser?.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const toggleLike = async (id) => {
    const userId = currentUser?.uid || guestId;
    const post = posts.find((p) => p.id === id);
    const already = post?.likes?.[userId];

    const postOwnerId = post.userId;

    if (already) {
      await remove(ref(db, `galleryImages/${id}/likes/${userId}`));
      await remove(ref(db, `notifications/${postOwnerId}/${userId}_${id}`));
    } else {
      await set(ref(db, `galleryImages/${id}/likes/${userId}`), true);

      if (userId !== postOwnerId) {
        await set(ref(db, `notifications/${postOwnerId}/${userId}_${id}`), {
          likerId: userId,
          postId: id,
          postCaption: post.caption || "your post",
          timestamp: Date.now(),
          seen: false
        });
      }
    }
  };

  const addComment = async (postId, text) => {
    if (!text.trim()) return;
    const userId = currentUser?.uid || guestId;
    const userName =
      currentUser?.displayName ||
      currentUser?.email?.split("@")[0] ||
      "Guest";
    const userPic = currentUser?.photoURL || "";

    await push(ref(db, `galleryImages/${postId}/comments`), {
      userId,
      userName,
      userPic,
      text: text.trim(),
      timestamp: Date.now(),
    });

    setCommentsText(prev => ({
      ...prev,
      [postId]: ""
    }));
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

  const handleVideoPlayStateChange = (videoId, isPlaying) => {
    setPlayingVideos(prev => ({ ...prev, [videoId]: isPlaying }));
  };

  const openComments = (post) => {
    setCommentsPostId(post.id);
    setShowComments(true);
  };

  const handleCommentTextChange = (postId, text) => {
    setCommentsText(prev => ({
      ...prev,
      [postId]: text
    }));
  };

  useEffect(() => {
    if (filter !== "all") return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const videoId = entry.target.dataset.id;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const isAnyVideoPlaying = Object.values(playingVideos).some(state => state);
            if (!isAnyVideoPlaying) {
              handleVideoPlayStateChange(videoId, true);
            }
          } else {
            handleVideoPlayStateChange(videoId, false);
          }
        });
      },
      { threshold: [0.6] }
    );

    Object.values(videoRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      Object.values(videoRefs.current).forEach((el) => {
        if (el) observer.unobserve(el);
      });
    };
  }, [posts, filter, playingVideos]);

  useEffect(() => {
    if (fullscreenSrc || fullscreenImage) {
      Object.values(videoRefs.current).forEach((v) => {
        try {
          v && v.pause();
        } catch { }
      });
      setPlayingVideos({});
    }
  }, [fullscreenSrc, fullscreenImage]);

  const visiblePosts =
    uid
      ? posts.filter((p) => p.userId === uid && (filter === "all" || p.type === filter))
      : filter === "all"
        ? posts
        : posts.filter((p) => p.type === filter);

  const renderPreview = useCallback(
    (post) => {
      if (post.type === "image") {
        return (
          <div
            style={{ cursor: "pointer" }}
            onClick={() => setFullscreenImage(post.src)}
          >
            <img
              src={post.src}
              alt={post.caption}
              className="img-fluid"
              style={{
                borderRadius: 12,
                width: "100%",
                height: "auto",
                maxHeight: "60vh",
                objectFit: "cover"
              }}
            />
          </div>
        );
      }
      if (post.type === "video") {
        return (
          <VideoPreview
            src={post.src}
            id={post.id}
            videoRefs={videoRefs}
            onOpen={(src) => setFullscreenSrc(src)}
            isPlaying={playingVideos[post.id] || false}
            onPlayStateChange={handleVideoPlayStateChange}
          />
        );
      }
      if (post.type === "pdf") {
        return <PdfPreview url={post.src} name={post.caption} />;
      }
      return null;
    },
    [videoRefs, playingVideos]
  );

  return (
    <div className="container-fluid p-1 py-0" style={{ minHeight: "100vh", background: "rgba(236, 236, 255, 1)" }}>
      {showFilter && (
        <div
          className="joi-tabs d-flex justify-content-around align-items-center p-2 m-0 border-bottom"
          style={{
            background: "#fff",
            position: "sticky",
            top: 0,
            zIndex: 100,
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)"
          }}
        >
          {["all", "image", "video", "pdf"].map((t) => (
            <button
              key={t}
              className={`joi-tab-btn btn border-0 position-relative ${filter === t ? "active text-primary" : "text-muted"}`}
              onClick={() => {
                setFilter(t);
                Object.values(videoRefs.current).forEach((v) => {
                  try {
                    v && v.pause();
                    v.currentTime = 0; // Reset all videos when changing filter
                  } catch { }
                });
                setPlayingVideos({});
              }}
              style={{
                padding: "12px 16px",
                fontSize: "0.9rem",
                fontWeight: "600",
                background: "none",
                flex: 1
              }}
            >
              {t.toUpperCase()}
              {filter === t && (
                <div
                  className="position-absolute bottom-0 start-50 translate-middle-x"
                  style={{
                    width: "30px",
                    height: "3px",
                    background: "#0d6efd",
                    borderRadius: "2px"
                  }}
                />
              )}
            </button>
          ))}
        </div>
      )}

      {filter === "video" ? (
        <ReelsPlayer
          posts={visiblePosts}
          videoRefs={videoRefs}
          currentUser={currentUser}
          guestId={guestId}
          toggleLike={toggleLike}
          addComment={addComment}
          deleteComment={deleteComment}
          isAdmin={isAdmin}
        />
      ) : (
        <div className="gallery-feed p-0 container" style={{ maxWidth: "600px" }}>
          {visiblePosts.length === 0 ? (
            [...Array(3)].map((_, i) => <CardSkeleton key={i} />)
          ) : (
            visiblePosts.map((post) => {
              const uid = currentUser?.uid || guestId;
              const liked = post.likes?.[uid];
              const likeCount = post.likes
                ? Object.keys(post.likes).length
                : 0;
              const commentCount = post.comments ? Object.keys(post.comments).length : 0;
              const postCommentText = commentsText[post.id] || "";

              return (
                <div key={post.id} className="card border-0 mb-4 p-2 shadow-sm" style={{ borderRadius: "16px" }}>
                  {/* Card Header */}
                  <div className="card-header custom-white d-flex align-items-center border-0 p-3">
                    <style>
                      {`
                        .card-header.custom-white {
                          background: white !important;
                          color: black !important;
                        }
                        .user-avatar {
                          width: 45px !important;
                          height: 45px !important;
                          min-width: 45px !important;
                          min-height: 45px !important;
                          object-fit: cover !important;
                          border: 2px solid #f0f0f0;
                          flex-shrink: 0;
                          cursor: pointer;
                          transition: transform 0.2s ease, box-shadow 0.2s ease;
                        }
                        .user-avatar:hover {
                          transform: scale(1.05);
                          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        }
                        .username-link {
                          cursor: pointer;
                          transition: color 0.2s ease;
                        }
                        .username-link:hover {
                          color: #007bff !important;
                        }
                        `}
                    </style>
                    <div className="position-relative d-inline-block me-3">
                      <img
                        src={post.userPic || "icons/avatar.jpg"}
                        alt="profile"
                        className="rounded-circle"
                        style={{
                          width: 44,
                          height: 44,
                          objectFit: "cover",
                          border: "3px solid #f8f9fa",
                        }}
                      />
                      {post.userEmail?.toLowerCase() === ADMIN_EMAIL?.toLowerCase() && (
                        <span
                          className="badge text-primary bg-transparent position-absolute"
                          style={{
                            bottom: "0",
                            top: "10px"
                          }}
                        >
                          <i className="bi bi-patch-check-fill fs-3"></i>
                        </span>
                      )}
                    </div>

                    <div className="d-flex flex-column flex-grow-1 ">
                      <div className="d-flex align-items-cente flex-column text-start ms-1">
                        <strong className="me-2">{post.user || "Guest"}</strong>
                        <small className="text-muted">
                          {post.timestamp ? new Date(post.timestamp).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : ""}
                        </small>
                      </div>
                    </div>
                    <button
                      className="btn btn-sm btn-light rounded-circle ms-2"
                      data-bs-toggle="offcanvas"
                      data-bs-target="#imageOffcanvas"
                      onClick={() => setOffcanvasPost(post)}
                      style={{ width: 36, height: 36 }}
                    >
                      <i className="bi bi-three-dots"></i>
                    </button>
                  </div>

                  {/* Caption */}
                  {post.caption && (
                    <div className="p-1">
                      <p style={{ margin: 0, wordBreak: "break-word", lineHeight: 1.4 }} className="text-dark">
                        {linkify(post.caption).map((part, index) =>
                          React.isValidElement(part)
                            ? React.cloneElement(part, { key: index })
                            : part
                        )}
                      </p>
                    </div>
                  )}

                  {/* Media Content */}
                  <div className="p-0 text-center">{renderPreview(post)}</div>

                  {/* Card Footer - Actions */}
                  <div className="card-body p-3">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <div className="d-flex align-items-center gap-3">
                        <button
                          className="btn btn-link text-decoration-none p-0 d-flex align-items-center"
                          onClick={() => toggleLike(post.id)}
                        >
                          <i
                            className={`bi bi-heart-fill fs-4 ${liked ? "text-danger" : "text-muted"}`}
                          ></i>
                          <small className="ms-2 text-muted fw-semibold">
                            {likeCount}
                          </small>
                        </button>

                        <button
                          className="btn btn-link text-decoration-none p-0 d-flex align-items-center"
                          onClick={() => openComments(post)}
                        >
                          <i className="bi bi-chat fs-4 text-muted"></i>
                          <small className="ms-2 text-muted fw-semibold">
                            {commentCount}
                          </small>
                        </button>

                        <ShareButton link={post.src} />
                      </div>

                      <div className="d-flex align-items-center gap-2">
                        <DownloadBtn link={post.src} />
                        {post.type === "pdf" && (
                          <button
                            className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                            onClick={() =>
                              window.open(post.url || post.src, "_blank")
                            }
                          >
                            <i className="bi bi-file-earmark-pdf"></i>
                            <span>Open</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Comment Input */}
                    <div className="input-group">
                      <input
                        type="text"
                        className="form-control border-end-0"
                        placeholder="Add a comment..."
                        value={postCommentText}
                        onChange={(e) => handleCommentTextChange(post.id, e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && addComment(post.id, postCommentText)
                        }
                        style={{
                          borderRadius: "25px 0 0 25px",
                          padding: "12px 20px",
                          border: "2px solid #e9ecef",
                          borderRight: "none",
                          fontSize: "0.9rem"
                        }}
                      />
                      <button
                        className="btn btn-primary d-flex align-items-center justify-content-center"
                        disabled={!postCommentText.trim()}
                        onClick={() => addComment(post.id, postCommentText)}
                        style={{
                          borderRadius: "0 25px 25px 0",
                          padding: "12px 20px",
                          border: "2px solid #0d6efd",
                          borderLeft: "none",
                          minWidth: 80
                        }}
                      >
                        <i className="bi bi-send-fill"></i>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Options Offcanvas */}
      <div
        className="offcanvas offcanvas-bottom"
        id="imageOffcanvas"
        data-bs-backdrop="false"
        style={{ height: "auto", maxHeight: "50vh", zIndex: 1000 }}
      >
        <div className="offcanvas-header border-bottom">
          <h5 className="offcanvas-title">Post Options</h5>
          <button type="button" className="btn-close" data-bs-dismiss="offcanvas"></button>
        </div>
        <div className="offcanvas-body">
          {offcanvasPost && (
            <>
              <div className="mb-3">
                <h6 className="text-muted mb-1">Post Name</h6>
                <p className="mb-0">{offcanvasPost?.caption || "Untitled"}</p>
              </div>

              <small className="text-muted d-block mb-3">
                Posted on: {offcanvasPost?.timestamp ? new Date(offcanvasPost.timestamp).toLocaleDateString() : "Unknown date"}
              </small>

              <button
                className="btn btn-outline-primary w-100 mb-2 d-flex align-items-center justify-content-center gap-2 py-2"
                onClick={() =>
                  navigator.clipboard.writeText(offcanvasPost.src)
                }
              >
                <i className="bi bi-link-45deg"></i>
                Copy Link
              </button>

              {(isAdmin() || currentUser?.uid === offcanvasPost.userId) && (
                <button
                  className="btn btn-danger w-100 d-flex align-items-center justify-content-center gap-2 py-2"
                  onClick={() =>
                    deletePost(offcanvasPost.id, offcanvasPost.userId)
                  }
                  data-bs-dismiss="offcanvas"
                >
                  <i className="bi bi-trash3-fill"></i>
                  Delete Post
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* YouTube Style Comments for All Tab */}
      <CommentsOffcanvas
        postId={commentsPostId}
        currentUser={currentUser}
        guestId={guestId}
        commentText={commentsText[commentsPostId] || ""}
        setCommentText={(text) => handleCommentTextChange(commentsPostId, text)}
        addComment={addComment}
        deleteComment={deleteComment}
        isAdmin={isAdmin}
        show={showComments}
        onClose={() => setShowComments(false)}
      />

      <FullscreenVideoModal
        show={!!fullscreenSrc}
        src={fullscreenSrc}
        onClose={() => setFullscreenSrc(null)}
      />

      <FullscreenImageModal
        show={!!fullscreenImage}
        src={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
      />
    </div>
  );
}