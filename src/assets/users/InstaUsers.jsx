// src/assets/users/AllUsers.jsx
import React, { useEffect, useState } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update, remove } from "firebase/database";
import { toast } from "react-toastify";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

export default function AllUsers() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [sentRequests, setSentRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [requestedCount, setRequestedCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        const userRef = ref(db, `usersData/${user.uid}`);
        onValue(userRef, (snapshot) => {
          const data = snapshot.val();
          setSentRequests(data?.followRequests?.sent ? Object.keys(data.followRequests.sent) : []);
          setFriends(data?.friends ? Object.keys(data.friends) : []);
          setFollowersCount(data?.followers ? Object.keys(data.followers).length : 0);
          setFollowingCount(data?.following ? Object.keys(data.following).length : 0);
          setRequestedCount(data?.followRequests?.received ? Object.keys(data.followRequests.received).length : 0);
        });
      }
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

  const sendFollowRequest = async (targetUID) => {
    if (!currentUser?.uid) return;
    const updates = {};
    updates[`usersData/${targetUID}/followRequests/received/${currentUser.uid}`] = true;
    updates[`usersData/${currentUser.uid}/followRequests/sent/${targetUID}`] = true;
    await update(ref(db), updates);
    toast.success("Follow request sent! 🚀");
  };

  const cancelFollowRequest = async (targetUID) => {
    if (!currentUser?.uid) return;
    const updates = {};
    updates[`usersData/${targetUID}/followRequests/received/${currentUser.uid}`] = null;
    updates[`usersData/${currentUser.uid}/followRequests/sent/${targetUID}`] = null;
    await update(ref(db), updates);
    toast.info("Request cancelled");
  };

  const unfriendUser = async (targetUID) => {
    if (!currentUser?.uid) return;
    const updates = {};
    updates[`usersData/${currentUser.uid}/friends/${targetUID}`] = null;
    updates[`usersData/${targetUID}/friends/${currentUser.uid}`] = null;
    updates[`usersData/${currentUser.uid}/followers/${targetUID}`] = null;
    updates[`usersData/${targetUID}/followers/${currentUser.uid}`] = null;
    updates[`usersData/${currentUser.uid}/following/${targetUID}`] = null;
    updates[`usersData/${targetUID}/following/${currentUser.uid}`] = null;
    await update(ref(db), updates);
    toast.info("Unfriended");
  };

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

  const filteredUsers = users.filter(
    (u) => u.uid !== currentUser?.uid &&
      (u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
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
            transition: 'all 0.3s ease',
          }}
        >
          <h2
            className="fw-bold mb-0"
            style={{
              textShadow: '0 2px 6px rgba(0,0,0,0.3)',
              marginRight: 'auto',
            }}
          >
            All <span style={{ color: '#ffea00' }}>Jibzo</span> Users
          </h2>

          <div className="text-end">
            <h1 className="h4 fw-bold mb-1" style={{ color: '#ffffffcc' }}>
              Discover People
            </h1>
            <p className="mb-0" style={{ color: '#ffffffaa' }}>
              Connect with Jibzo users worldwide
            </p>
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
          <button
            className="btn flex-fill text-white fw-bold shadow"
            style={{
              background: 'linear-gradient(135deg, #ef5350, #e53935)',
              boxShadow: '0 6px 12px rgba(229, 57, 53, 0.4)',
            }}
            onClick={() => navigate(`/followers/${currentUser?.uid}`)}
          >
            <i className="bi bi-people-fill me-1"></i> Followers: {followersCount}
          </button>

          <button
            className="btn flex-fill text-white fw-bold shadow"
            style={{
              background: 'linear-gradient(135deg, #42a5f5, #1e88e5)',
              boxShadow: '0 6px 12px rgba(30, 136, 229, 0.4)',
            }}
            onClick={() => navigate(`/following/${currentUser?.uid}`)}
          >
            <i className="bi bi-person-check-fill me-1"></i> Following: {followingCount}
          </button>

          <button
            className="btn flex-fill text-white fw-bold shadow"
            style={{
              background: 'linear-gradient(135deg, #ab47bc, #8e24aa)',
              boxShadow: '0 6px 12px rgba(142, 36, 170, 0.4)',
            }}
            onClick={() => navigate(`/requested/${currentUser?.uid}`)}
          >
            <i className="bi bi-hourglass-split me-1"></i> Requested: {requestedCount}
          </button>
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
                {filteredUsers.map((user, index) => (
                  <div
                    key={user.uid}
                    className="list-group-item border-0 p-1 hover-card"
                    style={{
                      borderBottom:
                        index !== filteredUsers.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                    }}
                  >
                    <div
                      className="row align-items-center p-3 m-1 bg-light shadow-sm"
                      style={{
                        borderRadius: '14px',
                        borderLeft: '5px solid #26c6da',
                        transition: 'box-shadow 0.3s',
                      }}
                    >
                      {/* User Info */}
                      <div className="col-md-6 d-flex align-items-center">
                        <img
                          src={user.photoURL || '/icons/avatar.jpg'}
                          alt={user.username}
                          className="rounded-circle me-3 shadow-sm"
                          style={{
                            width: 60,
                            height: 60,
                            objectFit: 'cover',
                            cursor: 'pointer',
                            border: '2px solid #fff',
                            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                          }}
                          onClick={() => navigate(`/user-profile/${user.uid}`)}
                        />
                        <div>
                          <h6
                            className="mb-1 fw-bold cursor-pointer"
                            onClick={() => navigate(`/user-profile/${user.uid}`)}
                          >
                            {user.username || 'Unnamed User'}{' '}
                            {user.uid === currentUser?.uid && (
                              <span className="badge bg-success ms-2">You</span>
                            )}
                            {user.email === ADMIN_EMAIL && (
                              <span className="badge bg-warning text-dark ms-2">Admin</span>
                            )}
                          </h6>
                          <small className="text-muted">{user.email}</small>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="col-md-6 text-end">
                        <div className="d-flex gap-2 justify-content-end flex-wrap">
                          {friends.includes(user.uid) ? (
                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => unfriendUser(user.uid)}
                            >
                              <i className="bi bi-person-dash me-1"></i>Unfriend
                            </button>
                          ) : sentRequests.includes(user.uid) ? (
                            <button
                              className="btn btn-outline-warning btn-sm"
                              onClick={() => cancelFollowRequest(user.uid)}
                            >
                              <i className="bi bi-clock me-1"></i>Pending
                            </button>
                          ) : (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => sendFollowRequest(user.uid)}
                            >
                              <i className="bi bi-person-plus me-1"></i>Add Friend
                            </button>
                          )}

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
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Styles */}
      <style>{`
    .cursor-pointer {
      cursor: pointer;
    }
    .btn {
      border-radius: 25px;
      padding: 0.5rem 1.2rem;
      font-weight: 600;
    }
    .card {
      border-radius: 20px;
    }
  `}</style>
    </div>

  );
}