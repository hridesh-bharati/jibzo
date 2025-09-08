import React, { useEffect, useState, useMemo } from "react";
import { db } from "../../firebaseConfig";
import { ref, onValue, update, get } from "firebase/database";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { getAuth } from "firebase/auth";

export default function InstaUsers() {
  const [users, setUsers] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [followersList, setFollowersList] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("all");

  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(setCurrentUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
  const usersRef = ref(db, "usersData");

  const unsubscribe = onValue(usersRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const usersArray = Object.entries(data).map(([uid, userData]) => ({
        uid,
        ...userData,
      }));
      setUsers(usersArray);
    } else {
      setUsers([]);
    }
  }, (error) => {
    console.error("Error fetching users in real-time:", error);
    toast.error("Failed to load users");
  });

  return () => unsubscribe();
}, []);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const followingRef = ref(db, `usersData/${currentUser.uid}/following`);
    const followersRef = ref(db, `usersData/${currentUser.uid}/followers`);

    const unsubFollowing = onValue(followingRef, (snapshot) => {
      setFollowingList(snapshot.exists() ? Object.keys(snapshot.val()) : []);
    });

    const unsubFollowers = onValue(followersRef, (snapshot) => {
      setFollowersList(snapshot.exists() ? Object.keys(snapshot.val()) : []);
    });

    return () => {
      unsubFollowing();
      unsubFollowers();
    };
  }, [currentUser]);

  const handleFollowToggle = async (targetUID) => {
    if (!currentUser?.uid || targetUID === currentUser.uid) return;

    const currentUID = currentUser.uid;
    const updates = {};
    const isFollowing = followingList.includes(targetUID);

    if (isFollowing) {
      updates[`usersData/${currentUID}/following/${targetUID}`] = null;
      updates[`usersData/${targetUID}/followers/${currentUID}`] = null;
    } else {
      updates[`usersData/${currentUID}/following/${targetUID}`] = true;
      updates[`usersData/${targetUID}/followers/${currentUID}`] = true;
    }

    try {
      await update(ref(db), updates);
      toast.success(isFollowing ? "Unfollowed" : "Followed");
    } catch (error) {
      console.error("Follow toggle failed:", error);
      toast.error("Action failed");
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (user.uid === currentUser?.uid) return false;
      if (activeTab === "followers") return followersList.includes(user.uid);
      if (activeTab === "following") return followingList.includes(user.uid);
      return true;
    });
  }, [users, activeTab, followersList, followingList, currentUser]);

  return (
    <div className="container my-2 mx-0 p-0">
      {/* Tabs */}
      <div className="d-flex justify-content-center gap-2 mb-3 flex-wrap">
        {["all", "followers", "following"].map((tab) => {
          const label =
            tab === "all"
              ? `All (${users.length - 1})`
              : tab.charAt(0).toUpperCase() + tab.slice(1) + ` (${tab === "followers" ? followersList.length : followingList.length})`;
          return (
            <button
              key={tab}
              className={`btn btn-sm ${activeTab === tab ? "btn-primary" : "btn-outline-primary"}`}
              onClick={() => setActiveTab(tab)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Users */}
      {filteredUsers.length > 0 ? (
        <ul className="list-group">
          {filteredUsers.map((user) => (
            <li
              key={user.uid}
              className="list-group-item d-flex align-items-center justify-content-between py-2 px-3 m-2 shadow-sm rounded"
            >
              <Link
                to={`/user-profile/${user.uid}`}
                className="d-flex align-items-center text-decoration-none text-dark flex-grow-1"
              >
                <img
<<<<<<< HEAD
                  src={user.photoURL || "icons/avatar.png"}
=======
                  src={user.photoURL || "https://via.placeholder.com/50"}
>>>>>>> 6cfed43d1372ef5d1c115eaf2f5e529e572e9d9f
                  alt={user.username}
                  loading="lazy"
                  className="rounded-circle me-3"
                  style={{ width: 50, height: 50, objectFit: "cover" }}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>{user.username || "Unknown"}</div>
                  <small className="text-muted">{user.email || "No email"}</small>
                </div>
              </Link>

              <button
                onClick={() => handleFollowToggle(user.uid)}
                className={`btn btn-sm ${followingList.includes(user.uid)
                  ? "btn-outline-danger"
                  : "btn-outline-primary"
                  }`}
              >
                {followingList.includes(user.uid) ? "Unfollow" : "Follow"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted text-center mt-4">No users found.</p>
      )}
    </div>
  );
}
