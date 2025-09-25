import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update, remove, push } from "firebase/database";
import StatusBubble from "./StatusBubble";
import { useNavigate } from "react-router-dom";
import { Button, Form, Modal } from "react-bootstrap";
import { FaHeart, FaComment, FaTimes, FaPaperPlane, FaEllipsisV } from "react-icons/fa";
import "./ViewStatuses.css"; // We'll create this CSS file

export default function ViewStatuses() {
  const navigate = useNavigate();
  const [statuses, setStatuses] = useState({});
  const [users, setUsers] = useState({});
  const [viewer, setViewer] = useState(null);
  const [progress, setProgress] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [showActivity, setShowActivity] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const timerRef = useRef(null);
  const videoRef = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const currentUserId = auth.currentUser?.uid;

  // Fetch users
  useEffect(() => {
    const usersRef = ref(db, "usersData");
    return onValue(usersRef, (snap) => setUsers(snap.val() || {}));
  }, []);

  // Fetch statuses
  useEffect(() => {
    const statusesRef = ref(db, "statuses");
    return onValue(statusesRef, (snap) => {
      const all = snap.val() || {};
      const now = Date.now();
      const filtered = {};
      Object.entries(all).forEach(([uid, sts]) => {
        Object.entries(sts).forEach(([id, s]) => {
          if (now - s.timestamp <= 24 * 60 * 60 * 1000) {
            if (!filtered[uid]) filtered[uid] = {};
            filtered[uid][id] = s;
          }
        });
      });
      setStatuses(filtered);
    });
  }, []);

  const markAsViewed = (userId, statusId) => {
    if (!currentUserId || currentUserId === userId) return;
    update(ref(db, `statuses/${userId}/${statusId}/viewers/${currentUserId}`), {
      seenAt: Date.now(),
      seenBy: users[currentUserId]?.username || "Anonymous"
    });
  };

  const toggleLike = (userId, statusId) => {
    if (!currentUserId) return;
    const likeRef = ref(db, `statuses/${userId}/${statusId}/likes/${currentUserId}`);
    onValue(
      likeRef,
      (snap) => {
        if (snap.exists()) {
          remove(likeRef);
        } else {
          update(likeRef, {
            likedAt: Date.now(),
            likedBy: users[currentUserId]?.username || "Anonymous"
          });
        }
      },
      { onlyOnce: true }
    );
  };

  const addComment = (userId, statusId) => {
    if (!currentUserId || commentText.trim() === "") return;
    const commentRef = ref(db, `statuses/${userId}/${statusId}/comments`);
    push(commentRef, {
      uid: currentUserId,
      text: commentText.trim(),
      timestamp: Date.now(),
      commentedBy: users[currentUserId]?.username || "Anonymous",
      userPic: users[currentUserId]?.photoURL || "/icons/avatar.jpg"
    });
    setCommentText("");
  };

  const deleteStatus = (userId, statusId) => {
    // Security check - only allow deletion if current user owns the status
    if (currentUserId !== userId) {
      alert("You can only delete your own statuses.");
      return;
    }
    remove(ref(db, `statuses/${userId}/${statusId}`));
    setViewer(null);
    setShowDeleteConfirm(false);
  };

  const openViewer = (userId, stories, index = 0) => {
    const sorted = Object.entries(stories).sort((a, b) => a[1].timestamp - b[1].timestamp);
    setViewer({ userId, stories: sorted, index });
    setProgress(0);
    setShowActivity(false);
    markAsViewed(userId, sorted[index][0]);
  };

  const closeViewer = () => {
    setViewer(null);
    setProgress(0);
    setCommentText("");
    setShowActivity(false);
    setShowDeleteConfirm(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const nextStory = () => {
    if (!viewer) return;
    if (viewer.index < viewer.stories.length - 1) {
      const newIndex = viewer.index + 1;
      setViewer({ ...viewer, index: newIndex });
      setProgress(0);
      setShowActivity(false);
      markAsViewed(viewer.userId, viewer.stories[newIndex][0]);
    } else closeViewer();
  };

  const prevStory = () => {
    if (!viewer) return;
    if (viewer.index > 0) {
      const newIndex = viewer.index - 1;
      setViewer({ ...viewer, index: newIndex });
      setProgress(0);
      setShowActivity(false);
    }
  };

  // Progress & auto-advance
  useEffect(() => {
    if (!viewer) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const [statusId, status] = viewer.stories[viewer.index];
    if (!status) return;

    if (status.type === "image") {
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min((elapsed / 5000) * 100, 100);
        setProgress(pct);
        if (pct >= 100) nextStory();
      }, 50);
    } else if (status.type === "video" && videoRef.current) {
      const vid = videoRef.current;
      const handleTimeUpdate = () => vid.duration && setProgress((vid.currentTime / vid.duration) * 100);
      const handleEnded = () => nextStory();
      vid.addEventListener("timeupdate", handleTimeUpdate);
      vid.addEventListener("ended", handleEnded);
      vid.play().catch(console.log);
      return () => {
        vid.removeEventListener("timeupdate", handleTimeUpdate);
        vid.removeEventListener("ended", handleEnded);
      };
    }

    return () => timerRef.current && clearInterval(timerRef.current);
  }, [viewer?.index, viewer?.stories]);

  // Escape key to close
  useEffect(() => {
    const handleEscape = (e) => e.key === "Escape" && closeViewer();
    if (viewer) document.addEventListener("keydown", handleEscape);
    else document.removeEventListener("keydown", handleEscape);
    document.body.style.overflow = viewer ? "hidden" : "auto";
    return () => document.removeEventListener("keydown", handleEscape);
  }, [viewer]);

  const handleTouchStart = (e) => (touchStartX.current = e.changedTouches[0].screenX);
  const handleTouchEnd = (e) => {
    touchEndX.current = e.changedTouches[0].screenX;
    const diff = touchStartX.current - touchEndX.current;
    if (diff > 50) nextStory();
    else if (diff < -50) prevStory();
  };

  const handleTap = (e) => {
    if (!viewer) return;
    const screenWidth = window.innerWidth;
    if (e.clientX < screenWidth / 3) prevStory();
    else if (e.clientX > (screenWidth * 2) / 3) nextStory();
  };

  return (
    <div className="status-container">
      {/* Header */}
      <div className="status-header">
        <div className="header-content">
          <h1 className="app-title">What's Happening?</h1>
          {auth.currentUser && (
            <Button className="add-story-btn" onClick={() => navigate("/status/upload")}>
              <span className="btn-icon"> <i className="bi bi-plus-circle"></i> </span> New Story
            </Button>
          )}
        </div>
      </div>

      {/* Status Strip */}
      <div className="status-strip">
        {Object.entries(statuses)
          .sort(([uidA, storiesA], [uidB, storiesB]) => {
            if (!currentUserId) return 0;
            if (uidA === currentUserId) return -1;
            if (uidB === currentUserId) return 1;
            const aSeen = Object.values(storiesA).every((s) => s.viewers?.[currentUserId]);
            const bSeen = Object.values(storiesB).every((s) => s.viewers?.[currentUserId]);
            if (aSeen && !bSeen) return 1;
            if (!aSeen && bSeen) return -1;
            return 0;
          })
          .map(([uid, stories]) => {
            const userData = users[uid] || Object.values(stories)[0];
            const isSeen = Object.values(stories).every((s) => s.viewers?.[currentUserId]);
            return (
              <StatusBubble
                key={uid}
                user={userData}
                isSeen={isSeen}
                onClick={() => openViewer(uid, stories)}
              />
            );
          })}
      </div>

      {/* Fullscreen Viewer */}
      {viewer && (() => {
        const [statusId, status] = viewer.stories[viewer.index];
        const likes = status.likes || {};
        const comments = status.comments || {};
        const isOwner = currentUserId === viewer.userId;

        return (
          <div
            className="story-viewer-overlay"
            onClick={handleTap}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Gradient Background */}
            <div className="viewer-background"></div>

            <div className="story-viewer">
              {/* Progress Bars */}
              <div className="story-progress-container">
                {viewer.stories.map((_, i) => (
                  <div key={i} className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: i < viewer.index ? "100%" : i === viewer.index ? `${progress}%` : "0%",
                        background: i === viewer.index ?
                          "linear-gradient(90deg, #ff6b9d, #ff006a)" :
                          "rgba(255,255,255,0.6)"
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Viewer Header */}
              <div className="viewer-header">
                <div className="user-info">
                  <div className="avatar-container">
                    <img
                      src={status.userPic || users[viewer.userId]?.photoURL || "/icons/avatar.jpg"}
                      className="user-avatar"
                      alt="user"
                    />
                    <div className="online-indicator"></div>
                  </div>
                  <div className="user-details">
                    <span className="username">
                      {status.userName || users[viewer.userId]?.username || "User"}
                    </span>
                    <span className="timestamp">
                      {new Date(status.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                </div>

                <div className="viewer-actions">
               

                  <button
                    className="action-btn comment-btn"
                    onClick={(e) => { e.stopPropagation(); setShowActivity(!showActivity); }}
                  >
                    <FaComment className="icon" />
                    <span className="count">{Object.keys(comments).length}</span>
                  </button>

                  {isOwner && (
                    <button
                      className="action-btn menu-btn"
                      onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
                    >
                      <FaEllipsisV className="icon" />
                    </button>
                  )}

                  <button
                    className="action-btn close-btn"
                    onClick={(e) => { e.stopPropagation(); closeViewer(); }}
                  >
                    <FaTimes className="icon" />
                  </button>
                </div>
              </div>

              {/* Media Content */}
              <div className="media-container">
                {status.type === "image" ? (
                  <img
                    src={status.mediaURL}
                    alt="story"
                    className="story-media"
                    loading="lazy"
                  />
                ) : (
                  <video
                    ref={videoRef}
                    src={status.mediaURL}
                    className="story-media"
                    playsInline
                    controls={false}
                  />
                )}

                {/* Navigation Arrows */}
                {/* <button className="nav-arrow prev-arrow" onClick={(e) => { e.stopPropagation(); prevStory(); }}>
                  ‹
                </button>
                <button className="nav-arrow next-arrow" onClick={(e) => { e.stopPropagation(); nextStory(); }}>
                  ›
                </button> */}
              </div>

              {/* Activity Panel */}
              {showActivity && (
                <div className="activity-panel" onClick={(e) => e.stopPropagation()}>
                  <div className="panel-header">
                    <h4>Activity</h4>
                    <button className="close-panel" onClick={() => setShowActivity(false)}>
                      <FaTimes />
                    </button>
                  </div>

                  <div className="activity-content">
                    <div className="activity-section">
                      <h5>
                        <FaHeart className="section-icon" />
                        Likes ({Object.keys(likes).length})
                      </h5>
                      {Object.keys(likes).length === 0 ? (
                        <p className="no-activity">No likes yet</p>
                      ) : (
                        <div className="likes-list">
                          {Object.entries(likes).map(([uid, likeData]) => {
                            const user = users[uid] || {};
                            return (
                              <div key={uid} className="activity-item">
                                <img
                                  src={user.photoURL || "/icons/avatar.jpg"}
                                  alt="user"
                                  className="activity-avatar"
                                />
                                <div className="activity-info">
                                  <span className="activity-user">{user.username || "User"}</span>
                                  <span className="activity-time">
                                    {new Date(likeData.likedAt).toLocaleTimeString()}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="activity-section">
                      <h5>
                        <FaComment className="section-icon" />
                        Comments ({Object.keys(comments).length})
                      </h5>
                      {Object.keys(comments).length === 0 ? (
                        <p className="no-activity">No comments yet</p>
                      ) : (
                        <div className="comments-list">
                          {Object.entries(comments)
                            .sort((a, b) => a[1].timestamp - b[1].timestamp)
                            .map(([commentId, comment]) => {
                              const user = users[comment.uid] || {};
                              return (
                                <div key={commentId} className="comment-item">
                                  <img
                                    src={comment.userPic || user.photoURL || "/icons/avatar.jpg"}
                                    alt="user"
                                    className="comment-avatar"
                                  />
                                  <div className="comment-content">
                                    <div className="comment-header">
                                      <span className="comment-user">{comment.commentedBy || user.username || "User"}</span>
                                      <span className="comment-time">
                                        {new Date(comment.timestamp).toLocaleTimeString()}
                                      </span>
                                    </div>
                                    <p className="comment-text">{comment.text}</p>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Comment Input */}
              <div className="comment-input-container" onClick={(e) => e.stopPropagation()}>
                   <button
                    className={`action-btn like-btn ${likes[currentUserId] ? 'liked' : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleLike(viewer.userId, statusId); }}
                  >
                    <FaHeart className="icon" />
                    <span className="count">{Object.keys(likes).length}</span>
                  </button>
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="Type your comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="comment-input"
                    onKeyPress={(e) => e.key === 'Enter' && addComment(viewer.userId, statusId)}
                  />
                  <button
                    className="send-btn"
                    onClick={() => addComment(viewer.userId, statusId)}
                    disabled={!commentText.trim()}
                  >
                    <FaPaperPlane className="send-icon" />
                  </button>
                </div>
              </div>
            </div>

            {/* Delete Confirmation Modal */}
            <Modal
              show={showDeleteConfirm}
              onHide={() => setShowDeleteConfirm(false)}
              centered
              className="delete-modal"
            >
              <Modal.Header closeButton>
                <Modal.Title>Delete Story</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                Are you sure you want to delete this story? This action cannot be undone.
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => deleteStatus(viewer.userId, statusId)}
                >
                  Delete
                </Button>
              </Modal.Footer>
            </Modal>
          </div>
        );
      })()}
    </div>
  );
}