
// src/assets/users/Blocked.jsx
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUserRelations, useUserActions } from '../../hooks/useUserRelations';
import UserCard from './UserCard';
import { auth } from '../utils/firebaseConfig';

export default function Blocked() {
  const { uid: paramUid } = useParams();
  const currentUser = auth.currentUser;
  const uid = paramUid || currentUser?.uid;
  
  const { relations, calculateRelationship, loading } = useUserRelations(uid);
  const userActions = useUserActions();

  if (loading) return <div className="container mt-3">Loading blocked users...</div>;

  return (
    <div className="container mt-3">
      <div className="d-flex justify-content-between align-items-center p-3 bg-white shadow-sm rounded-3 mb-3">
        <h4 className="mb-0 text-danger">Blocked Users ({relations.blocked.length})</h4>
        <Link to="/all-insta-users" className="btn btn-outline-primary btn-sm">
          View All Users
        </Link>
      </div>

      {relations.blocked.length === 0 ? (
        <p className="text-muted text-center py-4">No blocked users</p>
      ) : (
        relations.blocked.map((blockedUser) => (
          <UserCard
            key={blockedUser.uid}
            user={blockedUser}
            currentUserId={currentUser?.uid}
            relations={relations}
            calculateRelationship={calculateRelationship}
            variant="blocked"
            {...userActions}
          />
        ))
      )}
    </div>
  );
}