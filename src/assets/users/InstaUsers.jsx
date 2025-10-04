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
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Users data and current user data
  useEffect(() => {
    if (!currentUser?.uid) return;

    // Get current user's relationships
    const userRef = ref(db, `usersData/${currentUser.uid}`);
    const userUnsubscribe = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      setSentRequests(data?.followRequests?.sent ? Object.keys(data.followRequests.sent) : []);
      setFriends(data?.friends ? Object.keys(data.friends) : []);
      setFollowing(data?.following ? Object.keys(data.following) : []);
    });

    // Get all users
    const usersRef = ref(db, 'usersData');
    const usersUnsubscribe = onValue(
      usersRef,
      (snapshot) => {
        const data = snapshot.val() || {};
        const usersArray = Object.entries(data).map(([uid, userData]) => ({
          uid,
          ...userData,
          createdAt: userData.createdAt || userData.timestamp || Date.now(),
        }));
        setUsers(usersArray);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching users:', error);
        toast.error('Failed to load users');
        setLoading(false);
      }
    );

    return () => {
      userUnsubscribe();
      usersUnsubscribe();
    };
  }, [currentUser]);

  // Step 1: Always send follow request first (no direct follow)
  const sendFollowRequest = async (targetUID) => {
    if (!currentUser?.uid) return;
    
    try {
      const updates = {};
      // Always send request first
      updates[`usersData/${targetUID}/followRequests/received/${currentUser.uid}`] = {
        timestamp: Date.now(),
        status: 'pending'
      };
      updates[`usersData/${currentUser.uid}/followRequests/sent/${targetUID}`] = {
        timestamp: Date.now(),
        status: 'pending'
      };
      
      await update(ref(db), updates);
      toast.success('Follow request sent! 📩');
    } catch (error) {
      console.error('Follow request error:', error);
      toast.error('Failed to send request');
    }
  };

  // Cancel follow request
  const cancelFollowRequest = async (targetUID) => {
    if (!currentUser?.uid) return;
    
    try {
      const updates = {};
      updates[`usersData/${targetUID}/followRequests/received/${currentUser.uid}`] = null;
      updates[`usersData/${currentUser.uid}/followRequests/sent/${targetUID}`] = null;
      await update(ref(db), updates);
      toast.info('Request cancelled ❌');
    } catch (error) {
      console.error('Cancel request error:', error);
      toast.error('Failed to cancel request');
    }
  };

  // Unfollow user (after they accepted)
  const unfollowUser = async (targetUID) => {
    if (!currentUser?.uid) return;
    
    try {
      const updates = {};
      // Remove from followers/following
      updates[`usersData/${targetUID}/followers/${currentUser.uid}`] = null;
      updates[`usersData/${currentUser.uid}/following/${targetUID}`] = null;
      
      // Remove from friends if mutual
      updates[`usersData/${currentUser.uid}/friends/${targetUID}`] = null;
      updates[`usersData/${targetUID}/friends/${currentUser.uid}`] = null;
      
      await update(ref(db), updates);
      toast.info('Unfollowed ❌');
    } catch (error) {
      console.error('Unfollow error:', error);
      toast.error('Failed to unfollow');
    }
  };

  // Unfriend user (remove mutual follow)
  const unfriendUser = async (targetUID) => {
    if (!currentUser?.uid) return;
    
    try {
      const updates = {};
      // Remove all connections
      updates[`usersData/${currentUser.uid}/friends/${targetUID}`] = null;
      updates[`usersData/${targetUID}/friends/${currentUser.uid}`] = null;
      updates[`usersData/${currentUser.uid}/followers/${targetUID}`] = null;
      updates[`usersData/${targetUID}/followers/${currentUser.uid}`] = null;
      updates[`usersData/${currentUser.uid}/following/${targetUID}`] = null;
      updates[`usersData/${targetUID}/following/${currentUser.uid}`] = null;
      
      await update(ref(db), updates);
      toast.info('Unfriended ❌');
    } catch (error) {
      console.error('Unfriend error:', error);
      toast.error('Failed to unfriend');
    }
  };

  // Admin delete user
  const handleDeleteUser = async (targetUID, username = 'User') => {
    if (!isAdmin) {
      toast.error('❌ Only admin can delete users!');
      return;
    }
    if (targetUID === currentUser?.uid) {
      toast.error('❌ Cannot delete yourself!');
      return;
    }
    if (!window.confirm(`Delete ${username}? This cannot be undone!`)) return;

    try {
      await remove(ref(db, `usersData/${targetUID}`));
      toast.success('✅ User deleted');
    } catch (error) {
      console.error('Delete user error:', error);
      toast.error('❌ Failed to delete user');
    }
  };

  const isAdmin = currentUser?.email === ADMIN_EMAIL;

  // Search filter
  const filteredUsers = users.filter((user) => {
    if (user.uid === currentUser?.uid) return false;
    if (!searchTerm) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      user.username?.toLowerCase().includes(searchLower) ||
      user.displayName?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    );
  });

  // Get button state and text for user
  const getButtonState = (user) => {
    if (friends.includes(user.uid)) {
      return { type: 'friends', text: 'Friends' };
    } else if (following.includes(user.uid)) {
      return { type: 'following', text: 'Following' };
    } else if (sentRequests.includes(user.uid)) {
      return { type: 'requested', text: 'Requested' };
    } else {
      return { type: 'follow', text: 'Follow' };
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="text-center">
          <div className="spinner-border mb-3"></div>
          <h5>Loading users...</h5>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-0 p-0 my-3" style={{ maxWidth: 600 }}>
      <h3 className="m-3 d-flex">
        All <div className="text-danger mx-2">Jibzo</div> Users
      </h3>

      {/* Search */}
      <input
        type="text"
        className="form-control my-3"
        placeholder="Search users..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {/* Users List */}
      <ul className="list-group mb-5">
        {filteredUsers.map((user) => {
          const buttonState = getButtonState(user);
          
          return (
            <li
              key={user.uid}
              className="list-group-item d-flex align-items-center justify-content-between m-0 px-1"
            >
              {/* User Info */}
              <div 
                style={{ cursor: 'pointer' }} 
                onClick={() => navigate(`/user-profile/${user.uid}`)}
                className="d-flex align-items-center flex-grow-1"
              >
                <img
                  src={user.photoURL || '/icons/avatar.jpg'}
                  alt="avatar"
                  className="rounded-circle me-3"
                  style={{ width: 50, height: 50, objectFit: 'cover' }}
                />
                <div>
                  <span className="fw-bold">{user.username || 'Unnamed User'}</span>
                  {user.displayName && user.displayName !== user.username && (
                    <div className="text-muted small">{user.displayName}</div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="d-flex gap-2 align-items-center">
                {buttonState.type === 'friends' ? (
                  <button 
                    className="btn btn-sm btn-success" 
                    onClick={() => unfriendUser(user.uid)}
                  >
                    {buttonState.text}
                  </button>
                ) : buttonState.type === 'following' ? (
                  <button 
                    className="btn btn-sm btn-outline-secondary" 
                    onClick={() => unfollowUser(user.uid)}
                  >
                    {buttonState.text}
                  </button>
                ) : buttonState.type === 'requested' ? (
                  <button 
                    className="btn btn-sm btn-outline-warning" 
                    onClick={() => cancelFollowRequest(user.uid)}
                  >
                    {buttonState.text}
                  </button>
                ) : (
                  <button 
                    className="btn btn-sm btn-primary" 
                    onClick={() => sendFollowRequest(user.uid)}
                  >
                    {buttonState.text}
                  </button>
                )}

                {/* Admin Delete Button */}
                {isAdmin && (
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
            </li>
          );
        })}

        {filteredUsers.length === 0 && (
          <p className="text-center text-muted py-3">No users found</p>
        )}
      </ul>
    </div>
  );
};

export default InstaUser;