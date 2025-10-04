// src/components/Blocked.jsx
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUserRelations, useUserActions } from '../../hooks/useUserRelations';
import { auth } from '../utils/firebaseConfig';
import { toast } from 'react-toastify';

export default function Blocked() {
  const { uid: paramUid } = useParams();
  const currentUser = auth.currentUser;
  const uid = paramUid || currentUser?.uid;

  const { relations, loading } = useUserRelations(uid);
  const userActions = useUserActions();

  const handleUnblock = async (targetUID) => {
    try {
      await userActions.unblockUser(targetUID);
      toast.success('User unblocked!');
    } catch (error) {
      console.error('Unblock failed:', error);
      toast.error(`❌ ${error.message || 'Unblock failed'}`);
    }
  };

  if (loading) {
    return (
      <div className="min-vh-100 d-flex justify-content-center align-items-center">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3"></div>
          <p className="text-muted">Loading blocked users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-10 col-xl-8">
          <div className="d-flex justify-content-between align-items-center p-4 bg-white shadow-sm rounded-3 mb-4">
            <div>
              <h4 className="mb-1 text-danger fw-bold">Blocked Users ({relations.blocked?.length || 0})</h4>
              <p className="text-muted mb-0">Users you have blocked</p>
            </div>
            <Link to="/all-insta-users" className="btn btn-primary btn-sm">
              <i className="bi bi-people me-1"></i>Discover Users
            </Link>
          </div>

          {!relations.blocked || relations.blocked.length === 0 ? (
            <div className="text-center py-5 bg-white rounded-3 shadow-sm">
              <i className="bi bi-person-slash display-1 text-muted mb-3"></i>
              <h5 className="text-muted">No blocked users</h5>
              <p className="text-muted mb-3">Users you block will appear here.</p>
              <Link to="/all-insta-users" className="btn btn-primary">Discover Users</Link>
            </div>
          ) : (
            <div className="row g-3">
              {relations.blocked.map((user) => (
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
                            <span className="badge bg-danger mt-1">Blocked</span>
                          </div>
                        </div>

                        <button 
                          className="btn btn-sm btn-outline-success"
                          onClick={() => handleUnblock(user.uid)}
                        >
                          Unblock
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