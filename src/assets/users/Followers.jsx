// src/assets/users/Followers.jsx
import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useUserRelations, useUserActions } from '../../hooks/useUserRelations';
import { auth } from '../utils/firebaseConfig';
import { toast } from 'react-toastify';
import UserCard from './UserCard';

export default function Followers() {
  const { uid: paramUid } = useParams();
  const currentUser = auth.currentUser;
  const uid = paramUid || currentUser?.uid;
  const navigate = useNavigate();

  const { relations, loading, calculateRelationship } = useUserRelations(uid);
  const userActions = useUserActions();

  const handleAction = async (action, targetUID, successMessage) => {
    try {
      await action(targetUID);
      toast.success(successMessage);
    } catch (error) {
      console.error('Action failed:', error);
      toast.error(`❌ ${error.message}`);
    }
  };

  // Create action handlers with correct prop names that UserCard expects
  const actionHandlers = {
    onFollow: (targetUID) => handleAction(userActions.followUser, targetUID, 'Follow request sent! 🚀'),
    onUnfollow: (targetUID) => handleAction(userActions.unfollowUser, targetUID, 'Unfollowed successfully!'),
    onRemove: (targetUID) => handleAction(userActions.removeFollower, targetUID, 'Follower removed!'),
    onBlock: (targetUID) => handleAction(userActions.blockUser, targetUID, 'User blocked successfully!'),
    onUnblock: (targetUID) => handleAction(userActions.unblockUser, targetUID, 'User unblocked successfully!'),
    onCancelRequest: (targetUID) => handleAction(userActions.cancelFollowRequest, targetUID, 'Request cancelled'),
    onAccept: (targetUID) => handleAction(userActions.acceptRequest, targetUID, 'Request accepted! 🤝'),
    onDecline: (targetUID) => handleAction(userActions.declineRequest, targetUID, 'Request declined')
  };

  // Filter followers to separate friends and non-friends
  const friends = relations.followers.filter(user => {
    const relationship = calculateRelationship(currentUser?.uid, user, relations);
    return relationship.isFriend;
  });

  const nonFriendFollowers = relations.followers.filter(user => {
    const relationship = calculateRelationship(currentUser?.uid, user, relations);
    return !relationship.isFriend;
  });

  if (loading) {
    return (
      <div className="min-vh-100 d-flex justify-content-center align-items-center">
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }}></div>
          <p className="text-muted">Loading followers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-10 col-xl-8">

          {/* <div className="d-flex justify-content-between align-items-center p-4 bg-white shadow-sm rounded-3 mb-4">
            <div>
              <h4 className="mb-1 text-primary fw-bold">Followers</h4>
              <p className="text-muted mb-0">
                {relations.followers.length} people following you • 
                {friends.length} friends • 
                {nonFriendFollowers.length} followers
              </p>
            </div>
            <Link to="/all-insta-users" className="btn btn-primary btn-sm">
              <i className="bi bi-people me-1"></i>Discover More
            </Link>
          </div> */}

          {relations.followers.length === 0 ? (
            <div className="text-center py-5 bg-white rounded-3 shadow-sm">
              <i className="bi bi-people display-1 text-muted mb-3"></i>
              <h5 className="text-muted">No followers yet</h5>
              <p className="text-muted mb-3">When people follow you, they'll appear here.</p>
              <Link to="/all-insta-users" className="btn btn-primary">Find People to Follow</Link>
            </div>
          ) : (
            <div className="row g-3">
              {/* Friends Section */}
              {friends.length > 0 && (
                <div className="col-12">
                  <div className="mb-3">
                    <h6 className="text-success fw-bold">
                      <i className="bi bi-people-fill me-2"></i>
                      Followers ({friends.length})
                    </h6>
                  </div>
                  {friends.map((user) => (
                    <div key={user.uid} className="col-12  rounded-1 shadow-sm border my-2 border-secondary-subtle">
                      <UserCard
                        user={user}
                        currentUserId={currentUser?.uid}
                        relations={relations}
                        calculateRelationship={calculateRelationship}
                        variant="follower"
                        {...actionHandlers}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Non-Friend Followers Section */}
              {nonFriendFollowers.length > 0 && (
                <div className="col-12">
                  <div className="mb-3 mt-4">
                    <h6 className="text-primary fw-bold">
                      <i className="bi bi-person-plus me-2"></i>
                      Followers ({nonFriendFollowers.length})
                    </h6>
                    <p className="text-muted small">People following you - follow back to become friends</p>
                  </div>
                  {nonFriendFollowers.map((user) => (
                    <div key={user.uid} className="col-12">
                      <UserCard
                        user={user}
                        currentUserId={currentUser?.uid}
                        relations={relations}
                        calculateRelationship={calculateRelationship}
                        variant="follower"
                        {...actionHandlers}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}