// src/components/Followers.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, auth } from '../utils/firebaseConfig';
import { ref, onValue, update } from 'firebase/database';
import { toast } from 'react-toastify';

export default function Followers() {
  const { uid: paramUid } = useParams();
  const currentUser = auth.currentUser;
  const uid = paramUid || currentUser?.uid;
  
  const [followers, setFollowers] = useState([]);
  const [currentUserFollowing, setCurrentUserFollowing] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;

    const userRef = ref(db, `usersData/${uid}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      
      // Get followers (people you've accepted)
      const followersData = data?.followers ? Object.keys(data.followers) : [];
      
      // Get current user's following list to check follow back status
      if (currentUser?.uid) {
        const currentUserRef = ref(db, `usersData/${currentUser.uid}`);
        onValue(currentUserRef, (snapshot) => {
          const currentUserData = snapshot.val();
          setCurrentUserFollowing(currentUserData?.following ? Object.keys(currentUserData.following) : []);
        }, { onlyOnce: true });
      }
      
      // Fetch user details for followers
      fetchUserDetails(followersData).then(followersDetails => {
        setFollowers(followersDetails);
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, [uid, currentUser]);

  const fetchUserDetails = async (uids) => {
    const userPromises = uids.map(uid => 
      new Promise((resolve) => {
        const userRef = ref(db, `usersData/${uid}`);
        onValue(userRef, (snapshot) => {
          const data = snapshot.val();
          resolve({ uid, ...data });
        }, { onlyOnce: true });
      })
    );
    return Promise.all(userPromises);
  };

  // Follow back user (after they accepted your request)
  const followBackUser = async (targetUID) => {
    if (!currentUser?.uid) return;
    
    try {
      const updates = {};
      // Add to current user's following and target user's followers
      updates[`usersData/${currentUser.uid}/following/${targetUID}`] = true;
      updates[`usersData/${targetUID}/followers/${currentUser.uid}`] = true;
      
      // Check if mutual follow to become friends
      const targetUserRef = ref(db, `usersData/${targetUID}`);
      onValue(targetUserRef, (snapshot) => {
        const targetUserData = snapshot.val();
        const targetUserFollowing = targetUserData?.following || {};
        
        if (targetUserFollowing[currentUser.uid]) {
          // Mutual follow - add to friends (both sides)
          updates[`usersData/${currentUser.uid}/friends/${targetUID}`] = true;
          updates[`usersData/${targetUID}/friends/${currentUser.uid}`] = true;
        }
        
        update(ref(db), updates);
      }, { onlyOnce: true });
      
      toast.success('Followed back! ✅');
    } catch (error) {
      console.error('Follow back error:', error);
      toast.error('Failed to follow back');
    }
  };

  // Remove follower
  const removeFollower = async (targetUID) => {
    if (!currentUser?.uid) return;
    
    try {
      const updates = {};
      // Remove from followers/following
      updates[`usersData/${currentUser.uid}/followers/${targetUID}`] = null;
      updates[`usersData/${targetUID}/following/${currentUser.uid}`] = null;
      
      // Remove from friends if exists
      updates[`usersData/${currentUser.uid}/friends/${targetUID}`] = null;
      updates[`usersData/${targetUID}/friends/${currentUser.uid}`] = null;
      
      await update(ref(db), updates);
      toast.info('Follower removed ❌');
    } catch (error) {
      console.error('Remove follower error:', error);
      toast.error('Failed to remove follower');
    }
  };

  // Check if current user is following this follower
  const isFollowingUser = (targetUID) => {
    return currentUserFollowing.includes(targetUID);
  };

  if (loading) {
    return (
      <div className="min-vh-100 d-flex justify-content-center align-items-center">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3"></div>
          <p className="text-muted">Loading followers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-10 col-xl-8">

          {/* Followers Section */}
          <div className="d-flex justify-content-between align-items-center p-4 bg-white shadow-sm rounded-3 mb-4">
            <div>
              <h4 className="mb-1 text-primary fw-bold">Followers ({followers.length})</h4>
              {/* <p className="text-muted mb-0">
                {currentUser?.uid === uid 
                  ? 'People following you - Follow back to become friends' 
                  : 'People following this user'
                }
              </p> */}
            </div>
            <Link to="/all-insta-users" className="btn btn-primary btn-sm">
              <i className="bi bi-people me-1"></i>Discover More
            </Link>
          </div>

          {followers.length === 0 ? (
            <div className="text-center py-5 bg-white rounded-3 shadow-sm">
              <i className="bi bi-people display-1 text-muted mb-3"></i>
              <h5 className="text-muted">No followers yet</h5>
              <p className="text-muted mb-3">When people follow you, they'll appear here.</p>
              <Link to="/all-insta-users" className="btn btn-primary">Find People to Follow</Link>
            </div>
          ) : (
            <div className="row g-3">
              {followers.map((user) => {
                const isFollowing = isFollowingUser(user.uid);
                const isCurrentUserProfile = currentUser?.uid === uid;
                
                return (
                  <div key={user.uid} className="col-12">
                    <div className="card border-0 shadow-sm mb-3">
                      <div className="card-body">
                        <div className="d-flex align-items-center justify-content-between">
                          <div 
                            className="d-flex align-items-center flex-grow-1"
                            style={{ cursor: 'pointer' }}
                            onClick={() => window.location.href = `/user-profile/${user.uid}`}
                          >
                            <img
                              src={user.photoURL || '/icons/avatar.jpg'}
                              alt={user.username}
                              className="rounded-circle me-3"
                              style={{ width: 50, height: 50, objectFit: 'cover' }}
                            />
                            <div>
                              <h6 className="mb-0 fw-bold">{user.username || 'Unnamed User'}</h6>
                              {user.displayName && (
                                <p className="mb-0 text-muted small">{user.displayName}</p>
                              )}
                            </div>
                          </div>

                          <div className="d-flex gap-2 align-items-center small">
                            {isCurrentUserProfile ? (
                              // Current user viewing their own followers
                              isFollowing ? (
                                // Already following back - show Friends + Remove
                                <>
                                  <span className="badge bg-success me-4">Friends</span>
                                  <button 
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => removeFollower(user.uid)}
                                    title="Remove follower"
                                  >
                                    Remove
                                  </button>
                                </>
                              ) : (
                                // Not following back - show Follow Back + Remove
                                <>
                                  <button 
                                    className="btn btn-sm btn-primary"
                                    onClick={() => followBackUser(user.uid)}
                                  >
                                    Follow Back
                                  </button>
                                  <button 
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => removeFollower(user.uid)}
                                    title="Remove follower"
                                  >
                                    Remove
                                  </button>
                                </>
                              )
                            ) : (
                              // Other user viewing someone's followers
                              isFollowing ? (
                                <span className="badge bg-success">Friends</span>
                              ) : currentUser?.uid === user.uid ? (
                                <span className="badge bg-secondary">You</span>
                              ) : (
                                <span className="badge bg-info">Following you</span>
                              )
                            )}
                          </div>
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
  );
}