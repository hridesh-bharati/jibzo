// src/components/Gallery/GetPost.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import {
  ref,
  onValue,
  set,
  remove,
  push,
  get
} from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import Heart from "./Heart";
import ShareButton from "./ShareBtn";
import "./Gallery.css";
import DownloadBtn from "./DownloadBtn";
import { useNavigate } from "react-router-dom";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "";

/* -----------------------
   Custom Hook for Dynamic User Data
----------------------- */
const useUserData = (userId) => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!userId) {
      setUserData(null);
      setLoading(false);
      return;
    }
    
    // First try users collection (new sync)
    const userRef = ref(db, `users/${userId}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setUserData(data);
      } else {
        // Fallback to usersData (old structure)
        const userDataRef = ref(db, `usersData/${userId}`);
        onValue(userDataRef, (oldSnapshot) => {
          const oldData = oldSnapshot.val();
          if (oldData) {
            setUserData(oldData);
          } else {
            // Final fallback for guest users or deleted accounts
            setUserData({
              displayName: 'User',
              username: 'User',
              photoURL: 'icons/avatar.jpg',
              email: ''
            });
          }
        });
      }
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [userId]);
  
  return { userData, loading };
};

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
      <div
        style={{ height: 300, background: "#eee", borderRadius: 8 }}
        className="skeleton"
      />
    </div>
  );
}

/* -----------------------
   Post Component with Dynamic User Data
----------------------- */
function PostComponent({ 
  post, 
  currentUser, 
  guestId, 
  toggleLike, 
  addComment, 
  deleteComment, 
  isAdmin, 
  openOptions, 
  openComments,
  renderPreview,
  videoRefs,
  playingVideos,
  handleVideoPlayStateChange,
  commentsText,
  handleCommentTextChange,
  isLiking
}) {
  const { userData, loading } = useUserData(post.userId);
  
  if (loading) {
    return <CardSkeleton />;
  }

  // Use dynamic user data if available, otherwise use post data (for backward compatibility)
  const displayUser = userData?.displayName || userData?.username || post.user || 'User';
  const displayUserPic = userData?.photoURL || post.userPic || 'icons/avatar.jpg';
  const displayUserEmail = userData?.email || post.userEmail || '';

  const uid = currentUser?.uid || guestId;
  const liked = post.likes?.[uid];
  const likeCount = post.likes ? Object.keys(post.likes).filter(key => post.likes[key]).length : 0;
  const commentCount = post.comments ? Object.keys(post.comments).length : 0;
  const postCommentText = commentsText[post.id] || "";
  const isPostLiking = isLiking[post.id] || false;

  const navigate = useNavigate();

  const goToProfile = (userId) => {
    navigate(`/user-profile/${userId}`);
  };

  return (
    <div className="card border-light py-1 mb-3 shadow-sm">
      <div className="card-header custom-white d-flex align-items-center border-0 px-3 py-1">
        <img
          src={displayUserPic}
          alt="profile"
          className="rounded-circle me-2 user-avatar"
          style={{
            width: 40, height: 40, objectFit: "cover", cursor: "pointer"
          }}
          onClick={() => goToProfile(post.userId)}
        />
        <div className="d-flex flex-column">
          <strong className="username-link">{displayUser}</strong>
          {displayUserEmail?.toLowerCase() === ADMIN_EMAIL?.toLowerCase() && (
            <span
              style={{
                backgroundColor: "gold",
                color: "#000",
                fontWeight: "bold",
                padding: "0 5px",
                borderRadius: 4,
                fontSize: "0.7rem",
                marginTop: "2px"
              }}
            >
              ADMIN
            </span>
          )}
          <small className="text-muted text-start">
            {post.timestamp ? new Date(post.timestamp).toLocaleDateString() : ""}
          </small>
        </div>
        <button
          className="btn btn-sm border ms-auto border-light"
          onClick={() => openOptions({
            ...post,
            user: displayUser,
            userPic: displayUserPic,
            userEmail: displayUserEmail
          })}
          style={{
            border: '1px solid #f3f4f6ff',
            borderRadius: '8px',
            padding: '4px 8px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
        >
          <i className="bi bi-three-dots"></i>
        </button>
      </div>

      <div className="p-0 ps-4">
        <p style={{ margin: 0, wordBreak: "break-word" }}>
          <strong>{displayUser}</strong>{" "}
          {linkify(post.caption).map((part, index) =>
            React.isValidElement(part)
              ? React.cloneElement(part, { key: index })
              : part
          )}
        </p>
      </div>

      <div className="p-3 pb-0">{renderPreview(post)}</div>
      <div className="card-body p-3 pt-0">
        <div className="d-flex align-items-center justify-content-between mb-0">
          <div className="d-flex align-items-center justify-content-between w-100">
            <div className="d-flex align-items-center">
              <Heart
                liked={liked}
                onToggle={() => toggleLike(post.id)}
                disabled={isPostLiking}
              />
              <small className="text-muted ms-1">
                {likeCount}
              </small>
            </div>

            <div className="mx-3 d-flex align-items-center">
              <button
                className="btn btn-link text-muted p-0 me-2"
                onClick={() => openComments({
                  ...post,
                  user: displayUser,
                  userPic: displayUserPic,
                  userEmail: displayUserEmail
                })}
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
            >
              <i className="bi bi-file-earmark-pdf fs-4 text-danger me-1"></i>
              Open
            </button>
          )}
        </div>

        {commentCount > 0 && (
          <div
            className="text-muted mb-2 ps-2"
            style={{ cursor: "pointer" }}
            onClick={() => openComments({
              ...post,
              user: displayUser,
              userPic: displayUserPic,
              userEmail: displayUserEmail
            })}
          >
            View all {commentCount} comments
          </div>
        )}

        <div className="input-group mt-1">
          <input
            type="text"
            className="form-control"
            placeholder="Add a comment..."
            value={postCommentText}
            onChange={(e) => handleCommentTextChange(post.id, e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && addComment(post.id, postCommentText)
            }
          />
          <button
            className="btn btn-primary"
            disabled={!postCommentText.trim()}
            onClick={() => addComment(post.id, postCommentText)}
          >
            <i className="bi bi-send me-1"></i>Post
          </button>
        </div>
      </div>
    </div>
  );
}

/* -----------------------
   Fullscreen Modal Player
----------------------- */
function FullscreenVideoModal({ show, src, onClose, onFullscreenOpen }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (show) {
      onFullscreenOpen();
      if (videoRef.current) {
        videoRef.current.play().catch(console.error);
      }
    }
  }, [show, onFullscreenOpen]);

  if (!show) return null;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ zIndex: 2000, backgroundColor: "rgba(0,0,0,0.95)" }}
    >
      <button
        className="btn btn-light position-absolute top-0 end-0 m-3 rounded-circle"
        style={{ width: 40, height: 40, zIndex: 2001 }}
        onClick={onClose}
      >
        ✕
      </button>

      <div style={{ width: "100%", maxWidth: 1100, padding: 20 }}>
        <video
          ref={videoRef}
          src={src}
          autoPlay
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
function FullscreenImageModal({ show, src, onClose, onFullscreenOpen }) {
  useEffect(() => {
    if (show) {
      onFullscreenOpen();
    }
  }, [show, onFullscreenOpen]);

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
function VideoPreview({ src, id, videoRefs, onOpen, isPlaying, onPlayStateChange }) {
  const refEl = useRef(null);
  const [showPlayIcon, setShowPlayIcon] = useState(!isPlaying);

  useEffect(() => {
    videoRefs.current[id] = refEl.current;
    return () => delete videoRefs.current[id];
  }, [id, videoRefs]);

  useEffect(() => {
    if (!refEl.current) return;

    if (isPlaying) {
      refEl.current.muted = false;
      refEl.current.play().catch((error) => {
        console.log('Auto-play failed:', error);
        setShowPlayIcon(true);
      });
      setShowPlayIcon(false);
    } else {
      refEl.current.pause();
      setShowPlayIcon(true);
    }
  }, [isPlaying]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (refEl.current) {
      if (refEl.current.paused) {
        refEl.current.muted = false;
        refEl.current.play().catch((error) => {
          console.log('Play failed:', error);
          setShowPlayIcon(true);
        });
        onPlayStateChange(id, true);
        setShowPlayIcon(false);
      } else {
        refEl.current.pause();
        onPlayStateChange(id, false);
        setShowPlayIcon(true);
      }
    }
  };

  const handleFullscreenClick = (e) => {
    e.stopPropagation();
    if (refEl.current && !refEl.current.paused) {
      refEl.current.pause();
      onPlayStateChange(id, false);
      setShowPlayIcon(true);
    }
    onOpen(src);
  };

  const handleMouseEnter = () => {
    if (!isPlaying) {
      setShowPlayIcon(true);
    }
  };

  const handleMouseLeave = () => {
    if (isPlaying) {
      setShowPlayIcon(false);
    }
  };

  const handlePlay = () => {
    onPlayStateChange(id, true);
    setShowPlayIcon(false);
  };

  const handlePause = () => {
    onPlayStateChange(id, false);
    setShowPlayIcon(true);
  };

  return (
    <div
      className={`video-container ${isPlaying ? 'playing' : ''}`}
      style={{ position: 'relative', cursor: 'pointer' }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
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
          objectFit: "cover",
          borderRadius: "8px"
        }}
        loop
        playsInline
        muted={false}
        controls={false}
        onPlay={handlePlay}
        onPause={handlePause}
        onError={() => {
          setShowPlayIcon(true);
        }}
      />

      {showPlayIcon && (
        <div className="video-play-overlay">
          <i className="bi bi-play-fill text-white fs-1"></i>
        </div>
      )}

      {isPlaying && (
        <div className="playing-indicator">
          <i className="bi bi-pause-fill me-1"></i>Playing
        </div>
      )}

      {isPlaying && (
        <div
          className="volume-indicator"
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '0.7rem',
            pointerEvents: 'none'
          }}
        >
          <i className="bi bi-volume-up-fill me-1"></i>Unmuted
        </div>
      )}

      <button
        className="btn btn-sm btn-dark position-absolute"
        style={{
          bottom: "10px",
          right: "10px",
          opacity: 0.8,
          borderRadius: "20px",
          zIndex: 10
        }}
        onClick={handleFullscreenClick}
      >
        <i className="bi bi-arrows-fullscreen"></i>
      </button>
    </div>
  );
}

/* -----------------------
   Custom Options Bottom Sheet
----------------------- */
function OptionsBottomSheet({ show, post, onClose, onDelete, onCopyLink, canDelete }) {
  if (!show || !post) return null;

  return (
    <>
      <div
        className="options-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1040,
          animation: 'fadeIn 0.3s ease'
        }}
      ></div>

      <div
        className="options-bottom-sheet"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'white',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          padding: '20px',
          zIndex: 1041,
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
          animation: 'slideUp 0.3s ease-out'
        }}
      >
        <div
          className="options-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '1px solid #e9ecef'
          }}
        >
          <h5
            className="options-title"
            style={{
              margin: 0,
              fontWeight: '600',
              color: '#212529',
              fontSize: '1.1rem'
            }}
          >
            Post Options
          </h5>
          <button
            className="options-close-btn"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              color: '#6c757d',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'background-color 0.2s'
            }}
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className="options-content">
          <h6 className="text-muted mb-2">
            Post: <small>{post?.caption || "Untitled"}</small>
          </h6>
          <small className="text-muted d-block mb-3">
            Date: {post?.timestamp ? new Date(post.timestamp).toLocaleDateString() : ""}
          </small>

          <button
            className="btn btn-outline-primary w-100 mb-2 d-flex align-items-center justify-content-center py-2"
            onClick={onCopyLink}
            style={{
              borderRadius: '12px',
              border: '2px solid #0d6efd',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
          >
            <i className="bi bi-link-45deg me-2"></i>Copy Link
          </button>

          {canDelete && (
            <button
              className="btn btn-danger w-100 d-flex align-items-center justify-content-center py-2"
              onClick={onDelete}
              style={{
                borderRadius: '12px',
                fontWeight: '500',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="bi bi-trash3-fill me-2"></i> Delete Post
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .options-close-btn:hover {
          background-color: #f8f9fa !important;
        }

        .btn-outline-primary:hover {
          background-color: #0d6efd !important;
          color: white !important;
        }

        .btn-danger:hover {
          background-color: #dc3545 !important;
          transform: translateY(-1px);
        }
      `}</style>
    </>
  );
}

/* -----------------------
   Comments Offcanvas
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
  const [isAddingComment, setIsAddingComment] = useState(false);

  useEffect(() => {
    if (!postId || !show) return;

    const postRef = ref(db, `galleryImages/${postId}`);
    const unsubscribe = onValue(postRef, (snapshot) => {
      const postData = snapshot.val();
      if (postData) {
        setPost(postData);
        const commentsData = postData.comments ? Object.entries(postData.comments) : [];
        commentsData.sort(([, a], [, b]) => (b.timestamp || 0) - (a.timestamp || 0));
        setComments(commentsData);
      }
    });

    return () => unsubscribe();
  }, [postId, show]);

  if (!postId || !show) return null;

  const handleAddComment = async () => {
    if (!commentText.trim() || isAddingComment) return;

    setIsAddingComment(true);
    try {
      await addComment(postId, commentText);
      setCommentText("");
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setIsAddingComment(false);
    }
  };

  const handleDeleteComment = async (cid, commentUserId) => {
    await deleteComment(postId, cid, commentUserId);
  };

  return (
    <div
      className="position-fixed bottom-0 start-0 w-100 mb-5 bg-white"
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
                      <p style={{ margin: 0, wordBreak: "break-word" }}>
                        {linkify(c.text).map((part, index) =>
                          React.isValidElement(part)
                            ? React.cloneElement(part, { key: index })
                            : part
                        )}
                      </p>
                    </div>
                    {(isAdmin() || currentUser?.uid === c.userId || guestId === c.userId) && (
                      <button
                        className="btn btn-sm btn-link text-danger p-0 ms-2"
                        onClick={() => handleDeleteComment(cid, c.userId)}
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
              onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
              disabled={isAddingComment}
            />
            <button
              className="btn btn-primary"
              disabled={!commentText.trim() || isAddingComment}
              onClick={handleAddComment}
            >
              {isAddingComment ? (
                <div className="spinner-border spinner-border-sm me-1" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              ) : (
                <i className="bi bi-send me-1"></i>
              )}
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
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

/* -----------------------
   Fisher-Yates shuffle algorithm
----------------------- */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/* -----------------------
   Main GetPost component
----------------------- */
export default function GetPost({ showFilter = true, uid }) {
  const [posts, setPosts] = useState([]);
  const [shuffledPosts, setShuffledPosts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [optionsPost, setOptionsPost] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [guestId, setGuestId] = useState(null);
  const [fullscreenSrc, setFullscreenSrc] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [playingVideos, setPlayingVideos] = useState({});
  const [showComments, setShowComments] = useState(false);
  const [commentsPostId, setCommentsPostId] = useState(null);
  const [commentsText, setCommentsText] = useState({});
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isLiking, setIsLiking] = useState({});

  const videoRefs = useRef({});
  const navigate = useNavigate();

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

  // Real-time Firebase listener for posts
  useEffect(() => {
    const postsRef = ref(db, "galleryImages");
    return onValue(postsRef, (snap) => {
      const data = snap.val();
      if (!data) {
        setPosts([]);
        setShuffledPosts([]);
        return;
      }

      let arr = Object.entries(data).map(([id, v]) => ({ id, ...v }));

      setPosts(arr);

      if (isInitialLoad || arr.length !== shuffledPosts.length) {
        const shuffled = shuffleArray(arr);
        setShuffledPosts(shuffled);
        setIsInitialLoad(false);
      } else {
        setShuffledPosts(prevShuffled => {
          const postMap = new Map(arr.map(post => [post.id, post]));
          return prevShuffled.map(post => postMap.get(post.id) || post);
        });
      }
    });
  }, [isInitialLoad, shuffledPosts.length]);

  const isAdmin = () =>
    (currentUser?.email || "").toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Optimized toggleLike with immediate UI update
  const toggleLike = async (postId) => {
    const userId = currentUser?.uid || guestId;

    if (isLiking[postId]) return;

    setIsLiking(prev => ({ ...prev, [postId]: true }));

    try {
      setShuffledPosts(prevShuffled =>
        prevShuffled.map(post => {
          if (post.id === postId) {
            const currentlyLiked = post.likes?.[userId];
            const updatedLikes = currentlyLiked
              ? { ...post.likes, [userId]: undefined }
              : { ...post.likes, [userId]: true };

            return {
              ...post,
              likes: updatedLikes
            };
          }
          return post;
        })
      );

      const post = posts.find((p) => p.id === postId);
      const already = post?.likes?.[userId];
      const postOwnerId = post.userId;

      if (already) {
        await remove(ref(db, `galleryImages/${postId}/likes/${userId}`));
        await remove(ref(db, `notifications/${postOwnerId}/${userId}_${postId}`));
      } else {
        await set(ref(db, `galleryImages/${postId}/likes/${userId}`), true);

        if (userId !== postOwnerId) {
          await set(ref(db, `notifications/${postOwnerId}/${userId}_${postId}`), {
            likerId: userId,
            postId: postId,
            postCaption: post.caption || "your post",
            timestamp: Date.now(),
            seen: false
          });
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      setShuffledPosts(prevShuffled =>
        prevShuffled.map(post => {
          if (post.id === postId) {
            const postFromOriginal = posts.find(p => p.id === postId);
            return postFromOriginal ? { ...postFromOriginal } : post;
          }
          return post;
        })
      );
    } finally {
      setIsLiking(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Optimized addComment with immediate UI update
  const addComment = async (postId, text) => {
    if (!text.trim()) return;

    const userId = currentUser?.uid || guestId;
    const userName = currentUser?.displayName || currentUser?.email?.split("@")[0] || "Guest";
    const userPic = currentUser?.photoURL || "";

    const newComment = {
      userId,
      userName,
      userPic,
      text: text.trim(),
      timestamp: Date.now(),
    };

    try {
      setShuffledPosts(prevShuffled =>
        prevShuffled.map(post => {
          if (post.id === postId) {
            const currentComments = post.comments || {};
            const newCommentId = `temp_${Date.now()}`;
            return {
              ...post,
              comments: {
                ...currentComments,
                [newCommentId]: newComment
              }
            };
          }
          return post;
        })
      );

      await push(ref(db, `galleryImages/${postId}/comments`), newComment);

      setCommentsText(prev => ({
        ...prev,
        [postId]: ""
      }));
    } catch (error) {
      console.error('Error adding comment:', error);
      setShuffledPosts(prevShuffled =>
        prevShuffled.map(post => {
          if (post.id === postId) {
            const postFromOriginal = posts.find(p => p.id === postId);
            return postFromOriginal ? { ...postFromOriginal } : post;
          }
          return post;
        })
      );
    }
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
    setShowOptions(false);
    setOptionsPost(null);
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

  const openOptions = (post) => {
    setOptionsPost(post);
    setShowOptions(true);
  };

  const closeOptions = () => {
    setShowOptions(false);
    setOptionsPost(null);
  };

  const handleCopyLink = () => {
    if (optionsPost?.src) {
      navigator.clipboard.writeText(optionsPost.src);
      closeOptions();
    }
  };

  const handleDeletePost = () => {
    if (optionsPost?.id && optionsPost?.userId) {
      deletePost(optionsPost.id, optionsPost.userId);
    }
  };

  const canDeletePost = (post) => {
    const uid = currentUser?.uid || guestId;
    return isAdmin() || uid === post.userId;
  };

  const handleFullscreenOpen = () => {
    Object.values(videoRefs.current).forEach((videoEl) => {
      if (videoEl && !videoEl.paused) {
        videoEl.pause();
      }
    });
    setPlayingVideos({});
  };

  // Auto-play videos when they come into view (All tab)
  useEffect(() => {
    if (filter !== "all") return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const videoId = entry.target.dataset.id;
          if (entry.isIntersecting && entry.intersectionRatio >= 0.7) {
            const isAnyVideoPlaying = Object.values(playingVideos).some(state => state);
            if (!isAnyVideoPlaying) {
              const videoEl = videoRefs.current[videoId];
              if (videoEl) {
                videoEl.muted = false;
              }
              handleVideoPlayStateChange(videoId, true);
            }
          } else {
            handleVideoPlayStateChange(videoId, false);
          }
        });
      },
      { threshold: [0.7] }
    );

    Object.values(videoRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      Object.values(videoRefs.current).forEach((el) => {
        if (el) observer.unobserve(el);
      });
    };
  }, [shuffledPosts, filter, playingVideos]);

  const getVisiblePosts = useCallback(() => {
    let filteredPosts = uid
      ? shuffledPosts.filter((p) => p.userId === uid && (filter === "all" || p.type === filter))
      : filter === "all"
        ? shuffledPosts
        : shuffledPosts.filter((p) => p.type === filter);

    return filteredPosts;
  }, [shuffledPosts, filter, uid]);

  const visiblePosts = getVisiblePosts();

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
                borderRadius: 8,
                width: "100%",
                height: "auto",
                maxHeight: "60vh",
                objectFit: "contain"
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
    <div className="container-fluid m-0 p-0 bg-light">
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
              className={`joi-tab-btn ${filter === t ? "active" : ''}`}
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

      <div className="gallery-feed p-2 container">
        {visiblePosts.length === 0 ? (
          [...Array(3)].map((_, i) => <CardSkeleton key={i} />)
        ) : (
          visiblePosts.map((post) => (
            <PostComponent
              key={post.id}
              post={post}
              currentUser={currentUser}
              guestId={guestId}
              toggleLike={toggleLike}
              addComment={addComment}
              deleteComment={deleteComment}
              isAdmin={isAdmin}
              openOptions={openOptions}
              openComments={openComments}
              renderPreview={renderPreview}
              videoRefs={videoRefs}
              playingVideos={playingVideos}
              handleVideoPlayStateChange={handleVideoPlayStateChange}
              commentsText={commentsText}
              handleCommentTextChange={handleCommentTextChange}
              isLiking={isLiking}
            />
          ))
        )}
        <div style={{ marginBottom: "90px" }}></div>
      </div>

      {/* Custom Options Bottom Sheet */}
      <OptionsBottomSheet
        show={showOptions}
        post={optionsPost}
        onClose={closeOptions}
        onDelete={handleDeletePost}
        onCopyLink={handleCopyLink}
        canDelete={optionsPost ? canDeletePost(optionsPost) : false}
      />

      {/* Comments Offcanvas for All Tab */}
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

      {/* Fullscreen modals */}
      <FullscreenVideoModal
        show={!!fullscreenSrc}
        src={fullscreenSrc}
        onClose={() => setFullscreenSrc(null)}
        onFullscreenOpen={handleFullscreenOpen}
      />

      <FullscreenImageModal
        show={!!fullscreenImage}
        src={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
        onFullscreenOpen={handleFullscreenOpen}
      />
    </div>
  );
}