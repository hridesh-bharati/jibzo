// src/assets/users/Following.jsx
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUserRelations, useUserActions } from '../../hooks/useUserRelations';
import { auth } from '../utils/firebaseConfig';

export default function Following() {
  const { uid: paramUid } = useParams();
  const currentUser = auth.currentUser;
  const uid = paramUid || currentUser?.uid;

  const { relations, loading } = useUserRelations(uid);
  const userActions = useUserActions();

  if (loading) return <div className="container mt-3">Loading following...</div>;

  return (
    <div className="container mt-3">
      <div className="d-flex justify-content-between align-items-center p-3 bg-white shadow-sm rounded-3 mb-4">
        <h4 className="mb-0 text-primary">Following ({relations.following.length})</h4>
        <Link to="/all-insta-users" className="btn btn-outline-primary btn-sm">
          View All Users
        </Link>
      </div>

      {relations.following.length === 0 ? (
        <p className="text-muted text-center py-5">Not following anyone yet</p>
      ) : (
        <div className="row g-3">
          {relations.following.map((user) => (
            <Link
              to={`/user-profile/${user.uid}`}
              key={user.uid}
              className="text-decoration-none"
            >
              <div className="col-12 col-md-6 col-lg-4">
                <div className="bg-white shadow-sm rounded-4 p-3 d-flex flex-column hover-shadow transition">

                  <div className="row align-items-center">
                    {/* Photo Column */}
                    <div className="col-4 text-center">
                      <div className="position-relative d-inline-block">
                        <img
                          src={user.photoURL || "/icons/avatar.jpg"}
                          alt={user.username}
                          className="rounded-circle border border-2 border-primary"
                          style={{ width: 80, height: 80, objectFit: 'cover' }}
                          onError={(e) => { e.target.src = "/icons/avatar.jpg"; }}
                        />
                        {user.isVerified && (
                          <i
                            className="bi bi-patch-check-fill text-primary position-absolute"
                            style={{ bottom: 0, right: 0, fontSize: '1.2rem', background: 'white', borderRadius: '50%' }}
                            title="Verified"
                          ></i>
                        )}
                      </div>
                    </div>

                    {/* Info & Buttons Column */}
                    <div className="col-8">
                      <h6 className="fw-bold mb-1">{user.username || 'Unnamed User'}</h6>

                      {currentUser && currentUser.uid !== user.uid && (
                        <div className="d-flex gap-2">
                          <button
                            className="btn btn-sm btn-outline-danger flex-grow-1"
                            onClick={(e) => {
                              e.preventDefault(); // Prevent Link navigation on button click
                              userActions.unfollowUser(user.uid);
                            }}
                          >
                            Unfollow
                          </button>
                          <button
                            className="btn btn-sm btn-outline-warning flex-grow-1"
                            onClick={(e) => {
                              e.preventDefault(); // Prevent Link navigation on button click
                              userActions.blockUser(user.uid);
                            }}
                          >
                            Block
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </Link>
          ))}

        </div>
      )}
    </div>
  );
}
