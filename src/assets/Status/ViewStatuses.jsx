
import React, { useState, useEffect, useRef } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update, remove } from "firebase/database";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "./ViewStatuses.css";
import { FaEye } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
export default function ViewStatuses() {
  const navigate = useNavigate()
  const [statuses, setStatuses] = useState({});
  const [users, setUsers] = useState({});
  const [viewer, setViewer] = useState(null);
  const [seenList, setSeenList] = useState(null);
  const [progress, setProgress] = useState(0);

  const timerRef = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  // Fetch users
  useEffect(() => {
    const usersRef = ref(db, "usersData");
    onValue(usersRef, (snap) => setUsers(snap.val() || {}));
  }, []);

  // Fetch statuses
  useEffect(() => {
    const statusesRef = ref(db, "statuses");
    onValue(statusesRef, (snapshot) => {
      const all = snapshot.val() || {};
      const now = Date.now();
      const filtered = {};

      Object.entries(all).forEach(([uid, userStatuses]) => {
        Object.entries(userStatuses).forEach(([statusId, status]) => {
          if (now - status.timestamp <= 24 * 60 * 60 * 1000) {
            if (!filtered[uid]) filtered[uid] = {};
            filtered[uid][statusId] = status;
          }
        });
      });

      setStatuses(filtered);
    });
  }, []);

  const markAsViewed = (userId, statusId) => {
    const uid = auth.currentUser?.uid;
    if (!uid || uid === userId) return;
    update(ref(db, `statuses/${userId}/${statusId}/viewers/${uid}`), {
      seenAt: Date.now(),
    });
  };

  const deleteStatus = (userId, statusId) => {
    if (auth.currentUser?.uid !== userId) return;
    remove(ref(db, `statuses/${userId}/${statusId}`));
  };

  const openViewer = (userId, stories, index = 0) => {
    const sortedStories = Object.entries(stories).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );
    setViewer({ userId, stories: sortedStories, index });
    markAsViewed(userId, sortedStories[index][0]);
  };

  const closeViewer = () => {
    setViewer(null);
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const nextStory = () => {
    if (!viewer) return;
    if (viewer.index < viewer.stories.length - 1) {
      const newIndex = viewer.index + 1;
      setViewer({ ...viewer, index: newIndex });
      markAsViewed(viewer.userId, viewer.stories[newIndex][0]);
    } else {
      closeViewer();
    }
  };

  const prevStory = () => {
    if (!viewer) return;
    if (viewer.index > 0) {
      const newIndex = viewer.index - 1;
      setViewer({ ...viewer, index: newIndex });
    }
  };

  // Progress bar
  useEffect(() => {
    if (!viewer) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(0);
    const startTime = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const percentage = Math.min((elapsed / 5000) * 100, 100);
      setProgress(percentage);

      if (percentage >= 100) {
        clearInterval(timerRef.current);
        nextStory();
      }
    }, 30);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [viewer?.index]);

  // Touch/swipe
  const handleTouchStart = (e) => {
    touchStartX.current = e.changedTouches[0].screenX;
  };
  const handleTouchEnd = (e) => {
    touchEndX.current = e.changedTouches[0].screenX;
    if (touchStartX.current - touchEndX.current > 50) nextStory();
    else if (touchEndX.current - touchStartX.current > 50) prevStory();
  };

  // Tap
  const handleTap = (e) => {
    if (!viewer) return;
    const screenWidth = window.innerWidth;
    const tapX = e.clientX;
    if (tapX < screenWidth / 2) prevStory();
    else nextStory();
  };

  return (
    <div className="status-container container py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Stories</h3>
        {auth.currentUser && (
          <button
            className="threeD-btn greenBtn"
            onClick={() => navigate("/status/upload")}
          >
            <i class="bi bi-plus-circle-fill"></i> Add Story
          </button>
        )}
      </div>

      {/* Status bubbles */}
      <div className="status-strip">
        {Object.entries(statuses).map(([userId, userStatuses]) => {
          const userInfo = users[userId] || {};
          const firstStatus = Object.values(userStatuses)[0];
          const displayName = userInfo.username || firstStatus.userName || "User";
          const displayPic = userInfo.photoURL || firstStatus.userPic || "icons/avatar.jpg";

          return (
            <div
              key={userId}
              className="status-bubble"
              onClick={() => openViewer(userId, userStatuses)}
            >
              <img src={displayPic} alt="dp" className="status-thumb" />
              <small className="mt-1 d-block text-truncate" style={{ maxWidth: 70 }}>
                {displayName}
              </small>
            </div>
          );
        })}
      </div>

      {/* Full screen viewer */}
      {viewer && (
        <div
          className="viewer-overlay"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={handleTap}
        >
          <div className="viewer-content">
            <div className="progress-bars d-flex">
              {viewer.stories.map((_, i) => (
                <div
                  key={i}
                  className="progress flex-fill mx-1"
                  style={{ height: "3px", background: "#444" }}
                >
                  <div
                    className="progress-bar"
                    style={{
                      width:
                        i < viewer.index
                          ? "100%"
                          : i === viewer.index
                            ? `${progress}%`
                            : "0%",
                      background: "white",
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="viewer-header mt-4">
              <img
                src={users[viewer.userId]?.photoURL || viewer.stories[viewer.index][1].userPic || "icons/avatar.jpg"}
                alt="user"
                className="viewer-avatar me-2"
              />
              <span>{users[viewer.userId]?.username || viewer.stories[viewer.index][1].userName || "User"}</span>

              {auth.currentUser?.uid === viewer.userId && (
                <button
                  className="btn btn-sm btn-danger ms-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    const [statusId] = viewer.stories[viewer.index];
                    deleteStatus(viewer.userId, statusId);
                    closeViewer();
                  }}
                >
                  🗑
                </button>
              )}

              <button
                className="btn btn-sm btn-light ms-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  closeViewer();
                }}
                style={{ zIndex: 1100, position: "relative" }}
              >
                ✕
              </button>
            </div>

            <div className="viewer-body">
              {(() => {
                const [statusId, status] = viewer.stories[viewer.index];
                if (status.type === "image")
                  return <img src={status.mediaURL} alt="story" className="viewer-media" />;
                return (
                  <video
                    src={status.mediaURL}
                    className="viewer-media"
                    autoPlay
                    controls
                    onEnded={nextStory}
                  />
                );
              })()}
            </div>

            {auth.currentUser?.uid === viewer.userId && (
              <div className="seen-btn">
                <button
                  className="btn btn-outline-info btn-sm"
                  data-bs-toggle="offcanvas"
                  data-bs-target="#seenOffcanvas"
                  onClick={(e) => {
                    e.stopPropagation();
                    const [statusId, status] = viewer.stories[viewer.index];
                    setSeenList({ statusId, viewers: status.viewers || {} });
                    setViewer(null);
                  }}
                >
                  <FaEye /> Viewers
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Seen list offcanvas */}
      <div
        className="offcanvas offcanvas-bottom"
        tabIndex="-1"
        id="seenOffcanvas"
        aria-labelledby="seenOffcanvasLabel"
        style={{ zIndex: 999 }}
        data-bs-backdrop="false"
        data-bs-scroll="true"
      >
        <div className="offcanvas-header">
          <h5 id="seenOffcanvasLabel">Seen by</h5>
          <button
            type="button"
            className="btn-close"
            data-bs-dismiss="offcanvas"
            aria-label="Close"
          ></button>
        </div>
        <div className="offcanvas-body">
          {!seenList || !seenList.viewers || Object.keys(seenList.viewers).length === 0 ? (
            <p>No one has seen yet</p>
          ) : (
            Object.entries(seenList.viewers).map(([vid, vdata]) => {
              const viewerInfo = users[vid] || {};
              return (
                <div
                  key={vid}
                  className="viewer-card mb-2 d-flex align-items-center gap-2"
                >
                  <img
                    src={viewerInfo.photoURL || "icons/avatar.jpg"}
                    alt="viewer"
                    style={{ width: 40, height: 40, borderRadius: "50%" }}
                  />
                  <div>
                    <strong>{viewerInfo.username || "User"}</strong>
                    <br />
                    <small>
                      {vdata?.seenAt
                        ? new Date(vdata.seenAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: true,
                        })
                        : ""}
                    </small>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
