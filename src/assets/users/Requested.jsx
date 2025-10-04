// src/assets/users/Requested.jsx
import React, { useEffect, useState } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update, get } from "firebase/database";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function Requested() {
  const [requests, setRequests] = useState([]);
  const [acceptedUsers, setAcceptedUsers] = useState([]);
  const [acceptedUsersData, setAcceptedUsersData] = useState([]);
  const currentUser = auth.currentUser;
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser?.uid) return;

    // Get received requests
    const requestsRef = ref(db, `usersData/${currentUser.uid}/followRequests/received`);
    const unsubRequests = onValue(requestsRef, async (snap) => {
      if (!snap.exists()) {
        setRequests([]);
        return;
      }
      const uids = Object.keys(snap.val());
      const data = await Promise.all(
        uids.map(async (rUid) => {
          const snapUser = await get(ref(db, `usersData/${rUid}`));
          return snapUser.exists() ? { uid: rUid, ...snapUser.val() } : null;
        })
      );
      setRequests(data.filter(Boolean));
    });

    // Get accepted users (people you accepted but haven't followed back yet)
    const followersRef = ref(db, `usersData/${currentUser.uid}/followers`);
    const followingRef = ref(db, `usersData/${currentUser.uid}/following`);
    
    const unsubFollowers = onValue(followersRef, async (snap) => {
      const followers = snap.exists() ? Object.keys(snap.val()) : [];
      
      onValue(followingRef, async (followingSnap) => {
        const following = followingSnap.exists() ? Object.keys(followingSnap.val()) : [];
        
        // Users who are in followers but not in following (accepted but not followed back)
        const notFollowedBack = followers.filter(uid => !following.includes(uid));
        setAcceptedUsers(notFollowedBack);
        
        // Fetch user data for accepted users
        const acceptedUsersData = await Promise.all(
          notFollowedBack.map(async (uid) => {
            const snapUser = await get(ref(db, `usersData/${uid}`));
            return snapUser.exists() ? { uid, ...snapUser.val() } : null;
          })
        );
        setAcceptedUsersData(acceptedUsersData.filter(Boolean));
      });
    });

    return () => {
      unsubRequests();
      unsubFollowers();
    };
  }, [currentUser]);

  // Step 1: Accept request only
  const handleAccept = async (senderId) => {
    try {
      await update(ref(db), {
        // They follow you (one-way)
        [`usersData/${currentUser.uid}/followers/${senderId}`]: true,
        [`usersData/${senderId}/following/${currentUser.uid}`]: true,
        
        // Remove from requests
        [`usersData/${currentUser.uid}/followRequests/received/${senderId}`]: null,
        [`usersData/${senderId}/followRequests/sent/${currentUser.uid}`]: null,
      });
      toast.success("Request accepted! They can now see your posts ✅");
    } catch {
      toast.error("Failed to accept!");
    }
  };

  // Step 2: Follow back after accepting
  const handleFollowBack = async (senderId) => {
    try {
      await update(ref(db), {
        // You follow them back (make it mutual)
        [`usersData/${currentUser.uid}/following/${senderId}`]: true,
        [`usersData/${senderId}/followers/${currentUser.uid}`]: true,
        
        // Add to friends (mutual follow)
        [`usersData/${currentUser.uid}/friends/${senderId}`]: true,
        [`usersData/${senderId}/friends/${currentUser.uid}`]: true,
      });
      toast.success("Followed back! You are now friends 🤝");
    } catch {
      toast.error("Failed to follow back!");
    }
  };

  // Reject request
  const handleReject = async (senderId) => {
    try {
      await update(ref(db), {
        [`usersData/${currentUser.uid}/followRequests/received/${senderId}`]: null,
        [`usersData/${senderId}/followRequests/sent/${currentUser.uid}`]: null,
      });
      toast.info("Request rejected ❌");
    } catch {
      toast.error("Failed to reject!");
    }
  };

  // Block user
  const handleBlock = async (senderId, username) => {
    if (!window.confirm(`Block ${username}? They won't be able to see your profile or send requests.`)) return;
    
    try {
      await update(ref(db), {
        // Add to blocked list
        [`usersData/${currentUser.uid}/blocked/${senderId}`]: true,
        [`usersData/${senderId}/blockedBy/${currentUser.uid}`]: true,
        
        // Remove from requests
        [`usersData/${currentUser.uid}/followRequests/received/${senderId}`]: null,
        [`usersData/${senderId}/followRequests/sent/${currentUser.uid}`]: null,
        
        // Remove any existing connections
        [`usersData/${currentUser.uid}/followers/${senderId}`]: null,
        [`usersData/${senderId}/following/${currentUser.uid}`]: null,
        [`usersData/${currentUser.uid}/following/${senderId}`]: null,
        [`usersData/${senderId}/followers/${currentUser.uid}`]: null,
        [`usersData/${currentUser.uid}/friends/${senderId}`]: null,
        [`usersData/${senderId}/friends/${currentUser.uid}`]: null,
      });
      toast.success("User blocked successfully 🔒");
    } catch {
      toast.error("Failed to block user!");
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-10 col-xl-8">
          
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center p-4 bg-white shadow-sm rounded-3 mb-4">
            <div>
              <h4 className="mb-1 text-warning fw-bold">Follow Requests</h4>
              <p className="text-muted mb-0">Manage your incoming follow requests</p>
            </div>
          </div>

          {/* Pending Requests Section */}
          {requests.length > 0 && (
            <div className="mb-4">
              <h5 className="text-warning mb-3">
                <i className="bi bi-hourglass-split me-2"></i>
                Pending Requests ({requests.length})
              </h5>
              
              <div className="row g-3">
                {requests.map((req) => (
                  <div key={req.uid} className="col-12">
                    <div className="card border-warning border-2 shadow-sm mb-3">
                      <div className="card-body">
                        <div className="d-flex align-items-center justify-content-between">
                          {/* User Info */}
                          <div 
                            className="d-flex align-items-center flex-grow-1"
                            style={{ cursor: "pointer" }}
                            onClick={() => navigate(`/user-profile/${req.uid}`)}
                          >
                            <img
                              src={req.photoURL || "/icons/avatar.jpg"}
                              alt="Profile"
                              className="rounded-circle me-3"
                              style={{ width: 50, height: 50, objectFit: "cover" }}
                            />
                            <div>
                              <h6 className="mb-0 fw-bold">{req.username || "Unnamed User"}</h6>
                              {req.displayName && (
                                <p className="mb-0 text-muted small">{req.displayName}</p>
                              )}
                              <span className="badge bg-warning mt-1">Waiting for your response</span>
                            </div>
                          </div>

                          {/* Action Buttons - Only Accept/Reject for pending requests */}
                          <div className="d-flex gap-2">
                            <button 
                              className="btn btn-sm btn-success"
                              onClick={() => handleAccept(req.uid)}
                              title="Accept their follow request"
                            >
                              <i className="bi bi-check-lg me-1"></i>
                              Accept
                            </button>
                            <button 
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleReject(req.uid)}
                              title="Reject this request"
                            >
                              <i className="bi bi-x-lg me-1"></i>
                              Reject
                            </button>
                            <button 
                              className="btn btn-sm btn-outline-warning"
                              onClick={() => handleBlock(req.uid, req.username || "this user")}
                              title="Block this user"
                            >
                              <i className="bi bi-ban me-1"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accepted Users Section (Need Follow Back) */}
          {acceptedUsersData.length > 0 && (
            <div className="mb-4">
              <h5 className="text-primary mb-3">
                <i className="bi bi-people me-2"></i>
                Follow Back ({acceptedUsersData.length})
              </h5>
              
              <div className="row g-3">
                {acceptedUsersData.map((user) => (
                  <div key={user.uid} className="col-12">
                    <div className="card border-primary border-2 shadow-sm mb-3">
                      <div className="card-body">
                        <div className="d-flex align-items-center justify-content-between">
                          {/* User Info */}
                          <div 
                            className="d-flex align-items-center flex-grow-1"
                            style={{ cursor: "pointer" }}
                            onClick={() => navigate(`/user-profile/${user.uid}`)}
                          >
                            <img
                              src={user.photoURL || "/icons/avatar.jpg"}
                              alt="Profile"
                              className="rounded-circle me-3"
                              style={{ width: 50, height: 50, objectFit: "cover" }}
                            />
                            <div>
                              <h6 className="mb-0 fw-bold">{user.username || "Unnamed User"}</h6>
                              {user.displayName && (
                                <p className="mb-0 text-muted small">{user.displayName}</p>
                              )}
                              <span className="badge bg-primary mt-1">Follows you • Follow back to become friends</span>
                            </div>
                          </div>

                          {/* Follow Back Button */}
                          <div className="d-flex gap-2">
                            <button 
                              className="btn btn-sm btn-primary"
                              onClick={() => handleFollowBack(user.uid)}
                              title="Follow back to become friends"
                            >
                              <i className="bi bi-arrow-left-right me-1"></i>
                              Follow Back
                            </button>
                            <button 
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleBlock(user.uid, user.username || "this user")}
                              title="Block this user"
                            >
                              <i className="bi bi-ban me-1"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Requests Message */}
          {requests.length === 0 && acceptedUsersData.length === 0 && (
            <div className="text-center py-5 bg-white rounded-3 shadow-sm">
              <i className="bi bi-people display-1 text-muted mb-3"></i>
              <h5 className="text-muted">No pending requests</h5>
              <p className="text-muted mb-3">When people send you follow requests, they'll appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}