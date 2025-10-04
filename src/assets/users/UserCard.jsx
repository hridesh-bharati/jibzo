// src/components/UserCard.jsx
import React, { memo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const UserCard = memo(
  ({
    user,
    currentUserId,
    relations,
    calculateRelationship,
    onFollow,
    onUnfollow,
    onCancelRequest,
    variant = "default",
  }) => {
    const navigate = useNavigate();
    const [imageError, setImageError] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);

    const relationship = calculateRelationship(currentUserId, user, relations);
    const {
      isOwner,
      isFollowing,
      isFollower,
      isFriend,
      hasSentRequest,
      hasReceivedRequest,
    } = relationship;

    const handleAction = useCallback(
      async (actionName, action, ...args) => {
        if (actionLoading) return;
        setActionLoading(actionName);
        try {
          await action(...args);
        } catch (error) {
          console.error(`${actionName} failed:`, error);
        } finally {
          setActionLoading(null);
        }
      },
      [actionLoading]
    );

    const handleUserClick = () => {
      navigate(`/user-profile/${user.uid}`);
    };

    if (!user) return null;

    // Get appropriate button based on relationship
    const getActionButton = () => {
      if (isOwner || !currentUserId) return null;

      // Requested variant - user has sent you a follow request
      if (variant === "requested") {
        return (
          <div className="d-flex gap-2">
            <button
              className="btn btn-primary btn-sm px-3 rounded-pill"
              onClick={(e) => {
                e.stopPropagation();
                // This would need an accept function - you might want to add this
                toast.info("Accept functionality would go here");
              }}
              disabled={actionLoading}
            >
              {actionLoading === "accept" ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                "Accept"
              )}
            </button>
            <button
              className="btn btn-outline-secondary btn-sm px-3 rounded-pill"
              onClick={(e) => {
                e.stopPropagation();
                handleAction("decline", onCancelRequest, user.uid);
              }}
              disabled={actionLoading}
            >
              {actionLoading === "decline" ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                "Delete"
              )}
            </button>
          </div>
        );
      }

      // Following variant - you are following this user
      if (variant === "following" || isFollowing) {
        return (
          <button
            className="btn btn-outline-secondary btn-sm px-3 rounded-pill"
            onClick={(e) => {
              e.stopPropagation();
              handleAction("unfollow", onUnfollow, user.uid);
            }}
            disabled={actionLoading === "unfollow"}
          >
            {actionLoading === "unfollow" ? (
              <span className="spinner-border spinner-border-sm" />
            ) : (
              "Following"
            )}
          </button>
        );
      }

      // Friends variant - mutual follow
      if (variant === "friends" || isFriend) {
        return (
          <button
            className="btn btn-outline-secondary btn-sm px-3 rounded-pill"
            onClick={(e) => {
              e.stopPropagation();
              handleAction("unfriend", onUnfollow, user.uid);
            }}
            disabled={actionLoading === "unfriend"}
          >
            {actionLoading === "unfriend" ? (
              <span className="spinner-border spinner-border-sm" />
            ) : (
              "Friends"
            )}
          </button>
        );
      }

      // Has sent request - waiting for approval
      if (hasSentRequest) {
        return (
          <button
            className="btn btn-outline-secondary btn-sm px-3 rounded-pill"
            onClick={(e) => {
              e.stopPropagation();
              handleAction("cancel", onCancelRequest, user.uid);
            }}
            disabled={actionLoading === "cancel"}
          >
            {actionLoading === "cancel" ? (
              <span className="spinner-border spinner-border-sm" />
            ) : (
              "Requested"
            )}
          </button>
        );
      }

      // Default - follow button
      return (
        <button
          className="btn btn-primary btn-sm px-3 rounded-pill"
          onClick={(e) => {
            e.stopPropagation();
            handleAction("follow", onFollow, user.uid);
          }}
          disabled={actionLoading === "follow"}
        >
          {actionLoading === "follow" ? (
            <span className="spinner-border spinner-border-sm" />
          ) : (
            "Follow"
          )}
        </button>
      );
    };

    // Get status text
    const getStatusText = () => {
      if (isFriend) return "Friends";
      if (hasReceivedRequest) return "Requested to follow you";
      if (hasSentRequest) return "Request sent";
      if (isFollowing) return "Following";
      if (isFollower) return "Follows you";
      return null;
    };

    const statusText = getStatusText();

    return (
      <div className="d-flex align-items-center justify-content-between">
        {/* User Info */}
        <div
          className="d-flex align-items-center flex-grow-1"
          onClick={handleUserClick}
          style={{ cursor: "pointer" }}
        >
          <div className="position-relative">
            <img
              src={
                imageError
                  ? "/icons/avatar.jpg"
                  : user.photoURL || "/icons/avatar.jpg"
              }
              alt={user.username}
              className="rounded-circle"
              style={{ 
                width: 56, 
                height: 56, 
                objectFit: "cover",
                border: "2px solid #f8f9fa"
              }}
              onError={() => setImageError(true)}
            />
            {user.isOnline && (
              <div
                className="position-absolute bottom-0 end-0 bg-success rounded-circle border border-2 border-white"
                style={{ width: 14, height: 14 }}
                title="Online"
              />
            )}
          </div>

          <div className="ms-3 flex-grow-1">
            <div className="d-flex align-items-center">
              <h6 className="mb-0 fw-bold text-dark">
                {user.username || user.displayName || "Unnamed User"}
                {user.isVerified && (
                  <i
                    className="bi bi-patch-check-fill text-primary ms-1"
                    title="Verified"
                  />
                )}
              </h6>
            </div>
            
            {/* Display Name */}
            {user.displayName && user.displayName !== user.username && (
              <p className="mb-0 text-muted small">
                {user.displayName}
              </p>
            )}
            
            {/* Status */}
            {statusText && (
              <p className="mb-0 text-muted small">
                {statusText}
              </p>
            )}
            
            {/* Bio (if available) */}
            {user.bio && (
              <p className="mb-0 text-muted small mt-1">
                {user.bio.length > 60 ? `${user.bio.substring(0, 60)}...` : user.bio}
              </p>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="ms-2">
          {getActionButton()}
        </div>
      </div>
    );
  }
);

export default UserCard;