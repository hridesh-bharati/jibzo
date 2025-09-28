// src/components/UserCard.jsx
import React, { memo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const UserCard = memo(({ 
  user, 
  currentUserId, 
  relations, 
  calculateRelationship,
  onFollow, 
  onUnfollow, 
  onRemove, 
  onAccept, 
  onDecline,
  onBlock, 
  onUnblock,
  onCancelRequest,
  variant = 'default' // 'default', 'requested', 'follower', 'following', 'blocked'
}) => {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  
  const relationship = calculateRelationship(currentUserId, user, relations);
  const { isOwner, isFollowing, isFollower, isFriend, hasSentRequest, hasReceivedRequest, isBlocked } = relationship;

  const handleAction = async (actionName, action, ...args) => {
    if (actionLoading) return;
    setActionLoading(actionName);
    try {
      await action(...args);
    } catch (error) {
      console.error(`${actionName} failed:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUserClick = () => {
    navigate(`/user-profile/${user.uid}`);
  };

  if (!user) return null;

  // Action button configurations for different variants
  const getActionButtons = () => {
    if (isOwner || !currentUserId) return null;

    const baseButtons = [
      // Block/Unblock - always show
      !isBlocked ? {
        key: 'block',
        label: <i className="bi bi-ban"></i>,
        action: () => handleAction('block', onBlock, user.uid),
        variant: 'outline-warning',
        title: 'Block user',
        loading: actionLoading === 'block'
      } : {
        key: 'unblock',
        label: <i className="bi bi-unlock"></i>,
        action: () => handleAction('unblock', onUnblock, user.uid),
        variant: 'outline-success',
        title: 'Unblock user',
        loading: actionLoading === 'unblock'
      }
    ];

    const variantSpecificButtons = {
      requested: [
        {
          key: 'accept',
          label: 'Accept',
          action: () => handleAction('accept', onAccept, user.uid),
          variant: 'success',
          loading: actionLoading === 'accept'
        },
        {
          key: 'decline',
          label: 'Decline',
          action: () => handleAction('decline', onDecline, user.uid),
          variant: 'outline-danger',
          loading: actionLoading === 'decline'
        }
      ],
      follower: [
        {
          key: 'remove',
          label: <i className="bi bi-person-dash"></i>,
          action: () => handleAction('remove', onRemove, user.uid),
          variant: 'outline-danger',
          title: 'Remove follower',
          loading: actionLoading === 'remove'
        }
      ],
      following: [
        {
          key: 'unfollow',
          label: 'Unfollow',
          action: () => handleAction('unfollow', onUnfollow, user.uid),
          variant: 'outline-danger',
          loading: actionLoading === 'unfollow'
        }
      ],
      default: [
        hasSentRequest ? {
          key: 'cancel',
          label: 'Cancel Request',
          action: () => handleAction('cancel', onCancelRequest, user.uid),
          variant: 'secondary',
          loading: actionLoading === 'cancel'
        } : isFriend ? {
          key: 'unfriend',
          label: 'Unfriend',
          action: () => handleAction('unfriend', onUnfollow, user.uid),
          variant: 'danger',
          loading: actionLoading === 'unfriend'
        } : isFollowing ? {
          key: 'unfollow',
          label: 'Unfollow',
          action: () => handleAction('unfollow', onUnfollow, user.uid),
          variant: 'outline-danger',
          loading: actionLoading === 'unfollow'
        } : {
          key: 'follow',
          label: 'Follow',
          action: () => handleAction('follow', onFollow, user.uid),
          variant: 'primary',
          loading: actionLoading === 'follow'
        }
      ]
    };

    return [...baseButtons, ...(variantSpecificButtons[variant] || variantSpecificButtons.default)];
  };

  const actionButtons = getActionButtons();

  return (
    <div className="user-card border p-3 mb-3 rounded shadow-sm bg-white hover-shadow">
      <div className="d-flex align-items-center justify-content-between">
        {/* User Info */}
        <div 
          className="d-flex align-items-center flex-grow-1 user-info-container"
          style={{ cursor: 'pointer', minWidth: 0 }}
          onClick={handleUserClick}
        >
          <div className="position-relative">
            <img
              src={imageError ? "/icons/avatar.jpg" : (user.photoURL || "/icons/avatar.jpg")}
              alt={user.username}
              className="rounded-circle me-3 user-avatar"
              style={{ width: 50, height: 50, objectFit: 'cover' }}
              onError={() => setImageError(true)}
            />
            {user.isOnline && (
              <div 
                className="position-absolute bottom-0 end-0 bg-success rounded-circle border border-2 border-white"
                style={{ width: 12, height: 12 }}
                title="Online"
              />
            )}
          </div>
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <h6 className="mb-1 fw-bold text-truncate">
              {user.username || 'Unnamed User'}
              {user.isVerified && (
                <i className="bi bi-patch-check-fill text-primary ms-1" title="Verified"></i>
              )}
            </h6>
            <p className="text-muted mb-0 small text-truncate">
              {user.bio || 'No bio yet'}
            </p>
            <small className="text-muted">
              Last seen {new Date(user.lastSeen || Date.now()).toLocaleDateString()}
            </small>
          </div>
        </div>

        {/* Action Buttons */}
        {actionButtons && (
          <div className="d-flex gap-2 flex-wrap justify-content-end">
            {actionButtons.map(button => (
              <button
                key={button.key}
                className={`btn btn-${button.variant} btn-sm action-btn`}
                onClick={button.action}
                disabled={button.loading}
                title={button.title}
              >
                {button.loading ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  button.label
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Status Badges */}
      <div className="mt-2 small">
        {isFriend && <span className="badge bg-success me-2">Friends</span>}
        {hasReceivedRequest && <span className="badge bg-warning me-2">Requested to follow you</span>}
        {hasSentRequest && <span className="badge bg-secondary me-2">Request sent</span>}
        {isBlocked && <span className="badge bg-danger">Blocked</span>}
        {isFollowing && !isFriend && <span className="badge bg-info me-2">Following</span>}
        {isFollower && !isFriend && <span className="badge bg-primary me-2">Follows you</span>}
      </div>
    </div>
  );
});

export default UserCard;