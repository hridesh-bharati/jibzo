import React, { useState, useEffect, useRef, useCallback } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update, remove, push, off } from "firebase/database";
import StatusBubble from "./StatusBubble";
import { useNavigate } from "react-router-dom";
import { Button, Modal } from "react-bootstrap";
import { 
  FaHeart, 
  FaComment, 
  FaTimes, 
  FaPaperPlane, 
  FaEllipsisV,
  FaEye,
  FaShare
} from "react-icons/fa";
import { toast } from "react-toastify";

export default function ViewStatuses() {
  const navigate = useNavigate();
  const [statuses, setStatuses] = useState({});
  const [users, setUsers] = useState({});
  const [viewer, setViewer] = useState(null);
  const [progress, setProgress] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [showActivity, setShowActivity] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hearts, setHearts] = useState([]);
  const [liveData, setLiveData] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  
  const timerRef = useRef(null);
  const videoRef = useRef(null);
  const commentInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const currentUserId = auth.currentUser?.uid;

  // Real-time Users Listener
  useEffect(() => {
    const usersRef = ref(db, "usersData");
    const unsubscribe = onValue(usersRef, (snap) => {
      setUsers(snap.val() || {});
    });
    return () => unsubscribe();
  }, []);

  // Real-time Statuses Listener with Auto-cleanup
  useEffect(() => {
    const statusesRef = ref(db, "statuses");
    setIsLoading(true);

    const unsubscribe = onValue(statusesRef, (snap) => {
      const all = snap.val() || {};
      const now = Date.now();
      const expiryTime = 24 * 60 * 60 * 1000; // 24 hours
      const filtered = {};
      const cleanupPromises = [];

      Object.entries(all).forEach(([uid, userStatuses]) => {
        if (!userStatuses) return;
        
        Object.entries(userStatuses).forEach(([statusId, status]) => {
          if (status && now - status.timestamp <= expiryTime) {
            if (!filtered[uid]) filtered[uid] = {};
            filtered[uid][statusId] = {
              ...status,
              id: statusId,
              timeLeft: Math.max(0, 24 - Math.floor((now - status.timestamp) / (1000 * 60 * 60)))
            };
          } else {
            // Auto-delete expired statuses
            cleanupPromises.push(remove(ref(db, `statuses/${uid}/${statusId}`)));
          }
        });
      });

      setStatuses(filtered);
      setIsLoading(false);
      
      // Cleanup expired statuses
      if (cleanupPromises.length > 0) {
        Promise.all(cleanupPromises).catch(console.error);
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time data for current viewer
  useEffect(() => {
    if (!viewer) return;

    const [currentStatusId] = viewer.stories[viewer.index];
    const statusRef = ref(db, `statuses/${viewer.userId}/${currentStatusId}`);
    
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLiveData(prev => ({
          ...prev,
          [currentStatusId]: {
            ...data,
            timeLeft: Math.max(0, 24 - Math.floor((Date.now() - data.timestamp) / (1000 * 60 * 60)))
          }
        }));
      }
    });

    return () => unsubscribe();
  }, [viewer?.userId, viewer?.index]);

  // Real-time typing indicators
  useEffect(() => {
    if (!viewer || !currentUserId) return;

    const [currentStatusId] = viewer.stories[viewer.index];
    const typingRef = ref(db, `statuses/${viewer.userId}/${currentStatusId}/typing`);
    
    const unsubscribe = onValue(typingRef, (snapshot) => {
      const data = snapshot.val() || {};
      setTypingUsers(data);
    });

    return () => unsubscribe();
  }, [viewer?.userId, viewer?.index, currentUserId]);

  const markAsViewed = useCallback((userId, statusId) => {
    if (!currentUserId || currentUserId === userId) return;
    
    const viewerData = {
      seenAt: Date.now(),
      seenBy: users[currentUserId]?.username || "Anonymous",
      userPic: users[currentUserId]?.photoURL || "/icons/avatar.jpg"
    };
    
    update(ref(db, `statuses/${userId}/${statusId}/viewers/${currentUserId}`), viewerData);
  }, [currentUserId, users]);

  const createHeart = (x, y) => {
    const heart = {
      id: Date.now() + Math.random(),
      x,
      y,
      scale: Math.random() * 0.5 + 0.5
    };
    setHearts(prev => [...prev, heart]);
    setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== heart.id));
    }, 1000);
  };

  const toggleLike = useCallback((userId, statusId, e) => {
    if (!currentUserId) return;
    
    if (e) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      createHeart(x, y);
    }

    const likeRef = ref(db, `statuses/${userId}/${statusId}/likes/${currentUserId}`);
    
    // Check if already liked
    onValue(likeRef, (snapshot) => {
      if (snapshot.exists()) {
        // Unlike
        remove(likeRef);
        toast.info("Like removed");
      } else {
        // Like
        update(likeRef, {
          likedAt: Date.now(),
          likedBy: users[currentUserId]?.username || "Anonymous",
          userPic: users[currentUserId]?.photoURL || "/icons/avatar.jpg"
        });
        toast.success("Liked! ❤️");
      }
    }, { onlyOnce: true });
  }, [currentUserId, users]);

  const handleTyping = useCallback((userId, statusId, isTyping) => {
    if (!currentUserId) return;

    const typingRef = ref(db, `statuses/${userId}/${statusId}/typing/${currentUserId}`);
    
    if (isTyping) {
      update(typingRef, {
        username: users[currentUserId]?.username || "Someone",
        startedAt: Date.now(),
        userPic: users[currentUserId]?.photoURL || "/icons/avatar.jpg"
      });
      
      // Clear typing indicator after 3 seconds
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        remove(typingRef);
      }, 3000);
    } else {
      remove(typingRef);
    }
  }, [currentUserId, users]);

  const addComment = useCallback((userId, statusId) => {
    if (!currentUserId || commentText.trim() === "") return;
    
    // Clear typing indicator
    handleTyping(userId, statusId, false);
    
    const commentRef = ref(db, `statuses/${userId}/${statusId}/comments`);
    push(commentRef, {
      uid: currentUserId,
      text: commentText.trim(),
      timestamp: Date.now(),
      commentedBy: users[currentUserId]?.username || "Anonymous",
      userPic: users[currentUserId]?.photoURL || "/icons/avatar.jpg"
    });
    
    setCommentText("");
    toast.success("Comment posted!");
  }, [currentUserId, commentText, users, handleTyping]);

  const deleteStatus = useCallback((userId, statusId) => {
    if (currentUserId !== userId) {
      toast.error("You can only delete your own statuses.");
      return;
    }
    remove(ref(db, `statuses/${userId}/${statusId}`));
    setViewer(null);
    setShowDeleteConfirm(false);
    toast.success("Status deleted");
  }, [currentUserId]);

  const openViewer = useCallback((userId, stories, index = 0) => {
    const sorted = Object.entries(stories).sort((a, b) => a[1].timestamp - b[1].timestamp);
    setViewer({ userId, stories: sorted, index });
    setProgress(0);
    setShowActivity(false);
    markAsViewed(userId, sorted[index][0]);
  }, [markAsViewed]);

  const closeViewer = useCallback(() => {
    setViewer(null);
    setProgress(0);
    setCommentText("");
    setShowActivity(false);
    setShowDeleteConfirm(false);
    setLiveData({});
    setTypingUsers({});
    
    if (timerRef.current) clearInterval(timerRef.current);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }, []);

  const nextStory = useCallback(() => {
    if (!viewer) return;
    if (viewer.index < viewer.stories.length - 1) {
      const newIndex = viewer.index + 1;
      setViewer({ ...viewer, index: newIndex });
      setProgress(0);
      setShowActivity(false);
      markAsViewed(viewer.userId, viewer.stories[newIndex][0]);
    } else closeViewer();
  }, [viewer, closeViewer, markAsViewed]);

  const prevStory = useCallback(() => {
    if (!viewer) return;
    if (viewer.index > 0) {
      const newIndex = viewer.index - 1;
      setViewer({ ...viewer, index: newIndex });
      setProgress(0);
      setShowActivity(false);
    }
  }, [viewer]);

  // Real-time progress & auto-advance
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
      const handleTimeUpdate = () => {
        if (vid.duration) {
          const pct = (vid.currentTime / vid.duration) * 100;
          setProgress(pct);
        }
      };
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
  }, [viewer?.index, viewer?.stories, nextStory]);

  // Real-time escape key handler
  useEffect(() => {
    const handleEscape = (e) => e.key === "Escape" && closeViewer();
    if (viewer) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    } else {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "auto";
    }
    return () => document.removeEventListener("keydown", handleEscape);
  }, [viewer, closeViewer]);

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

  const handleCommentChange = (e) => {
    setCommentText(e.target.value);
    if (viewer) {
      const [statusId] = viewer.stories[viewer.index];
      handleTyping(viewer.userId, statusId, e.target.value.length > 0);
    }
  };

  const shareStatus = useCallback((userId, statusId) => {
    const statusUrl = `${window.location.origin}/status/${userId}/${statusId}`;
    navigator.clipboard.writeText(statusUrl).then(() => {
      toast.success("Status link copied to clipboard!");
    }).catch(() => {
      toast.error("Failed to copy link");
    });
  }, []);

  if (isLoading) {
    return (
      <div className="status-container">
        <div className="loading-container">
          <div className="spinner-border text-primary mb-3"></div>
          <p>Loading stories...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="status-container">
      {/* Real-time Header */}
      <div className="status-header">
        <div className="header-content">
          <div className="title-section">
            <h1 className="app-title gradient-text">📱 Live Stories</h1>
            <p className="app-subtitle">
              🔄 {Object.keys(statuses).length} active stories • Updates in real-time
            </p>
          </div>
          <div className="header-actions">
            {auth.currentUser && (
              <Button className="add-story-btn glow-effect" onClick={() => navigate("/status/upload")}>
                <span className="btn-icon">+</span> New Story
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Status Strip */}
      <div className="status-strip-container">
        {Object.keys(statuses).length === 0 ? (
          <div className="no-stories">
            <i className="bi bi-camera-video-off display-1 text-muted mb-3"></i>
            <h4>No Active Stories</h4>
            <p>Be the first to share a story!</p>
            {auth.currentUser && (
              <Button className="btn-primary" onClick={() => navigate("/status/upload")}>
                Create First Story
              </Button>
            )}
          </div>
        ) : (
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
                const isOwn = uid === currentUserId;
                const totalViews = Object.values(stories).reduce((sum, story) => 
                  sum + Object.keys(story.viewers || {}).length, 0
                );
                const totalLikes = Object.values(stories).reduce((sum, story) => 
                  sum + Object.keys(story.likes || {}).length, 0
                );
                
                return (
                  <StatusBubble
                    key={uid}
                    user={userData}
                    isSeen={isSeen}
                    isOwn={isOwn}
                    storyCount={Object.keys(stories).length}
                    totalViews={totalViews}
                    totalLikes={totalLikes}
                    onClick={() => openViewer(uid, stories)}
                  />
                );
              })}
          </div>
        )}
      </div>

      {/* Real-time Fullscreen Viewer */}
      {viewer && (() => {
        const [statusId, originalStatus] = viewer.stories[viewer.index];
        const liveStatus = liveData[statusId] || originalStatus;
        const likes = liveStatus.likes || {};
        const comments = liveStatus.comments || {};
        const viewers = liveStatus.viewers || {};
        const isOwner = currentUserId === viewer.userId;

        // Get typing users (excluding current user)
        const typingUserList = Object.values(typingUsers).filter(user => 
          user.username && user.username !== users[currentUserId]?.username
        );

        return (
          <div
            className="story-viewer-overlay"
            onClick={handleTap}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="viewer-background animated-bg"></div>

            <div className="story-viewer">
              {/* Real-time Progress Bars */}
              <div className="story-progress-container">
                {viewer.stories.map((_, i) => (
                  <div key={i} className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: i < viewer.index ? "100%" : i === viewer.index ? `${progress}%` : "0%",
                        background: i === viewer.index ?
                          "linear-gradient(90deg, #ff6b9d, #ff006a, #ff6b9d)" :
                          "rgba(255,255,255,0.6)"
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Real-time Viewer Header */}
              <div className="viewer-header">
                <div className="user-info">
                  <div className="avatar-container">
                    <img
                      src={liveStatus.userPic || users[viewer.userId]?.photoURL || "/icons/avatar.jpg"}
                      className="user-avatar"
                      alt="user"
                    />
                    <div className="online-indicator pulse"></div>
                  </div>
                  <div className="user-details">
                    <span className="username">
                      {liveStatus.userName || users[viewer.userId]?.username || "User"}
                    </span>
                    <span className="timestamp">
                      {new Date(liveStatus.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit"
                      })} • {liveStatus.timeLeft || 24}h left
                    </span>
                    <div className="live-stats">
                      <span className="viewers-count">
                        <FaEye /> {Object.keys(viewers).length}
                      </span>
                      <span className="likes-count">
                        <FaHeart /> {Object.keys(likes).length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="viewer-actions">
                  <button
                    className={`action-btn like-btn ${likes[currentUserId] ? 'liked' : ''}`}
                    onClick={(e) => toggleLike(viewer.userId, statusId, e)}
                  >
                    <FaHeart className="icon" />
                    <span className="count">{Object.keys(likes).length}</span>
                  </button>

                  <button
                    className="action-btn comment-btn"
                    onClick={(e) => { e.stopPropagation(); setShowActivity(!showActivity); }}
                  >
                    <FaComment className="icon" />
                    <span className="count">{Object.keys(comments).length}</span>
                  </button>

                  <button
                    className="action-btn share-btn"
                    onClick={(e) => { e.stopPropagation(); shareStatus(viewer.userId, statusId); }}
                  >
                    <FaShare className="icon" />
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

              {/* Real-time Heart Animations */}
              {hearts.map(heart => (
                <div
                  key={heart.id}
                  className="heart-bubble"
                  style={{
                    left: heart.x,
                    top: heart.y,
                    transform: `scale(${heart.scale})`
                  }}
                >
                  ❤️
                </div>
              ))}

              {/* Real-time Media Content */}
              <div className="media-container">
                {liveStatus.type === "image" ? (
                  <img
                    src={liveStatus.mediaURL}
                    alt="story"
                    className="story-media"
                    loading="lazy"
                  />
                ) : (
                  <video
                    ref={videoRef}
                    src={liveStatus.mediaURL}
                    className="story-media"
                    playsInline
                    controls={false}
                    autoPlay
                    muted
                  />
                )}

                {/* Navigation Arrows */}
                <button className="nav-arrow prev-arrow" onClick={(e) => { e.stopPropagation(); prevStory(); }}>
                  ‹
                </button>
                <button className="nav-arrow next-arrow" onClick={(e) => { e.stopPropagation(); nextStory(); }}>
                  ›
                </button>
              </div>

              {/* Real-time Typing Indicator */}
              {typingUserList.length > 0 && (
                <div className="typing-indicator">
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span className="typing-text">
                    {typingUserList[0].username} is typing...
                  </span>
                </div>
              )}

              {/* Real-time Activity Panel */}
              {showActivity && (
                <div className="activity-panel slide-up" onClick={(e) => e.stopPropagation()}>
                  <div className="panel-header">
                    <h4>📊 Live Activity</h4>
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
                          {Object.entries(likes)
                            .sort((a, b) => b[1].likedAt - a[1].likedAt)
                            .map(([uid, likeData]) => (
                              <div key={uid} className="activity-item">
                                <img
                                  src={likeData.userPic || users[uid]?.photoURL || "/icons/avatar.jpg"}
                                  alt="user"
                                  className="activity-avatar"
                                />
                                <div className="activity-info">
                                  <span className="activity-user">{likeData.likedBy || "User"}</span>
                                  <span className="activity-time">
                                    {new Date(likeData.likedAt).toLocaleTimeString()}
                                  </span>
                                </div>
                              </div>
                            ))}
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
                            .sort((a, b) => b[1].timestamp - a[1].timestamp)
                            .map(([commentId, comment]) => (
                              <div key={commentId} className="comment-item">
                                <img
                                  src={comment.userPic || users[comment.uid]?.photoURL || "/icons/avatar.jpg"}
                                  alt="user"
                                  className="comment-avatar"
                                />
                                <div className="comment-content">
                                  <div className="comment-header">
                                    <span className="comment-user">{comment.commentedBy || "User"}</span>
                                    <span className="comment-time">
                                      {new Date(comment.timestamp).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  <p className="comment-text">{comment.text}</p>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Real-time Comment Input */}
              <div className="comment-input-container" onClick={(e) => e.stopPropagation()}>
                <div className="input-group">
                  <input
                    ref={commentInputRef}
                    type="text"
                    placeholder="💬 Type your comment..."
                    value={commentText}
                    onChange={handleCommentChange}
                    className="comment-input"
                    onKeyPress={(e) => e.key === 'Enter' && addComment(viewer.userId, statusId)}
                  />
                  <button
                    className="send-btn glow-effect"
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
              className="delete-modal fade-modal"
            >
              <Modal.Header closeButton>
                <Modal.Title>🗑️ Delete Story</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <div className="text-center">
                  <i className="bi bi-exclamation-triangle text-warning display-4 mb-3"></i>
                  <p>Are you sure you want to delete this story? This action cannot be undone.</p>
                  <small className="text-muted">This will remove the story for all users immediately.</small>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="outline-secondary" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => deleteStatus(viewer.userId, statusId)}
                  className="glow-effect"
                >
                  Delete Story
                </Button>
              </Modal.Footer>
            </Modal>
          </div>
        );
      })()}
    </div>
  );
}