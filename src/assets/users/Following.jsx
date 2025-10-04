// src/components/Following.jsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, auth } from '../utils/firebaseConfig';
import { ref, onValue, update } from 'firebase/database';
import { toast } from 'react-toastify';

export default function Following() {
  const { uid: paramUid } = useParams();
  const currentUser = auth.currentUser;
  const uid = paramUid || currentUser?.uid;
  
  const [following, setFollowing] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;

    const userRef = ref(db, `usersData/${uid}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      
      // Get following (people you follow and they've accepted)
      const followingData = data?.following ? Object.keys(data.following) : [];
      
      // Get sent follow requests (pending approval)
      const requestsData = data?.followRequests?.sent ? Object.keys(data.followRequests.sent) : [];
      
      // Fetch user details
      Promise.all([
        fetchUserDetails(followingData),
        fetchUserDetails(requestsData)
      ]).then(([followingDetails, requestsDetails]) => {
        setFollowing(followingDetails);
        setSentRequests(requestsDetails);
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, [uid]);

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

  // Unfollow user
  const unfollowUser = async (targetUID) => {
    if (!currentUser?.uid) return;
    
    try {
      const updates = {};
      updates[`usersData/${targetUID}/followers/${currentUser.uid}`] = null;
      updates[`usersData/${currentUser.uid}/following/${targetUID}`] = null;
      updates[`usersData/${currentUser.uid}/friends/${targetUID}`] = null;
      updates[`usersData/${targetUID}/friends/${currentUser.uid}`] = null;
      await update(ref(db), updates);
      toast.info('Unfollowed ❌');
    } catch (error) {
      console.error('Unfollow error:', error);
      toast.error('Failed to unfollow');
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

  if (loading) {
    return (
      <div className="min-vh-100 d-flex justify-content-center align-items-center">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3"></div>
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-10 col-xl-8">

          {/* Pending Requests Section */}
          {sentRequests.length > 0 && (
            <div className="mb-4">
              <div className="d-flex justify-content-between align-items-center p-4 bg-white shadow-sm rounded-3 mb-3">
                <div>
                  <h4 className="mb-1 text-warning fw-bold">Pending Requests ({sentRequests.length})</h4>
                  <p className="text-muted mb-0">Waiting for approval</p>
                </div>
              </div>

              <div className="row g-3">
                {sentRequests.map((user) => (
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
                              <span className="badge bg-warning mt-1">Requested</span>
                            </div>
                          </div>

                          <button 
                            className="btn btn-sm btn-outline-warning"
                            onClick={() => cancelFollowRequest(user.uid)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Following Section */}
          <div className="d-flex justify-content-between align-items-center p-4 bg-white shadow-sm rounded-3 mb-4">
            <div>
              <h4 className="mb-1 text-primary fw-bold">Following ({following.length})</h4>
              <p className="text-muted mb-0">People you follow</p>
            </div>
            <Link to="/all-insta-users" className="btn btn-primary btn-sm">
              <i className="bi bi-people me-1"></i>Discover More
            </Link>
          </div>

          {following.length === 0 ? (
            <div className="text-center py-5 bg-white rounded-3 shadow-sm">
              <i className="bi bi-person display-1 text-muted mb-3"></i>
              <h5 className="text-muted">Not following anyone yet</h5>
              <p className="text-muted mb-3">When you follow people, they'll appear here.</p>
              <Link to="/all-insta-users" className="btn btn-primary">Find People to Follow</Link>
            </div>
          ) : (
            <div className="row g-3">
              {following.map((user) => (
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

                        <button 
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => unfollowUser(user.uid)}
                        >
                          Following
                        </button>
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
  );
}