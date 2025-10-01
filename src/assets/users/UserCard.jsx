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
    onRemove,
    onAccept,
    onDecline,
    onBlock,
    onUnblock,
    onCancelRequest,
    variant = "default", // 'default', 'requested', 'follower', 'following', 'friends', 'blocked'
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
      isBlocked,
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

    // Action button configurations
    const getActionButtons = () => {
      if (isOwner || !currentUserId) return null;

      const baseButtons = [
        !isBlocked
          ? {
            key: "block",
            label: (
              <>
                <i className="bi bi-ban" /> Block
              </>
            ),
            action: () => handleAction("block", onBlock, user.uid),
            variant: "outline-warning",
            title: "Block user",
            loading: actionLoading === "block",
          }
          : {
            key: "unblock",
            label: (
              <>
                <i className="bi bi-unlock" /> Unblock
              </>
            ),
            action: () => handleAction("unblock", onUnblock, user.uid),
            variant: "outline-success",
            title: "Unblock user",
            loading: actionLoading === "unblock",
          },
      ];

      const variantSpecificButtons = {
        requested: [
          {
            key: "accept",
            label: "Accept",
            action: () => handleAction("accept", onAccept, user.uid),
            variant: "success",
            loading: actionLoading === "accept",
          },
          {
            key: "decline",
            label: "Decline",
            action: () => handleAction("decline", onDecline, user.uid),
            variant: "outline-danger",
            loading: actionLoading === "decline",
          },
        ],
        follower: [
          !isFriend && !isFollowing
            ? {
              key: "followBack",
              label: "Follow Back",
              action: () => handleAction("followBack", onFollow, user.uid),
              variant: "primary",
              loading: actionLoading === "followBack",
            }
            : null,
          {
            key: "remove",
            label: (
              <>
                <i className="bi bi-person-dash" /> Remove
              </>
            ),
            action: () => handleAction("remove", onRemove, user.uid),
            variant: "outline-danger",
            title: "Remove follower",
            loading: actionLoading === "remove",
          },
        ].filter(Boolean),
        following: [
          {
            key: "unfollow",
            label: "Unfollow",
            action: () => handleAction("unfollow", onUnfollow, user.uid),
            variant: "outline-danger",
            loading: actionLoading === "unfollow",
          },
        ],
        friends: [
          {
            key: "unfriend",
            label: "Unfriend",
            action: () => handleAction("unfriend", onUnfollow, user.uid),
            variant: "danger",
            loading: actionLoading === "unfriend",
          },
        ],
        blocked: [
          {
            key: "unblock",
            label: (
              <>
                <i className="bi bi-unlock" /> Unblock
              </>
            ),
            action: () => handleAction("unblock", onUnblock, user.uid),
            variant: "outline-success",
            title: "Unblock user",
            loading: actionLoading === "unblock",
          },
        ],
        default: [
          hasSentRequest
            ? {
              key: "cancel",
              label: "Cancel Request",
              action: () => handleAction("cancel", onCancelRequest, user.uid),
              variant: "secondary",
              loading: actionLoading === "cancel",
            }
            : hasReceivedRequest
              ? {
                key: "respond",
                label: "Respond to Request",
                action: () => { },
                variant: "outline-primary",
                loading: false,
                disabled: true,
              }
              : isFriend
                ? {
                  key: "unfriend",
                  label: "Unfriend",
                  action: () => handleAction("unfriend", onUnfollow, user.uid),
                  variant: "danger",
                  loading: actionLoading === "unfriend",
                }
                : isFollowing
                  ? {
                    key: "unfollow",
                    label: "Unfollow",
                    action: () => handleAction("unfollow", onUnfollow, user.uid),
                    variant: "outline-danger",
                    loading: actionLoading === "unfollow",
                  }
                  : {
                    key: "follow",
                    label: "Follow",
                    action: () => handleAction("follow", onFollow, user.uid),
                    variant: "primary",
                    loading: actionLoading === "follow",
                  },
        ],
      };

      return [
        ...baseButtons,
        ...(variantSpecificButtons[variant] || variantSpecificButtons.default),
      ];
    };

    const actionButtons = getActionButtons();

    return (
      <div className="my-2 px-3 py-1">
        <div className="d-flex align-items-center justify-content-between flex-wrap">
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
                className="rounded-circle me-3"
                style={{ width: 50, height: 50, objectFit: "cover" }}
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

            <div className="flex-grow-1">
              <div className="d-flex align-items-center">
                <h6 className="mb-0 fw-bold">
                  {user.username || "Unnamed User"}
                  {user.isVerified && (
                    <i
                      className="bi bi-patch-check-fill text-primary ms-1"
                      title="Verified"
                    />
                  )}
                </h6>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          {actionButtons && (
            <div className="d-flex flex-wrap gap-1 m-2 mb-0 pb-0 w-100">
              {actionButtons.map((button) => (
                <button
                  key={button.key}
                  className={`btn btn-${button.variant} btn-sm`}
                  onClick={(e) => {
                    e.stopPropagation();
                    button.action();
                  }}
                  disabled={button.loading || button.disabled}
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
        <div className="small">
          {isFriend && <span className="badge bg-success me-5 mt-3">Friends</span>}
          {hasReceivedRequest && (
            <span className="badge bg-warning me-5 mt-3">
              Requested to follow you
            </span>
          )}
          {hasSentRequest && (
            <span className="badge bg-secondary me-5 mt-3">Request sent</span>
          )}
          {isBlocked && <span className="badge bg-danger me-5 mt-3">Blocked</span>}
          {isFollowing && !isFriend && (
            <span className="badge bg-info me-5 mt-3">Following</span>
          )}
          {isFollower && !isFriend && (
            <span className="badge bg-primary me-5 mt-3">Follows you</span>
          )}
        </div>
      </div>
    );
  }
);

export default UserCard;
