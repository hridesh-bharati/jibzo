// src/components/InstaUser.jsx
import React, { useEffect, useState } from 'react';
import { db, auth } from '../utils/firebaseConfig';
import { ref, onValue, remove, update } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

const InstaUser = () => {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [sentRequests, setSentRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [following, setFollowing] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setCurrentUser(user));
    return () => unsubscribe();
  }, []);

  // Users + relationship data
  useEffect(() => {
    if (!currentUser?.uid) return;

    const userRef = ref(db, `usersData/${currentUser.uid}`);
    const unsubUser = onValue(userRef, (snap) => {
      const data = snap.val();
      setSentRequests(data?.followRequests?.sent ? Object.keys(data.followRequests.sent) : []);
      setFriends(data?.friends ? Object.keys(data.friends) : []);
      setFollowing(data?.following ? Object.keys(data.following) : []);
    });

    const usersRef = ref(db, 'usersData');
    const unsubAll = onValue(
      usersRef,
      (snap) => {
        const data = snap.val() || {};
        const arr = Object.entries(data).map(([uid, u]) => ({
          uid,
          ...u,
          createdAt: u.createdAt || u.timestamp || Date.now(),
        }));
        setUsers(arr);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        toast.error('Failed to load users');
        setLoading(false);
      }
    );

    return () => {
      unsubUser();
      unsubAll();
    };
  }, [currentUser]);

  // --- Actions ---
  const sendFollowRequest = async (targetUID) => {
    if (!currentUser?.uid) return;
    try {
      const updates = {
        [`usersData/${targetUID}/followRequests/received/${currentUser.uid}`]: {
          timestamp: Date.now(),
          status: 'pending',
        },
        [`usersData/${currentUser.uid}/followRequests/sent/${targetUID}`]: {
          timestamp: Date.now(),
          status: 'pending',
        },
      };
      await update(ref(db), updates);
      // toast.success('Follow request sent! 📩');
    } catch (e) {
      console.error(e);
      toast.error('Failed to send request');
    }
  };

  const cancelFollowRequest = async (targetUID) => {
    try {
      const updates = {
        [`usersData/${targetUID}/followRequests/received/${currentUser.uid}`]: null,
        [`usersData/${currentUser.uid}/followRequests/sent/${targetUID}`]: null,
      };
      await update(ref(db), updates);
      // toast.info('Request cancelled ❌');
    } catch (e) {
      console.error(e);
      toast.error('Failed to cancel request');
    }
  };

  const unfollowUser = async (targetUID) => {
    try {
      const updates = {
        [`usersData/${targetUID}/followers/${currentUser.uid}`]: null,
        [`usersData/${currentUser.uid}/following/${targetUID}`]: null,
        [`usersData/${currentUser.uid}/friends/${targetUID}`]: null,
        [`usersData/${targetUID}/friends/${currentUser.uid}`]: null,
      };
      await update(ref(db), updates);
      // toast.info('Unfollowed ❌');
    } catch (e) {
      console.error(e);
      toast.error('Failed to unfollow');
    }
  };

  const unfriendUser = async (targetUID) => {
    try {
      const updates = {
        [`usersData/${currentUser.uid}/friends/${targetUID}`]: null,
        [`usersData/${targetUID}/friends/${currentUser.uid}`]: null,
        [`usersData/${currentUser.uid}/followers/${targetUID}`]: null,
        [`usersData/${targetUID}/followers/${currentUser.uid}`]: null,
        [`usersData/${currentUser.uid}/following/${targetUID}`]: null,
        [`usersData/${targetUID}/following/${currentUser.uid}`]: null,
      };
      await update(ref(db), updates);
      // toast.info('Unfriended ❌');
    } catch (e) {
      console.error(e);
      toast.error('Failed to unfriend');
    }
  };

  const handleDeleteUser = async (targetUID, username = 'User') => {
    if (currentUser?.email !== ADMIN_EMAIL) return toast.error('❌ Only admin can delete users!');
    if (targetUID === currentUser?.uid) return toast.error('❌ Cannot delete yourself!');
    if (!window.confirm(`Delete ${username}? This cannot be undone!`)) return;

    try {
      await remove(ref(db, `usersData/${targetUID}`));
      toast.success('✅ User deleted');
    } catch (e) {
      console.error(e);
      toast.error('❌ Failed to delete user');
    }
  };

  // --- Filtering Logic ---
  const filteredUsers = users.filter((user) => {
    if (user.uid === currentUser?.uid) return false;

    const matchesSearch =
      !searchTerm ||
      user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'following') return following.includes(user.uid);
    if (filterType === 'requested') return sentRequests.includes(user.uid);
    if (filterType === 'followers') return user.followers && user.followers[currentUser.uid];
    return true;
  });

  const getButtonState = (user) => {
    if (friends.includes(user.uid)) return { type: 'friends', text: 'Friends' };
    if (following.includes(user.uid)) return { type: 'following', text: 'Following' };
    if (sentRequests.includes(user.uid)) return { type: 'requested', text: 'Requested' };
    return { type: 'follow', text: 'Follow' };
  };

  if (loading)
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="text-center">
          <div className="spinner-border mb-3"></div>
          <h5>Loading users...</h5>
        </div>
      </div>
    );

  // --- UI ---
  return (
    <div className="container p-0 mb-3" style={{ maxWidth: 600, background: "rgba(238, 252, 255, 1)" }}
    >

      {/* Sticky Header */}
      <div
        className="d-flex flex-column flex-md-row align-items-center justify-content-between m-2 p-2 rounded-4 shadow-sm"
        style={{
          top: '0',
          zIndex: 10,
          background: 'linear-gradient(135deg, #00bfffc4 0%, #9900ff8b 100%)',
          color: 'white',
        }}
      >

        <h1 className="d-flex align-items-start text-start m-0 p-0">
          All <span className="text-warning mx-2 fw-bolder m-0 p-0">Jibzo</span> Users
        </h1>
        <p className="text-center mt-0 pt-0">
          Discover People
        </p>
        {/* Search */}
        <input
          type="text"
          className="form-control mb-2"
          placeholder="🔍 Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {/* Filter Tabs */}
        <div>
          <button
            className={`btn btn-sm threeD-btn blueBtn flex-fill m-1 text-white`}
            onClick={() => setFilterType('following')}
          >
            Following
          </button>
          <button
            className={`btn btn-sm threeD-btn redBtn flex-fill m-1`}
            onClick={() => setFilterType('followers')}
          >
            Followers
          </button>
          <button
            className={`btn btn-sm threeD-btn yellowBtn flex-fill text-white m-1`}
            onClick={() => setFilterType('requested')}
          >
            Requested
          </button>
          <button
            className={`btn btn-sm threeD-btn blueBtn flex-fill m-1`}
            onClick={() => setFilterType('all')}
          >
            All
          </button>
        </div>
      </div>

      {/* Users List */}
      <ul className="list-group mb-5">
        {filteredUsers.map((user) => {
          const btn = getButtonState(user);
          return (
            <li
              key={user.uid}
              className="list-group-item d-flex align-items-center justify-content-between rounded-2 shadow-sm bg-white"
              style={{
                margin: "2px 6px",
                padding: "10px"
              }}

            >
              <div className="bg-light d-flex align-items-center p-2 flex-grow-1"
                style={{
                  borderLeft: '4px solid #0dcaf0',
                  borderRadius: '10px',
                }}
                onClick={() => navigate(`/user-profile/${user.uid}`)}

              >
                {/* User Info */}
                <div className="d-flex align-items-center flex-grow-1" >
                  <img
                    src={user.photoURL || '/icons/avatar.jpg'}
                    alt="avatar"
                    className="rounded-circle border border-3 border-white ms-1 me-3"
                    style={{ width: 50, height: 50, objectFit: 'cover' }}
                  />
                  <div>
                    <span className="fw-bold">{user.username || 'Unnamed User'}</span>
                    {user.displayName && user.displayName !== user.username && (
                      <div className="text-muted small">{user.displayName}</div>
                    )}
                  </div>
                </div>

                {/* Buttons */}
                <div className="d-flex gap-2  align-items-center">
                  {btn.type === 'friends' ? (
                    <button className="btn btn-sm px-4 btn-success" onClick={() => unfriendUser(user.uid)}>
                      {btn.text}
                    </button>
                  ) : btn.type === 'following' ? (
                    <button className="btn btn-sm px-4 btn-outline-secondary" onClick={() => unfollowUser(user.uid)}>
                      {btn.text}
                    </button>
                  ) : btn.type === 'requested' ? (
                    <button className="btn btn-sm px-2 rounded-3 btn-outline-warning" onClick={() => cancelFollowRequest(user.uid)}>
                      {btn.text}
                    </button>
                  ) : (
                    <button className="btn btn-sm px-4 btn-primary" onClick={() => sendFollowRequest(user.uid)}>
                      {btn.text}
                    </button>
                  )}

                  {currentUser?.email === ADMIN_EMAIL && (
                    <button
                      className="btn btn-sm btn-danger m-0 px-1"
                      onClick={() => handleDeleteUser(user.uid, user.username || user.displayName)}
                    >
                      <small>
                        <i className="bi bi-trash3"></i>
                      </small>
                    </button>
                  )}
                </div>

              </div>
            </li>
          );
        })}

        {filteredUsers.length === 0 && <p className="text-center text-muted py-3">No users found</p>}
      </ul>
    </div>
  );
};

export default InstaUser;
