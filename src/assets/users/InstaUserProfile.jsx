// src/assets/users/InstaUserProfile.jsx
import React, { useEffect, useState } from "react";
import { db, auth } from "../utils/firebaseConfig";
import { ref, onValue } from "firebase/database";
import { useParams, Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useUserRelations, useUserActions } from "../../hooks/useUserRelations";
import GetPost from "../uploads/GetPost";

export default function UserProfile() {
  const { uid } = useParams();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileRelations, setProfileRelations] = useState({
    followers: [],
    following: []
  });
  const currentUser = auth.currentUser;
  const navigate = useNavigate();

  // Use custom hooks - only one instance for current user
  const { relations: currentUserRelations, calculateRelationship } = useUserRelations(currentUser?.uid);
  const userActions = useUserActions();

  // Fetch profile user data
  useEffect(() => {
    if (!uid) return;
    
    const userRef = ref(db, `usersData/${uid}`);
    const unsubscribeUser = onValue(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setUserData(data);
        
        // Extract follower and following counts from profile user's data
        const followersCount = Object.keys(data.followers || {}).length;
        const followingCount = Object.keys(data.following || {}).length;
        
        setProfileRelations({
          followers: Array(followersCount).fill({}), // Just for count display
          following: Array(followingCount).fill({})  // Just for count display
        });
      }
      setLoading(false);
    });

    return () => unsubscribeUser();
  }, [uid]);

  // Calculate relationships using current user's relations
  const relationship = calculateRelationship(currentUser?.uid, { uid }, currentUserRelations);
  
  const isLocked = userData?.isLocked === true;
  const isBlockedByProfile = currentUserRelations.blockedBy?.some(user => user.uid === uid) || false;
  const isProfileBlocked = currentUserRelations.blocked?.some(user => user.uid === uid) || false;
  const { isFriend, isFollowing, hasReceivedRequest, hasSentRequest, isBlocked } = relationship;

  if (loading) return (
    <div className="d-flex justify-content-center align-items-center min-vh-50">
      <div className="text-center">
        <div className="spinner-border text-primary mb-3"></div>
        <p>Loading profile...</p>
      </div>
    </div>
  );
  
  if (!userData) return (
    <div className="text-center mt-5">
      <i className="bi bi-person-x display-1 text-muted"></i>
      <h3 className="mt-3">User not found</h3>
      <p>The user you're looking for doesn't exist or has been deleted.</p>
    </div>
  );

  // Show blocked messages
  if (isBlockedByProfile) {
    return (
      <div className="container text-center mt-5">
        <i className="bi bi-person-slash display-1 text-danger"></i>
        <h3 className="mt-3">Profile Unavailable</h3>
        <p className="text-muted">You have been blocked by this user.</p>
      </div>
    );
  }

  if (isProfileBlocked) {
    return (
      <div className="container text-center mt-5">
        <i className="bi bi-person-slash display-1 text-warning"></i>
        <h3 className="mt-3">Profile Blocked</h3>
        <p className="text-muted">You have blocked this user.</p>
        <button 
          className="btn btn-outline-success mt-2" 
          onClick={() => userActions.unblockUser(uid)}
        >
          Unblock User
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-0" style={{ maxWidth: "900px" }}>
      {/* Wallpaper & Profile */}
      <div className="w-100 bg-dark rounded-top">
        <div
          className="position-relative w-100 mb-5 pb-3"
          style={{
            backgroundImage: `url(${userData.wallpaper || "https://via.placeholder.com/900x200"})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            height: "170px",
            borderBottom: "3px solid #26c6da"
          }}
        >
          <div
            className="position-absolute d-flex align-items-center justify-content-start w-100 px-2"
            style={{ top: "85%", transform: "translateY(-50%)" }}
          >
            {/* Profile Picture */}
            <img
              src={userData.photoURL || "/icons/avatar.jpg"}
              alt="Profile"
              className="rounded-circle shadow-sm border border-3 border-white"
              width={120}
              height={120}
              style={{ objectFit: "cover" }}
              onError={(e) => {
                e.target.src = "/icons/avatar.jpg";
              }}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {currentUser?.uid !== uid && (
        <div className="d-flex gap-2 justify-content-end me-3 mb-3 flex-wrap">
          {isFriend ? (
            <button 
              className="btn btn-sm btn-danger" 
              onClick={() => userActions.unfollowUser(uid)}
            >
              <i className="bi bi-person-dash me-1"></i>Unfriend
            </button>
          ) : isFollowing ? (
            <button 
              className="btn btn-sm btn-danger" 
              onClick={() => userActions.unfollowUser(uid)}
            >
              <i className="bi bi-person-dash me-1"></i>Unfollow
            </button>
          ) : hasReceivedRequest ? (
            <div className="d-flex gap-2">
              <button 
                className="btn btn-sm btn-success" 
                onClick={() => userActions.acceptRequest(uid)}
              >
                <i className="bi bi-check-lg me-1"></i>Accept
              </button>
              <button 
                className="btn btn-sm btn-outline-danger" 
                onClick={() => userActions.declineRequest(uid)}
              >
                <i className="bi bi-x-lg me-1"></i>Decline
              </button>
            </div>
          ) : hasSentRequest ? (
            <button 
              className="btn btn-sm btn-secondary" 
              onClick={() => userActions.cancelFollowRequest(uid)}
            >
              <i className="bi bi-clock me-1"></i>Cancel Request
            </button>
          ) : (
            <button 
              className="btn btn-sm btn-primary" 
              onClick={() => userActions.followUser(uid)}
            >
              <i className="bi bi-person-plus me-1"></i>Follow
            </button>
          )}
          
          {!isBlocked ? (
            <button 
              className="btn btn-sm btn-outline-warning" 
              onClick={() => userActions.blockUser(uid)}
            >
              <i className="bi bi-ban me-1"></i>Block
            </button>
          ) : (
            <button 
              className="btn btn-sm btn-outline-success" 
              onClick={() => userActions.unblockUser(uid)}
            >
              <i className="bi bi-unlock me-1"></i>Unblock
            </button>
          )}
        </div>
      )}

      {/* User Info */}
      <div className="ms-3 mb-3">
        <h5 className="fw-bolder text-dark">{userData.username || "Unnamed User"}</h5>
        {currentUser?.uid !== uid && (
          <p className="fw-bolder text-muted small">{userData.email}</p>
        )}
        {userData.bio && (
          <p className="text-muted mt-2">{userData.bio}</p>
        )}
      </div>

      {/* Relationship Stats with Counts */}
      <div className="d-flex gap-2 m-3 flex-wrap">
        <Link
          to={`/followers/${uid}`}
          className="btn btn-sm btn-outline-primary"
        >
          <i className="bi bi-people-fill me-1"></i>
          Followers: {profileRelations.followers.length}
        </Link>
        <Link
          to={`/following/${uid}`}
          className="btn btn-sm btn-outline-success"
        >
          <i className="bi bi-person-check me-1"></i>
          Following: {profileRelations.following.length}
        </Link>
        {currentUser?.uid === uid && currentUserRelations.requested.length > 0 && (
          <Link
            to={`/requested/${uid}`}
            className="btn btn-sm btn-outline-warning"
          >
            <i className="bi bi-hourglass-split me-1"></i>
            Requests: {currentUserRelations.requested.length}
          </Link>
        )}
        {currentUser?.uid === uid && currentUserRelations.blocked.length > 0 && (
          <Link
            to={`/blocked/${uid}`}
            className="btn btn-sm btn-outline-danger"
          >
            <i className="bi bi-person-x me-1"></i>
            Blocked: {currentUserRelations.blocked.length}
          </Link>
        )}
      </div>

      {/* Chat Button */}
      {currentUser?.uid !== uid && !isBlocked && !isBlockedByProfile && (
        <div className="m-3">
          <button
            className="btn chat-3d-btn w-100"
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
            Chat with {userData.username}
          </button>
        </div>
      )}

      {/* Locked Profile */}
      {isLocked && !isFriend && currentUser?.uid !== uid ? (
        <div
          className="d-flex flex-column align-items-center justify-content-center text-muted py-5"
          style={{ minHeight: "30vh" }}
        >
          <i className="bi bi-lock display-1 mb-3 text-secondary"></i>
          <h3 className="fw-bold">This profile is locked 🔒</h3>
          <p className="mt-2 text-center">Follow to see posts and details</p>
          <button 
            className="btn btn-primary mt-3" 
            onClick={() => userActions.followUser(uid)}
          >
            <i className="bi bi-person-plus me-2"></i>
            Follow to Unlock
          </button>
        </div>
      ) : (
        <GetPost uid={uid} />
      )}
    </div>
  );
}