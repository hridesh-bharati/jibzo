// src/assets/users/InstaUserProfile.jsx
import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebaseConfig";
import { ref, get, update } from "firebase/database";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function InstaUserProfile() {
  const { uid } = useParams();
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canView, setCanView] = useState(false);
  const [status, setStatus] = useState("loading"); // "follow", "requested", "friends"
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);

  // Fetch profile and status
  const fetchProfileAndStatus = async () => {
    try {
      const userSnap = await get(ref(db, `usersData/${uid}`));
      if (!userSnap.exists()) {
        toast.error("User not found!");
        navigate("/all-insta-users");
        return;
      }
      const data = userSnap.val();
      setUserData(data);

      // Privacy logic
      if (!data.isPrivate || currentUser?.uid === uid) {
        setCanView(true);
      } else {
        const friendSnap = await get(ref(db, `usersData/${uid}/friends/${currentUser?.uid}`));
        setCanView(friendSnap.exists());
      }

      // Followers / Following counts
      const followersSnap = await get(ref(db, `usersData/${uid}/followers`));
      const followingSnap = await get(ref(db, `usersData/${uid}/following`));
      setFollowersCount(followersSnap.exists() ? Object.keys(followersSnap.val()).length : 0);
      setFollowingCount(followingSnap.exists() ? Object.keys(followingSnap.val()).length : 0);

      // Status logic
      if (currentUser?.uid && currentUser.uid !== uid) {
        const friendSnap = await get(ref(db, `usersData/${currentUser.uid}/friends/${uid}`));
        if (friendSnap.exists()) {
          setStatus("friends");
        } else {
          const sentSnap = await get(ref(db, `usersData/${currentUser.uid}/followRequests/sent/${uid}`));
          const receivedSnap = await get(ref(db, `usersData/${currentUser.uid}/followRequests/received/${uid}`));
          setStatus(sentSnap.exists() || receivedSnap.exists() ? "requested" : "follow");
        }

        const followingSnap2 = await get(ref(db, `usersData/${currentUser.uid}/following/${uid}`));
        setIsFollowing(followingSnap2.exists());
      }

    } catch (err) {
      console.error(err);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndStatus();
  }, [uid, currentUser, navigate]);

  // Handle friend request / add / cancel
  const handleFriendRequest = async () => {
    if (!currentUser?.uid) return toast.error("Login first!");

    try {
      if (status === "follow") {
        if (userData.isPrivate) {
          // Send request
          await update(ref(db), {
            [`usersData/${uid}/followRequests/received/${currentUser.uid}`]: true,
            [`usersData/${currentUser.uid}/followRequests/sent/${uid}`]: true,
          });
          toast.info("Follow request sent ⏳");
        } else {
          // Auto friend if public
          await update(ref(db), {
            [`usersData/${uid}/friends/${currentUser.uid}`]: true,
            [`usersData/${currentUser.uid}/friends/${uid}`]: true,
          });
          toast.success("Now friends ✅");
        }
      } else if (status === "requested") {
        // Cancel request
        await update(ref(db), {
          [`usersData/${uid}/followRequests/received/${currentUser.uid}`]: null,
          [`usersData/${currentUser.uid}/followRequests/sent/${uid}`]: null,
        });
        toast.info("Follow request cancelled ❌");
      } else if (status === "friends") {
        // Unfriend
        await update(ref(db), {
          [`usersData/${uid}/friends/${currentUser.uid}`]: null,
          [`usersData/${currentUser.uid}/friends/${uid}`]: null,
        });
        toast.info("Friend removed ❌");
      }

      // 🔹 Refresh status live after action
      fetchProfileAndStatus();

    } catch (err) {
      console.error(err);
      toast.error("Action failed!");
    }
  };

  // Independent follow/unfollow after friends
  const handleFollowToggle = async () => {
    try {
      if (isFollowing) {
        await update(ref(db), {
          [`usersData/${uid}/followers/${currentUser.uid}`]: null,
          [`usersData/${currentUser.uid}/following/${uid}`]: null,
        });
        setIsFollowing(false);
        setFollowersCount(prev => prev - 1);
        toast.info("Unfollowed ❌");
      } else {
        await update(ref(db), {
          [`usersData/${uid}/followers/${currentUser.uid}`]: true,
          [`usersData/${currentUser.uid}/following/${uid}`]: true,
        });
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
        toast.success("Now following ✅");
      }
    } catch (err) {
      console.error(err);
      toast.error("Follow action failed!");
    }
  };

  if (loading) return <p className="text-center mt-5">Loading...</p>;
  if (!userData) return <p className="text-center mt-5">User not found.</p>;

  const isOwner = currentUser?.uid === uid;

  return (
    <div className="container my-4">
      <div className="card p-3 shadow-sm text-center">
        <img
          src={userData.photoURL || "https://via.placeholder.com/150"}
          alt="DP"
          className="rounded-circle mb-3"
          style={{ width: 120, height: 120, objectFit: "cover" }}
        />
        <h4>{userData.username || "Unnamed User"}</h4>

        {canView && (
          <>
            <p className="text-muted">{userData.email || "No email"}</p>
            <p><strong>Bio:</strong> {userData.bio || "No bio added."}</p>
            <p>Followers: {followersCount} | Following: {followingCount}</p>
          </>
        )}

        {/* Friend / Request button */}
        {!isOwner && (
          <button
            className={`btn mt-3 ${status === "friends" ? "btn-success" : status === "requested" ? "btn-secondary" : "btn-primary"}`}
            onClick={handleFriendRequest}
          >
            {status === "friends" ? "Friends" : status === "requested" ? "Requested ⏳" : "Add Friend / Follow"}
          </button>
        )}

        {/* Extra follow button after being friends */}
        {!isOwner && status === "friends" && (
          <button
            className={`btn w-100 mt-2 ${isFollowing ? "btn-success" : "btn-primary"}`}
            onClick={handleFollowToggle}
          >
            {isFollowing ? "Following ✅" : "Follow +"}
          </button>
        )}

        {/* Privacy toggle for owner */}
        {isOwner && (
          <button
            className="btn btn-warning mt-2"
            onClick={async () => {
              await update(ref(db, `usersData/${uid}`), { isPrivate: !userData.isPrivate });
              setUserData(prev => ({ ...prev, isPrivate: !prev.isPrivate }));
              toast.success(userData.isPrivate ? "Profile unlocked" : "Profile locked");
            }}
          >
            {userData.isPrivate ? "Unlock Profile 🔓" : "Lock Profile 🔒"}
          </button>
        )}

        {!canView && !isOwner && (
          <p className="text-muted mt-2">This profile is private 🔒</p>
        )}
      </div>
    </div>
  );
}
