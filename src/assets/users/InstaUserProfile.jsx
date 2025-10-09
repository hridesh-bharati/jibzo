// src/assets/users/InstaUserProfile.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { db, auth } from "../utils/firebaseConfig";
import { ref, onValue, update } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useUserRelations, useUserActions } from "../../hooks/useUserRelations";
import GetPost from "../uploads/GetPost";
import { toast } from "react-toastify";

// Reusable Components
const ProfileSkeleton = () => (
  <div className="container mx-auto p-0" style={{ maxWidth: "900px" }}>
    <div className="w-100 bg-secondary rounded-top" style={{ height: "200px" }}></div>
    <div className="position-relative">
      <div className="position-absolute" style={{ bottom: "-60px", left: "20px" }}>
        <div className="rounded-circle bg-light border border-4 border-white" 
          style={{ width: "120px", height: "120px" }}></div>
      </div>
    </div>
    <div className="mt-5 ms-3">
      <div className="skeleton-line" style={{ width: "200px", height: "24px", marginBottom: "10px" }}></div>
      <div className="skeleton-line" style={{ width: "150px", height: "16px" }}></div>
      <div className="d-flex gap-2 m-3 flex-wrap">
        {[1, 2, 3].map(item => (
          <div key={item} className="skeleton-line" 
            style={{ width: "100px", height: "32px", borderRadius: "20px" }}></div>
        ))}
      </div>
    </div>
  </div>
);

const ProfileError = ({ message, onRetry }) => (
  <div className="container text-center mt-5 py-5">
    <div className="bg-white rounded-4 shadow-sm p-5">
      <i className="bi bi-emoji-frown display-1 text-warning mb-3"></i>
      <h3 className="fw-bold text-dark mb-3">Oops! Something went wrong</h3>
      <p className="text-muted mb-4">{message}</p>
      {onRetry && (
        <button className="btn btn-primary btn-lg px-4" onClick={onRetry}>
          <i className="bi bi-arrow-clockwise me-2"></i>Try Again
        </button>
      )}
    </div>
  </div>
);

const BlockedProfile = ({ type, onUnblock, userId, username }) => (
  <div className="container text-center mt-5 py-5">
    <div className="bg-white rounded-4 shadow-sm p-5">
      <i className={`bi bi-person-slash display-1 ${type === 'blockedBy' ? 'text-danger' : 'text-warning'} mb-3`}></i>
      <h3 className="fw-bold text-dark mb-3">
        {type === 'blockedBy' ? 'Profile Unavailable' : 'Profile Blocked'}
      </h3>
      <p className="text-muted mb-4">
        {type === 'blockedBy' 
          ? `You can't view ${username || 'this user'}'s profile because they blocked you.` 
          : `You blocked ${username || 'this user'}. Unblock to view their profile.`}
      </p>
      {type === 'blocked' && onUnblock && (
        <button className="btn btn-success btn-lg px-4" onClick={() => onUnblock(userId)}>
          <i className="bi bi-unlock me-2"></i>Unblock User
        </button>
      )}
    </div>
  </div>
);

const LockedProfile = ({ username, onFollow, userPhoto }) => (
  <div className="d-flex flex-column align-items-center justify-content-center py-5" style={{ minHeight: "60vh" }}>
    <div className="text-center bg-white rounded-4 shadow-sm p-5" style={{ maxWidth: "400px" }}>
      <img
        src={userPhoto || "/icons/avatar.jpg"}
        alt={username}
        className="rounded-circle mb-4 border border-4 border-light shadow"
        width="100"
        height="100"
        style={{ objectFit: "cover" }}
      />
      <i className="bi bi-lock-fill display-4 text-secondary mb-3"></i>
      <h3 className="fw-bold text-dark mb-3">This Account is Private</h3>
      <p className="text-muted mb-4">Follow {username} to see their photos and videos.</p>
      <button className="btn btn-primary btn-lg w-100 py-2" onClick={onFollow}>
        <i className="bi bi-person-plus me-2"></i>Follow
      </button>
    </div>
  </div>
);

// Reusable Button Component
const ActionButton = ({ 
  children, 
  variant = "primary", 
  onClick, 
  disabled = false, 
  loading = false,
  icon,
  ...props 
}) => (
  <button
    className={`btn btn-sm ${variant.includes('outline-') ? variant : `btn-${variant}`} d-flex align-items-center gap-1`}
    onClick={onClick}
    disabled={disabled || loading}
    {...props}
  >
    {loading ? (
      <div className="spinner-border spinner-border-sm" role="status"></div>
    ) : (
      icon && <i className={icon}></i>
    )}
    {children}
  </button>
);

// Profile Header Component
const ProfileHeader = ({ userData, currentUser, relationship, userActions, uid, isUpdating }) => {
  const navigate = useNavigate();
  const { isFriend, isFollowing, hasReceivedRequest, hasSentRequest, isBlocked, isFollower } = relationship;

  const handleAction = useCallback(async (action) => {
    if (isUpdating) return;
    try {
      await action(uid);
    } catch (error) {
      toast.error("Action failed. Please try again.");
    }
  }, [uid, isUpdating]);

  const renderActionButtons = () => {
    if (currentUser?.uid === uid) {
      return (
        <ActionButton variant="outline-primary" icon="bi bi-pencil-square me-1" as={Link} to="/admin-profile">
          Edit Profile
        </ActionButton>
      );
    }

    const actionConfigs = {
      friend: {
        condition: isFriend,
        buttons: [
          { 
            variant: "outline-secondary", 
            icon: "bi bi-person-check me-1", 
            text: "Friends", 
            action: userActions.unfollowUser 
          },
          { 
            variant: "outline-primary", 
            icon: "bi bi-chat me-1", 
            text: "Message", 
            onClick: () => navigate(`/messages/${uid}`) 
          }
        ]
      },
      following: {
        condition: isFollowing,
        buttons: [
          { 
            variant: "outline-secondary", 
            icon: "bi bi-person-check me-1", 
            text: "Following", 
            action: userActions.unfollowUser 
          },
          ...(isFollower ? [{
            variant: "primary", 
            icon: "bi bi-arrow-left-right me-1", 
            text: "Follow Back", 
            action: userActions.followBack 
          }] : [])
        ]
      },
      follower: {
        condition: isFollower && !isFollowing,
        buttons: [
          { 
            variant: "primary", 
            icon: "bi bi-person-plus me-1", 
            text: "Follow Back", 
            action: userActions.followBack 
          },
          { 
            variant: "outline-primary", 
            icon: "bi bi-chat me-1", 
            text: "Message", 
            onClick: () => navigate(`/messages/${uid}`) 
          }
        ]
      },
      receivedRequest: {
        condition: hasReceivedRequest,
        buttons: [
          { 
            variant: "primary", 
            icon: "bi bi-check-lg me-1", 
            text: "Accept", 
            action: userActions.acceptRequest 
          },
          { 
            variant: "outline-secondary", 
            text: "Decline", 
            action: userActions.declineRequest 
          }
        ]
      },
      sentRequest: {
        condition: hasSentRequest,
        buttons: [
          { 
            variant: "outline-secondary", 
            icon: "bi bi-clock me-1", 
            text: "Requested", 
            action: userActions.cancelFollowRequest 
          }
        ]
      },
      default: {
        condition: true,
        buttons: [
          { 
            variant: "primary", 
            icon: "bi bi-person-plus me-1", 
            text: "Follow", 
            action: userActions.followUser 
          },
          { 
            variant: "outline-primary", 
            icon: "bi bi-chat me-1", 
            text: "Message", 
            onClick: () => navigate(`/messages/${uid}`) 
          }
        ]
      }
    };

    const config = Object.values(actionConfigs).find(config => config.condition);
    return config.buttons.map((button, index) => (
      <ActionButton
        key={index}
        variant={button.variant}
        icon={button.icon}
        onClick={button.action ? () => handleAction(button.action) : button.onClick}
        loading={isUpdating}
        disabled={isUpdating}
      >
        {button.text}
      </ActionButton>
    ));
  };

  return (
    <div className="container mx-auto p-0" style={{ maxWidth: "900px" }}>
      {/* Wallpaper & Profile */}
      <div className="w-100 rounded-top position-relative">
        <div
          className="w-100"
          style={{
            backgroundImage: `url(${userData.wallpaper || "/default-wallpaper.jpg"})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            height: "200px",
            backgroundColor: userData.wallpaper ? "transparent" : "#f8f9fa"
          }}
        >
          {!userData.wallpaper && (
            <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted">
              <i className="bi bi-image display-4 opacity-50"></i>
            </div>
          )}
        </div>

        {/* Profile Picture Overlay */}
        <div className="position-absolute d-flex align-items-center justify-content-start w-100 px-3" style={{ bottom: "-60px" }}>
          <img
            src={userData.photoURL || "/icons/avatar.jpg"}
            alt="Profile"
            className="rounded-circle shadow-lg border border-4 border-white bg-white"
            width={120}
            height={120}
            style={{ objectFit: "cover", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}
            onError={(e) => { e.target.src = "/icons/avatar.jpg"; }}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="d-flex gap-2 justify-content-end me-3 mb-3 flex-wrap">
        {renderActionButtons()}
        
        {/* Block/Unblock Actions */}
        {currentUser?.uid !== uid && (
          !isBlocked ? (
            <ActionButton
              variant="outline-danger"
              icon="bi bi-slash-circle me-1"
              onClick={() => handleAction(userActions.blockUser)}
              loading={isUpdating}
              disabled={isUpdating}
            >
              Block
            </ActionButton>
          ) : (
            <ActionButton
              variant="outline-success"
              icon="bi bi-unlock me-1"
              onClick={() => handleAction(userActions.unblockUser)}
              loading={isUpdating}
              disabled={isUpdating}
            >
              Unblock
            </ActionButton>
          )
        )}
      </div>

      {/* User Info */}
      <div className="ms-3 mb-3 mt-4">
        <div className="d-flex align-items-center gap-2 mb-2">
          <h4 className="fw-bold text-dark mb-0">{userData.username || "Instagram User"}</h4>
          {userData.isLocked && <i className="bi bi-lock-fill text-secondary" title="Private Account"></i>}
        </div>
        
        {userData.displayName && userData.displayName !== userData.username && (
          <p className="text-dark fw-medium mb-2">{userData.displayName}</p>
        )}
        
        {userData.bio && <p className="text-muted mb-2">{userData.bio}</p>}
        
        {currentUser?.uid !== uid && userData.email && (
          <p className="text-muted small">
            <i className="bi bi-envelope me-1"></i>
            {userData.email}
          </p>
        )}
      </div>
    </div>
  );
};

// Profile Stats Component
const ProfileStats = ({ userData, currentUser, currentUserRelations, uid }) => {
  const stats = useMemo(() => {
    const baseStats = [
      {
        label: "Posts",
        count: userData.postsCount || 0,
        path: `/user-profile/${uid}`,
        icon: "bi-grid-3x3"
      },
      {
        label: "Followers",
        count: userData.followers ? Object.keys(userData.followers).length : 0,
        path: `/followers/${uid}`,
        icon: "bi-people"
      },
      {
        label: "Following",
        count: userData.following ? Object.keys(userData.following).length : 0,
        path: `/following/${uid}`,
        icon: "bi-person-check"
      }
    ];

    if (currentUser?.uid === uid) {
      baseStats.push({
        label: "Requests",
        count: currentUserRelations.requested?.length || 0,
        path: `/requested/${uid}`,
        icon: "bi-hourglass-split",
        showBadge: currentUserRelations.requested?.length > 0
      });
    }

    return baseStats;
  }, [userData, currentUser, currentUserRelations, uid]);

  return (
    <div className="d-flex justify-content-around border-top border-bottom py-3 mx-3">
      {stats.map((stat, index) => (
        <Link key={index} to={stat.path} className="text-decoration-none text-center position-relative">
          <div className="fw-bold fs-5 text-dark">{stat.count}</div>
          <div className="text-muted small">{stat.label}</div>
          {stat.showBadge && (
            <span className="position-absolute translate-middle badge rounded-pill bg-danger" 
              style={{ top: "-5px", right: "-5px" }}>
              {stat.count}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
};

// Chat Button Component
const ChatButton = ({ username, uid }) => {
  const navigate = useNavigate();
  
  return (
    <div className="m-3">
      <button
        className="btn w-100"
        style={{
          background: 'linear-gradient(135deg, #26c6da, #7e57c2)',
          color: 'white',
          border: 'none',
          borderRadius: '25px',
          padding: '0.75rem 1.5rem',
          fontWeight: '600'
        }}
        onClick={() => navigate(`/messages/${uid}`)}
      >
        <i className="bi bi-chat-dots me-2"></i>
        Chat with {username}
      </button>
    </div>
  );
};

// Main Component
export default function InstaUserProfile() {
  const { uid } = useParams();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const navigate = useNavigate();

  // Custom hooks
  const { relations: currentUserRelations, calculateRelationship } = useUserRelations(currentUser?.uid);
  const userActions = useUserActions();

  // Enhanced user actions with follow back functionality
  const enhancedUserActions = useMemo(() => {
    const wrapWithLoading = (action) => async (...args) => {
      setIsUpdating(true);
      try {
        await action(...args);
      } finally {
        setIsUpdating(false);
      }
    };

    const followBack = async (targetUID) => {
      if (!currentUser?.uid) return;
      
      const updates = {
        [`usersData/${currentUser.uid}/following/${targetUID}`]: { timestamp: Date.now() },
        [`usersData/${targetUID}/followers/${currentUser.uid}`]: { timestamp: Date.now() },
        [`usersData/${currentUser.uid}/friends/${targetUID}`]: { timestamp: Date.now() },
        [`usersData/${targetUID}/friends/${currentUser.uid}`]: { timestamp: Date.now() },
        [`usersData/${currentUser.uid}/followRequests/received/${targetUID}`]: null,
        [`usersData/${targetUID}/followRequests/sent/${currentUser.uid}`]: null,
      };

      await update(ref(db), updates);
    };

    return {
      followUser: wrapWithLoading(userActions.followUser),
      unfollowUser: wrapWithLoading(userActions.unfollowUser),
      acceptRequest: wrapWithLoading(userActions.acceptRequest),
      declineRequest: wrapWithLoading(userActions.declineRequest),
      cancelFollowRequest: wrapWithLoading(userActions.cancelFollowRequest),
      blockUser: wrapWithLoading(userActions.blockUser),
      unblockUser: wrapWithLoading(userActions.unblockUser),
      followBack: wrapWithLoading(followBack),
    };
  }, [userActions, currentUser]);

  // Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, 
      (user) => setCurrentUser(user),
      (authError) => {
        console.error("Auth error:", authError);
        setError("Authentication error occurred");
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch profile user data
  useEffect(() => {
    if (!uid) {
      setError("User ID is required");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const userRef = ref(db, `usersData/${uid}`);
    const unsubscribe = onValue(userRef, 
      (snapshot) => {
        snapshot.exists() ? setUserData(snapshot.val()) : setError("User not found");
        setLoading(false);
      }, 
      (dbError) => {
        console.error("Database error:", dbError);
        setError("Failed to load user profile");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  // Calculate relationship status
  const relationship = useMemo(() => {
    if (!currentUser?.uid || !uid) return {};
    
    const relations = calculateRelationship(currentUser.uid, { uid }, currentUserRelations);
    const isMutualFriend = relations.isFriend || (relations.isFollowing && relations.isFollower);

    return { ...relations, isFriend: isMutualFriend, isMutualFriend };
  }, [currentUser, uid, currentUserRelations, calculateRelationship]);

  // Block status checks
  const isBlockedByProfile = useMemo(() => 
    currentUserRelations.blockedBy?.some(user => user.uid === uid) || false,
    [currentUserRelations.blockedBy, uid]
  );

  const isProfileBlocked = useMemo(() => 
    currentUserRelations.blocked?.some(user => user.uid === uid) || false,
    [currentUserRelations.blocked, uid]
  );

  const { isFriend, isBlocked } = relationship;
  const isLocked = userData?.isLocked === true;
  const shouldShowLockedProfile = isLocked && !isFriend && currentUser?.uid !== uid;

  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
  }, []);

  // Render states
  if (loading) return <ProfileSkeleton />;
  if (error) return <ProfileError message={error} onRetry={handleRetry} />;
  if (!userData) return <ProfileError message="Sorry, this page isn't available." onRetry={handleRetry} />;
  if (isBlockedByProfile) return <BlockedProfile type="blockedBy" userId={uid} username={userData.username} />;
  if (isProfileBlocked) return <BlockedProfile type="blocked" userId={uid} username={userData.username} onUnblock={enhancedUserActions.unblockUser} />;

  return (
    <div className="min-vh-100 bg-white">
      <ProfileHeader 
        userData={userData}
        currentUser={currentUser}
        relationship={relationship}
        userActions={enhancedUserActions}
        uid={uid}
        isUpdating={isUpdating}
      />

      {currentUser?.uid !== uid && !isBlocked && !isBlockedByProfile && (
        <ChatButton username={userData.username} uid={uid} />
      )}

      <ProfileStats 
        userData={userData}
        currentUser={currentUser}
        currentUserRelations={currentUserRelations}
        uid={uid}
      />

      {/* Content Area */}
      {shouldShowLockedProfile ? (
        <LockedProfile 
          username={userData.username}
          userPhoto={userData.photoURL}
          onFollow={() => enhancedUserActions.followUser(uid)}
        />
      ) : (
        <div className="mt-1">
          <GetPost uid={uid} showFilter={false} />
        </div>
      )}
    </div>
  );
}