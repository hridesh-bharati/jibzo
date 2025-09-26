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

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Gallery Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="alert alert-danger m-3">
          Something went wrong. Please refresh the page.
        </div>
      );
    }
    return this.props.children;
  }
}

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
      <button
        className="btn btn-light position-absolute top-0 end-0 m-3 rounded-circle"
        style={{ width: 40, height: 40 }}
        onClick={onClose}
        aria-label="Close video"
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
            background: "#000",
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
        className="btn btn-light position-absolute top-0 end-0 m-3 rounded-circle"
        style={{ width: 40, height: 40, zIndex: 2001 }}
        onClick={onClose}
        aria-label="Close image"
      >
        ✕
      </button>

      <div style={{ width: "100%", maxWidth: 1100, padding: 20 }}>
        <img
          src={src}
          style={{
            width: "100%",
            height: "auto",
            maxHeight: "90vh",
            objectFit: "contain",
          }}
          alt="Fullscreen"
        />
      </div>
    </div>
  );
}

/* -----------------------
   VideoPreview (All tab)
----------------------- */
const VideoPreview = React.memo(({ src, id, videoRefs, onOpen, isPlaying, onPlayStateChange }) => {
  const refEl = useRef(null);

  useEffect(() => {
    videoRefs.current[id] = refEl.current;
    return () => delete videoRefs.current[id];
  }, [id, videoRefs]);

  useEffect(() => {
    if (!refEl.current) return;

    const playVideo = async () => {
      try {
        if (isPlaying) {
          await refEl.current.play();
        } else {
          refEl.current.pause();
        }
      } catch (error) {
        console.warn("Video play/pause failed:", error);
      }
    };

    playVideo();
  }, [isPlaying]);

  return (
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
        cursor: "pointer",
        background: "#000",
      }}
      loop
      playsInline
      muted={true}
      controls={false}
      onClick={() => onOpen(src)}
      onPlay={() => onPlayStateChange(id, true)}
      onPause={() => onPlayStateChange(id, false)}
    />
  );
});

/* -----------------------
   Comments Offcanvas (YouTube Style) - FIXED WITH REAL-TIME UPDATES
----------------------- */
function CommentsOffcanvas({
  postId, // Changed from post to postId for real-time updates
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

  // Real-time listener for post comments
  useEffect(() => {
    if (!postId || !show) return;

    const postRef = ref(db, `galleryImages/${postId}`);
    const unsubscribe = onValue(postRef, (snapshot) => {
      const postData = snapshot.val();
      if (postData) {
        setPost(postData);
        // Get comments as array
        const commentsData = postData.comments ? Object.entries(postData.comments) : [];
        setComments(commentsData);
      }
    });

    return () => unsubscribe();
  }, [postId, show]);

  if (!postId || !show) return null;

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    await addComment(postId);
    // Comment text will be cleared in parent component after successful addition
  };

  const handleDeleteComment = async (cid, commentUserId) => {
    await deleteComment(postId, cid, commentUserId);
  };

  return (
    <div
      className="position-fixed bottom-0 start-0 w-100 bg-white pb-5"
      style={{
        height: "60vh",
        zIndex: 1050,
        borderTopLeftRadius: "12px",
        borderTopRightRadius: "12px",
        boxShadow: "0 -2px 10px rgba(0,0,0,0.1)"
      }}
    >
      <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
        <h5 className="m-0">Comments ({comments.length})</h5>
        <button
          type="button"
          className="btn-close"
          onClick={onClose}
          aria-label="Close comments"
        ></button>
      </div>
      <div className="d-flex flex-column h-100">
        <div className="flex-grow-1 overflow-auto p-3">
          {comments.length === 0 ? (
            <div className="text-center text-muted py-4">
              <i className="bi bi-chat fs-1 d-block mb-2"></i>
              <p>No comments yet</p>
            </div>
          ) : (
            comments.map(([cid, c]) => (
              <div
                key={cid}
                className="d-flex mb-3"
              >
                <img
                  src={c.userPic || "icons/avatar.jpg"}
                  alt="profile"
                  className="rounded-circle me-2"
                  style={{ width: 36, height: 36, objectFit: "cover" }}
                />
                <div className="flex-grow-1">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <strong>@{c.userName}</strong>
                      <p className="m-0">{c.text}</p>
                    </div>
                    {(isAdmin() || currentUser?.uid === c.userId || guestId === c.userId) && (
                      <button
                        className="btn btn-sm btn-link text-danger p-0 ms-2"
                        onClick={() => handleDeleteComment(cid, c.userId)}
                        aria-label="Delete comment"
                      >
                        <i className="bi bi-trash3-fill"></i>
                      </button>
                    )}
                  </div>
                  <small className="text-muted">
                    {c.timestamp ? new Date(c.timestamp).toLocaleDateString() : "Just now"}
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
              className="form-control"
              placeholder="Add a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
            />
            <button
              className="btn btn-primary"
              disabled={!commentText.trim()}
              onClick={handleAddComment}
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -----------------------
   ReelsPlayer (TikTok style) - UPDATED TO USE postId
----------------------- */
function ReelsPlayer({
  posts,
  videoRefs,
  currentUser,
  guestId,
  toggleLike,
  addComment,
  commentText,
  setCommentText,
  deleteComment,
  isAdmin,
}) {
  const [activeVideo, setActiveVideo] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [currentPostId, setCurrentPostId] = useState(null); // Changed to postId
  const [showIcon, setShowIcon] = useState(null);
  const [animate, setAnimate] = useState(false);

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
        if (el) observer.observe(el);
      } catch { }
    });

    return () => {
      Object.values(videoRefs.current).forEach((el) => {
        try {
          if (el) observer.unobserve(el);
        } catch { }
      });
    };
  }, [posts]);

  useEffect(() => {
    // Play the active video and pause others
    Object.entries(videoRefs.current).forEach(([id, videoEl]) => {
      if (!videoEl) return;

      const playVideo = async () => {
        try {
          if (id === activeVideo) {
            videoEl.muted = false;
            await videoEl.play();
          } else {
            videoEl.pause();
            videoEl.muted = true;
          }
        } catch (error) {
          console.warn("Video autoplay failed:", error);
        }
      };

      playVideo();
    });
  }, [activeVideo]);

  const openComments = (post) => {
    setCurrentPostId(post.id); // Set postId instead of full post object
    setShowComments(true);
  };

  const handleVideoClick = (e, post) => {
    e.stopPropagation();
    const videoEl = videoRefs.current[post.id];
    if (!videoEl) return;

    // Single click = Play/Pause toggle
    if (videoEl.paused) {
      videoEl.play();
      setActiveVideo(post.id);
      setShowIcon({ type: "play" });
    } else {
      videoEl.pause();
      setActiveVideo(null);
      setShowIcon({ type: "pause" });
    }

    // icon auto hide after 1s
    setAnimate(true);
    setTimeout(() => {
      setAnimate(false);
      setShowIcon(null);
    }, 1000);
  };

  const handleVideoDoubleClick = (e, post) => {
    const videoEl = videoRefs.current[post.id];
    if (!videoEl) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;

    if (clickX < rect.width / 2) {
      // Left side → -10s
      videoEl.currentTime = Math.max(0, videoEl.currentTime - 10);
      setShowIcon({ type: "rewind" });
    } else {
      // Right side → +10s
      videoEl.currentTime = Math.min(videoEl.duration, videoEl.currentTime + 10);
      setShowIcon({ type: "forward" });
    }

    setAnimate(true);
    setTimeout(() => {
      setAnimate(false);
      setShowIcon(null);
    }, 1000);
  };

  return (
    <>
      <div
        className="reels-container"
        style={{
          height: "90vh",
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

          return (
            <div
              key={post.id}
              style={{
                height: "85vh",
                width: "100%",
                scrollSnapAlign: "start",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div className="position-relative" style={{ width: "100%", height: "100%" }}>
                <video
                  ref={(el) => (videoRefs.current[post.id] = el)}
                  data-id={post.id}
                  src={post.src}
                  loop
                  playsInline
                  muted={false}
                  className="p-0"
                  style={{ width: "100%", height: "100%", cursor: "pointer" }}
                  onClick={(e) => handleVideoClick(e, post)}
                  onDoubleClick={(e) => handleVideoDoubleClick(e, post)}
                />

                {/* Overlay Icon */}
                {showIcon && (
                  <div
                    className="position-absolute top-50 start-50 translate-middle"
                    style={{
                      fontSize: "3rem",
                      color: "white",
                      textShadow: "0px 0px 15px rgba(0,0,0,0.8)",
                      pointerEvents: "none",
                      opacity: animate ? 1 : 0,
                      transform: animate ? "scale(1)" : "scale(1.5)",
                      transition: "opacity 1s ease, transform 1s ease",
                    }}
                  >
                    {showIcon.type === "play" && <i className="bi bi-play-circle-fill"></i>}
                    {showIcon.type === "pause" && <i className="bi bi-pause-circle-fill"></i>}
                    {showIcon.type === "rewind" && <i className="bi bi-skip-backward-fill"></i>}
                    {showIcon.type === "forward" && <i className="bi bi-skip-forward-fill"></i>}
                  </div>
                )}
              </div>

              {/* Caption */}
              <div
                style={{
                  position: "absolute",
                  bottom: 100,
                  left: 20,
                  color: "#fff",
                  fontSize: "0.95rem",
                  textShadow: "0 0 8px rgba(0,0,0,0.9)",
                  maxWidth: "70%",
                }}
              >
                <img
                  src={post.userPic || "icons/avatar.jpg"}
                  alt="profile"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid #fff",
                    margin: "0 5px 0 0",
                  }}
                />
                <strong>{post.user}</strong>
                {post.userEmail?.toLowerCase() === ADMIN_EMAIL?.toLowerCase() && (
                  <span
                    style={{
                      backgroundColor: "gold",
                      color: "#000",
                      fontWeight: "bold",
                      padding: "0 5px",
                      borderRadius: 4,
                      marginLeft: 5,
                    }}
                  >
                    ADMIN
                  </span>
                )}
                <p style={{ margin: 0 }}>{post.caption}</p>
              </div>

              {/* Buttons + Comments input */}
              <div
                style={{
                  position: "absolute",
                  right: 15,
                  bottom: 80,
                  display: "flex",
                  flexDirection: "column",
                  gap: "15px",
                  alignItems: "center",
                  color: "#fff",
                }}
              >
                {/* Like button */}
                <div className="d-flex flex-column align-items-center">
                  <button 
                    className="btn btn-light rounded-4 px-2" 
                    onClick={(e) => { e.stopPropagation(); toggleLike(post.id); }}
                    aria-label="Like post"
                  >
                    <i className={`bi bi-heart-fill fs-4 ${liked ? "text-danger" : "text-secondary"}`}></i>
                  </button>
                  <small>{likeCount}</small>
                </div>

                {/* Comments button */}
                <div className="d-flex flex-column align-items-center">
                  <button 
                    className="btn btn-light rounded-4 px-2" 
                    onClick={() => openComments(post)}
                    aria-label="Open comments"
                  >
                    <i className="bi bi-chat-fill fs-4"></i>
                  </button>
                  <small>{commentCount}</small>
                </div>

                {/* Share button */}
                <div className="d-flex flex-column align-items-center bg-white rounded-4">
                  <ShareButton link={post.src} />
                </div>
              </div>

              {/* Comment input overlay at the bottom */}
              <div
                style={{
                  position: "absolute",
                  bottom: 15,
                  left: 20,
                  width: "90%",
                  display: "flex",
                  gap: "5px",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Add a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addComment(post.id)}
                  style={{ borderRadius: "20px", padding: "5px 10px" }}
                />
                <button
                  className="btn btn-sm btn-primary px-4"
                  disabled={!commentText.trim()}
                  onClick={() => addComment(post.id)}
                  style={{ borderRadius: "20px" }}
                >
                  Post
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* YouTube Style Comments - UPDATED TO USE postId */}
      <CommentsOffcanvas
        postId={currentPostId} // Pass postId instead of full post object
        currentUser={currentUser}
        guestId={guestId}
        commentText={commentText}
        setCommentText={setCommentText}
        addComment={addComment}
        deleteComment={deleteComment}
        isAdmin={isAdmin}
        show={showComments}
        onClose={() => setShowComments(false)}
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
        style={{ width: "100%", height: "400px", border: "none" }}
      />
    </div>
  );
}

// Shuffle function (Fisher-Yates)
function shuffleArray(array) {
  const newArray = [...array];
  let currentIndex = newArray.length, randomIndex;

  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    [newArray[currentIndex], newArray[randomIndex]] = [
      newArray[randomIndex], newArray[currentIndex]];
  }

  return newArray;
}

/* -----------------------
   Main GetPost component - UPDATED
----------------------- */
export default function GetPost({ showFilter = true, uid, shuffle = false }) {
  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [commentText, setCommentText] = useState("");
  const [offcanvasPost, setOffcanvasPost] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [guestId, setGuestId] = useState(null);
  const [fullscreenSrc, setFullscreenSrc] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [playingVideos, setPlayingVideos] = useState({});
  const [showComments, setShowComments] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState(null); // Changed to postId

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

      if (shuffle) {
        arr = shuffleArray(arr); // 🔀 shuffle if prop is true
      } else {
        arr = arr.sort((a, b) => b.timestamp - a.timestamp); // default sort
      }

      setPosts(arr);
    });
  }, [shuffle]);

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

  const addComment = async (id) => {
    if (!commentText.trim()) return;
    const userId = currentUser?.uid || guestId;
    const userName =
      currentUser?.displayName ||
      currentUser?.email?.split("@")[0] ||
      "Guest";
    const userPic = currentUser?.photoURL || "";

    await push(ref(db, `galleryImages/${id}/comments`), {
      userId,
      userName,
      userPic,
      text: commentText.trim(),
      timestamp: Date.now(),
    });
    setCommentText(""); // Clear comment text after posting
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

  const handleVideoPlayStateChange = useCallback((videoId, isPlaying) => {
    setPlayingVideos(prev => ({ ...prev, [videoId]: isPlaying }));
  }, []);

  const openComments = useCallback((post) => {
    setCommentsPostId(post.id); // Set postId instead of full post object
    setShowComments(true);
  }, []);

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
  }, [posts, filter, playingVideos, handleVideoPlayStateChange]);

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
              style={{ borderRadius: 8, width: "100%", height: "auto" }}
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
    [playingVideos, handleVideoPlayStateChange]
  );

  return (
    <ErrorBoundary>
      <div className="container-fluid p-0 bg-light">
        {showFilter && (
          <div
            className="joi-tabs d-flex justify-content-around align-items-center p-1 m-0 border-bottom"
            style={{
              background: "#fff",
              position: "sticky",
              top: 0,
              zIndex: 100,
            }}
          >
            {["all", "image", "video", "pdf"].map((t) => (
              <button
                key={t}
                className={`joi-tab-btn ${filter === t ? "active" : ""}`}
                onClick={() => {
                  setFilter(t);
                  Object.values(videoRefs.current).forEach((v) => {
                    try {
                      v && v.pause();
                    } catch { }
                  });
                  setPlayingVideos({});
                }}
              >
                {t.toUpperCase()}
                {filter === t && <div className="active-indicator" />}
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
            commentText={commentText}
            setCommentText={setCommentText}
            deleteComment={deleteComment}
            isAdmin={isAdmin}
          />
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
                const commentCount = post.comments ? Object.keys(post.comments).length : 0;

                return (
                  <div key={post.id} className="card border-light mb-4">
                    <div className="card-header custom-white d-flex align-items-center border-0">
                      <style>
                        {`
                        .card-header.custom-white {
                          background: white !important;
                          color: black !important;
                        }
                        `}
                      </style>
                      <img
                        src={post.userPic || "icons/avatar.jpg"}
                        alt="profile"
                        className="rounded-circle me-2"
                        style={{ width: 40, height: 40, objectFit: "cover" }}
                      />
                      <div className="d-flex flex-column">
                        <strong>{post.user || "Guest"}</strong>
                        <small className="text-muted">
                          {post.timestamp ? new Date(post.timestamp).toLocaleDateString() : ""}
                        </small>
                      </div>
                      <button
                        className="btn btn-sm border ms-auto"
                        data-bs-toggle="offcanvas"
                        data-bs-target="#imageOffcanvas"
                        onClick={() => setOffcanvasPost(post)}
                        aria-label="Post options"
                      >
                        <i className="bi bi-three-dots"></i>
                      </button>
                    </div>

                    <div className="p-2 text-center">{renderPreview(post)}</div>
                    <div className="card-body p-2">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <div className="d-flex align-items-center">
                          <Heart
                            liked={liked}
                            onToggle={() => toggleLike(post.id)}
                          />
                          <small className="ms-2 text-muted">
                            {likeCount} likes
                          </small>

                          <div className="mx-3">
                            <button
                              className="btn btn-link text-muted p-0 me-2"
                              onClick={() => openComments(post)}
                              aria-label="View comments"
                            >
                              <i className="bi bi-chat fs-1"></i>
                            </button>
                            <small className="text-muted">{commentCount}</small>
                          </div>
                          <ShareButton link={post.src} />
                          <DownloadBtn link={post.src} />
                        </div>

                        {post.type === "pdf" && (
                          <button
                            className="btn btn-sm btn-light d-flex align-items-center me-2"
                            onClick={() =>
                              window.open(post.url || post.src, "_blank")
                            }
                            aria-label="Open PDF"
                          >
                            <i className="bi bi-file-earmark-pdf fs-4 text-danger"></i>
                            Open
                          </button>
                        )}
                      </div>

                      <p>
                        <strong>{post.user}</strong> {post.caption}
                      </p>

                      {commentCount > 0 && (
                        <div
                          className="text-muted mb-2"
                          style={{ cursor: "pointer" }}
                          onClick={() => openComments(post)}
                        >
                          View all {commentCount} comments
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        <div
          className="offcanvas offcanvas-bottom"
          id="imageOffcanvas"
          data-bs-backdrop="false"
          style={{ height: "40vh", zIndex: 1000 }}
        >
          <div className="offcanvas-header">
            <h5>Options</h5>
            <button className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close options" />
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
                    <i className="bi bi-trash3-fill"></i> Delete Post
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* YouTube Style Comments for All Tab - UPDATED TO USE postId */}
        <CommentsOffcanvas
          postId={commentsPostId} // Pass postId instead of full post object
          currentUser={currentUser}
          guestId={guestId}
          commentText={commentText}
          setCommentText={setCommentText}
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
    </ErrorBoundary>
  );
}