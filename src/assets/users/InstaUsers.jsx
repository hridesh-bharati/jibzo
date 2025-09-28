// src/assets/users/AllUsers.jsx
import React, { useEffect, useState } from "react";
import { db, auth } from "../utils/firebaseConfig";
import { ref, onValue, remove } from "firebase/database";
import { toast } from "react-toastify";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";

// Import your custom hooks
import { useUserRelations, useUserActions } from "../../hooks/useUserRelations";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

export default function AllUsers() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Use your custom hooks
  const { relations, loading: relationsLoading, calculateRelationship } = useUserRelations(currentUser?.uid);
  const {
    followUser,
    unfollowUser,
    removeFollower,
    acceptRequest,
    blockUser,
    unblockUser,
    cancelFollowRequest
  } = useUserActions();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const usersRef = ref(db, "usersData");
    onValue(usersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const allUsers = Object.entries(data).map(([uid, info]) => ({ uid, ...info }));
      setUsers(allUsers);
      setLoading(false);
    });
  }, []);

  // In AllUsers.jsx, update the getUserRelationship function:
  const getUserRelationship = (targetUser) => {
    if (!currentUser || !targetUser) {
      return {
        isFriend: false,
        isFollowing: false,
        isFollower: false,
        isRequested: false,
        isBlocked: false,
        hasPendingRequest: false,
      };
    }

    const relationship = calculateRelationship(currentUser.uid, targetUser, relations);

    return {
      isFriend: relationship.isFriend,
      isFollowing: relationship.isFollowing,
      isFollower: relationship.isFollower,
      isRequested: relationship.hasReceivedRequest,
      isBlocked: relationship.isBlocked,
      hasPendingRequest: relationship.hasSentRequest,
    };
  };
  // Unified action handler
  const handleAction = async (actionFn, successMessage, targetUID) => {
    try {
      await actionFn(targetUID);
      toast.success(successMessage);
    } catch (error) {
      console.error('Action error:', error);
      toast.error(`❌ ${error.message}`);
    }
  };

  // Action handlers
  const handleFollow = (targetUID) =>
    handleAction(followUser, 'Follow request sent! 🚀', targetUID);

  const handleUnfollow = (targetUID) =>
    handleAction(unfollowUser, 'Unfollowed successfully!', targetUID);

  const handleCancelRequest = (targetUID) =>
    handleAction(cancelFollowRequest, 'Request cancelled', targetUID);

  const handleUnfriend = (targetUID) =>
    handleAction(unfollowUser, 'Unfriended successfully', targetUID);

  const handleBlock = (targetUID) =>
    handleAction(blockUser, 'User blocked successfully!', targetUID);

  const handleUnblock = (targetUID) =>
    handleAction(unblockUser, 'User unblocked successfully!', targetUID);

  const handleRemoveFollower = (targetUID) =>
    handleAction(removeFollower, 'Follower removed!', targetUID);

  const handleAcceptRequest = (targetUID) =>
    handleAction(acceptRequest, 'Request accepted and followed back! 🤝', targetUID);

  const deleteUser = async (targetUID) => {
    if (!currentUser?.uid) return;
    if (currentUser.email !== ADMIN_EMAIL) return toast.error("❌ Only admin can delete users!");
    if (targetUID === currentUser.uid) return toast.error("Cannot delete yourself!");
    if (!window.confirm("Are you sure you want to permanently delete this user?")) return;

    try {
      await remove(ref(db, `usersData/${targetUID}`));
      toast.success("User deleted successfully");
    } catch {
      toast.error("Failed to delete user");
    }
  };

  // Optimized user filtering
  const filteredUsers = users.filter(user =>
    user?.uid !== currentUser?.uid &&
    (user?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user?.displayName?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Render action buttons based on relationship status
  const renderActionButtons = (user) => {
    const userRel = getUserRelationship(user);

    if (userRel.isBlocked) {
      return (
        <button
          className="btn btn-outline-success btn-sm"
          onClick={() => handleUnblock(user.uid)}
        >
          <i className="bi bi-unlock me-1"></i>Unblock
        </button>
      );
    }

    if (userRel.isFriend) {
      return (
        <button
          className="btn btn-outline-danger btn-sm"
          onClick={() => handleUnfriend(user.uid)}
        >
          <i className="bi bi-person-dash me-1"></i>Unfriend
        </button>
      );
    }

    if (userRel.hasPendingRequest) {
      return (
        <button
          className="btn btn-outline-warning btn-sm"
          onClick={() => handleCancelRequest(user.uid)}
        >
          <i className="bi bi-clock me-1"></i>Pending
        </button>
      );
    }

    if (userRel.isRequested) {
      return (
        <div className="d-flex gap-1">
          <button
            className="btn btn-success btn-sm"
            onClick={() => handleAcceptRequest(user.uid)}
          >
            <i className="bi bi-check-lg me-1"></i>Accept
          </button>
          <button
            className="btn btn-outline-danger btn-sm"
            onClick={() => handleRemoveFollower(user.uid)}
          >
            <i className="bi bi-x-lg me-1"></i>Decline
          </button>
        </div>
      );
    }

    if (userRel.isFollowing) {
      return (
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() => handleUnfollow(user.uid)}
        >
          <i className="bi bi-person-dash me-1"></i>Unfollow
        </button>
      );
    }

    return (
      <button
        className="btn btn-primary btn-sm"
        onClick={() => handleFollow(user.uid)}
      >
        <i className="bi bi-person-plus me-1"></i>Add Friend
      </button>
    );
  };

  // Show loading until both users and relations are loaded
  if (loading || relationsLoading) {
    return (
      <div className="min-vh-100 d-flex justify-content-center align-items-center">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }}></div>
          <p className="text-muted">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-vh-100"
      style={{
        background: 'linear-gradient(145deg, #e0f7fa, #e8eaf6)',
        backgroundAttachment: 'fixed',
        backgroundSize: 'cover',
        paddingBottom: '3rem',
      }}
    >
      <div className="container py-4 w-100" style={{ maxWidth: '900px' }}>
        {/* Header */}
        <div
          className="d-flex justify-content-between align-items-center flex-wrap mb-4 p-4 shadow"
          style={{
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #26c6da, #7e57c2)',
            boxShadow: '0 12px 24px rgba(0, 0, 0, 0.2)',
            color: 'white',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <h2 className="fw-bold mb-0" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.3)', marginRight: 'auto' }}>
            All <span style={{ color: '#ffea00' }}>Jibzo</span> Users
          </h2>

          <div className="text-end">
            <h1 className="h4 fw-bold mb-1" style={{ color: '#ffffffcc' }}>Discover People</h1>
            <p className="mb-0" style={{ color: '#ffffffaa' }}>Connect with Jibzo users worldwide</p>
          </div>

          <input
            type="text"
            className="form-control border-0 mt-2 mt-md-0"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              outline: 'none',
              backgroundColor: 'rgba(255,255,255,0.95)',
              color: '#333',
              borderRadius: '12px',
              padding: '0.6rem 1.2rem',
              boxShadow: '0 3px 10px rgba(0,0,0,0.15)',
              minWidth: '250px',
            }}
          />
        </div>

        {/* Stats Cards */}
        <div className="d-flex gap-3 mb-4 flex-wrap">
          {[
            {
              label: 'Followers',
              count: relations.followers?.length || 0,
              color: 'linear-gradient(135deg, #ef5350, #e53935)',
              onClick: () => navigate(`/followers/${currentUser?.uid}`),
              icon: 'bi-people-fill'
            },
            {
              label: 'Following',
              count: relations.following?.length || 0,
              color: 'linear-gradient(135deg, #42a5f5, #1e88e5)',
              onClick: () => navigate(`/following/${currentUser?.uid}`),
              icon: 'bi-person-check-fill'
            },
            {
              label: 'Requested',
              count: relations.requested?.length || 0,
              color: 'linear-gradient(135deg, #ab47bc, #8e24aa)',
              onClick: () => navigate(`/requested/${currentUser?.uid}`),
              icon: 'bi-hourglass-split'
            },
            {
              label: 'Blocked',
              count: relations.blocked?.length || 0,
              color: 'linear-gradient(135deg, #ff9800, #f57c00)',
              onClick: () => navigate(`/blocked/${currentUser?.uid}`),
              icon: 'bi-person-x-fill'
            }
          ].map((stat, index) => (
            <button
              key={index}
              className="btn flex-fill text-white fw-bold shadow"
              style={{ background: stat.color }}
              onClick={stat.onClick}
            >
              <i className={`${stat.icon} me-1`}></i> {stat.label}: {stat.count}
            </button>
          ))}
        </div>

        {/* Users List */}
        <div className="card border-0 p-0 m-0 pb-5">
          <div className="card-body p-0 bg-white rounded-4">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-5">
                <i className="bi bi-people display-1 text-muted"></i>
                <p className="text-muted mt-3">No users found matching your search</p>
              </div>
            ) : (
              <div className="list-group list-group-flush">
                {filteredUsers.map((user, index) => {
                  const userRel = getUserRelationship(user);

                  return (
                    <div
                      key={user.uid}
                      className="list-group-item border-0 p-1 hover-card"
                      style={{
                        borderBottom: index !== filteredUsers.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                      }}
                    >
                      <div
                        className="row align-items-center p-3 m-1 bg-light shadow-sm"
                        style={{
                          borderRadius: '14px',
                          borderLeft: '5px solid #26c6da',
                        }}
                      >
                        {/* User Info */}
                        <div className="col-md-6 d-flex align-items-center">
                          <img
                            src={user.photoURL || '/icons/avatar.jpg'}
                            alt={user.username}
                            className="rounded-circle me-3 shadow-sm cursor-pointer"
                            style={{
                              width: 60,
                              height: 60,
                              objectFit: 'cover',
                              border: '2px solid #fff',
                              boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                            }}
                            onClick={() => navigate(`/user-profile/${user.uid}`)}
                            onError={(e) => {
                              e.target.src = '/icons/avatar.jpg';
                            }}
                          />
                          <div>
                            <h6
                              className="mb-1 fw-bold cursor-pointer"
                              onClick={() => navigate(`/user-profile/${user.uid}`)}
                            >
                              {user.username || user.displayName || 'Unnamed User'}{' '}
                              {user.uid === currentUser?.uid && (
                                <span className="badge bg-success ms-2">You</span>
                              )}
                              {user.email === ADMIN_EMAIL && (
                                <span className="badge bg-warning text-dark ms-2">Admin</span>
                              )}
                              {userRel.isBlocked && (
                                <span className="badge bg-danger ms-2">Blocked</span>
                              )}
                            </h6>
                            <small className="text-muted">{user.email}</small>
                            {user.bio && (
                              <p className="text-muted mb-0 small mt-1">{user.bio}</p>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="col-md-6 text-end">
                          <div className="d-flex gap-2 justify-content-end flex-wrap">
                            {renderActionButtons(user)}

                            {/* Admin delete button */}
                            {currentUser?.email === ADMIN_EMAIL && (
                              <button
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => deleteUser(user.uid)}
                                title="Delete User"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Styles */}
      <style>{`
        .cursor-pointer { cursor: pointer; }
        .btn { border-radius: 25px; padding: 0.5rem 1.2rem; font-weight: 600; }
        .card { border-radius: 20px; }
        .hover-card:hover { transform: translateY(-2px); transition: transform 0.2s ease; }
        .btn-sm { padding: 0.4rem 0.8rem; font-size: 0.875rem; }
      `}</style>
    </div>
  );
}