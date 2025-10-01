// src/components/InstaUser.jsx
import React, { useEffect, useState } from 'react';
import { db, auth } from '../utils/firebaseConfig';
import { ref, onValue, remove } from 'firebase/database';
import { onAuthStateChanged } from 'firebase/auth';
import { toast } from 'react-toastify';
import { useUserRelations, useUserActions } from '../../hooks/useUserRelations';
import UserCard from './UserCard';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

const InstaUser = () => {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const { relations, loading: relationsLoading, calculateRelationship } =
    useUserRelations(currentUser?.uid);

  const { followUser, unfollowUser, cancelFollowRequest } = useUserActions();

  const isAdmin = currentUser?.email === ADMIN_EMAIL;

  // Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Users data
  useEffect(() => {
    const usersRef = ref(db, 'usersData');
    const unsubscribe = onValue(
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

    return () => unsubscribe();
  }, []);

  // Admin delete
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

  // Actions
  const handleFollow = async (uid) => {
    try {
      await followUser(uid);
      toast.success('Follow request sent 🚀');
    } catch (err) {
      toast.error(err.message || 'Follow failed');
    }
  };

  const handleUnfollow = async (uid) => {
    try {
      await unfollowUser(uid);
      toast.success('Unfollowed');
    } catch (err) {
      toast.error(err.message || 'Unfollow failed');
    }
  };

  const handleCancelRequest = async (uid) => {
    try {
      await cancelFollowRequest(uid);
      toast.success('Request cancelled');
    } catch (err) {
      toast.error(err.message || 'Cancel failed');
    }
  };

  // Variant
  const getUserVariant = (user) => {
    if (!currentUser) return 'default';
    const relationship = calculateRelationship(currentUser.uid, user, relations);

    if (relationship.hasReceivedRequest) return 'requested';
    if (relationship.isFollowing) return 'following';
    return 'default';
  };

  // Search filter only
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

  if (loading || relationsLoading) {
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
    <div className="container bg-light py-4">
      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          className="form-control rounded-pill"
          placeholder="🔍 Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Users */}
      {filteredUsers.length === 0 ? (
        <div className="text-center text-muted py-5">
          <i className="bi bi-people display-4 mb-3"></i>
          <h5>No users found</h5>
        </div>
      ) : (
        <div className="row g-2 mb-5">
          {filteredUsers.map((user) => (
            <div key={user.uid} className="col-12">
              <div className="position-relative bg-white rounded-3 p-2">
                <UserCard
                  user={user}
                  currentUserId={currentUser?.uid}
                  relations={relations}
                  calculateRelationship={calculateRelationship}
                  onFollow={handleFollow}
                  onUnfollow={handleUnfollow}
                  onCancelRequest={handleCancelRequest}
                  variant={getUserVariant(user)}
                />

                {/* Admin delete */}
                {isAdmin && user.uid !== currentUser?.uid && (
                  <button
                    className="btn btn-danger btn-sm position-absolute top-0 end-0 m-2 mt-5"
                    onClick={() =>
                      handleDeleteUser(user.uid, user.username || user.displayName)
                    }
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InstaUser;
