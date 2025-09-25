// src/assets/users/SnapStarBar.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { toast } from "react-toastify";

function shuffleArray(array) {
  return array
    .map((item) => ({ item, sortKey: Math.random() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ item }) => item);
}

export default function SnapStarBar() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loadingOp, setLoadingOp] = useState(null);

  // Listen auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        const uRef = ref(db, `usersData/${user.uid}`);
        onValue(uRef, (snap) => {
          const data = snap.val() || {};
          setFriends(data.friends ? Object.keys(data.friends) : []);
          setSentRequests(data.followRequests?.sent ? Object.keys(data.followRequests.sent) : []);
        });
      }
    });
    return () => unsub();
  }, []);

  // Fetch all users
  useEffect(() => {
    const uRef = ref(db, "usersData");
    onValue(uRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([uid, info]) => ({ uid, ...info }));
      setUsers(arr);
    });
  }, []);

  // Handle follow/unfollow
  const handleFollowToggle = async (targetUID) => {
    if (!currentUser?.uid) {
      toast.error("Login required");
      return;
    }
    if (targetUID === currentUser.uid) return;

    setLoadingOp(targetUID);
    try {
      const updates = {};
      const isFriend = friends.includes(targetUID);
      const isPending = sentRequests.includes(targetUID);

      if (isFriend) {
        updates[`usersData/${currentUser.uid}/friends/${targetUID}`] = null;
        updates[`usersData/${targetUID}/friends/${currentUser.uid}`] = null;
        updates[`usersData/${currentUser.uid}/followers/${targetUID}`] = null;
        updates[`usersData/${targetUID}/followers/${currentUser.uid}`] = null;
        updates[`usersData/${currentUser.uid}/following/${targetUID}`] = null;
        updates[`usersData/${targetUID}/following/${currentUser.uid}`] = null;
        await update(ref(db), updates);
        toast.info("Unfriended");
      } else if (isPending) {
        updates[`usersData/${targetUID}/followRequests/received/${currentUser.uid}`] = null;
        updates[`usersData/${currentUser.uid}/followRequests/sent/${targetUID}`] = null;
        await update(ref(db), updates);
        toast.info("Request cancelled");
      } else {
        updates[`usersData/${targetUID}/followRequests/received/${currentUser.uid}`] = true;
        updates[`usersData/${currentUser.uid}/followRequests/sent/${targetUID}`] = true;
        await update(ref(db), updates);
        toast.success("Follow request sent");
      }
    } catch (e) {
      console.error(e);
      toast.error("Action failed");
    } finally {
      setLoadingOp(null);
    }
  };

  if (!currentUser) return null;

  const filtered = shuffleArray(users.filter((u) => u.uid !== currentUser.uid));

  return (
    <div className="d-flex overflow-auto gap-3 px-2 pb-3">
      {filtered.map((user) => {
        const isAdmin = user.email === import.meta.env.VITE_ADMIN_EMAIL;
        const isFriend = friends.includes(user.uid);
        const isPending = sentRequests.includes(user.uid);

        let btnText = "Follow";
        let btnClass = "btn-primary";
        if (isFriend) {
          btnText = "Following";
          btnClass = "btn-outline-secondary";
        } else if (isPending) {
          btnText = "Pending";
          btnClass = "btn-outline-warning";
        }

        return (
          <div
            key={user.uid}
            className="snap-card text-center"
          >
            <Link to={`/user-profile/${user.uid}`}>
              <img
                src={user.photoURL || "icons/avatar.jpg"}
                alt={user.username || user.email}
                className="snap-dp"
                style={{
                  border: `3px solid ${isAdmin ? "#007AFF" : "#eee"}`,
                }}
              />
            </Link>
            <small className="fw-semibold snap-name">
              {isAdmin ? "⭐ Snap Star" : user.username || "User"}
            </small>
            <button
              onClick={() => handleFollowToggle(user.uid)}
              className={`snap-btn ${btnClass}`}
              disabled={loadingOp === user.uid}
            >
              {btnText}
            </button>
          </div>
        );
      })}

      <style>{`
  /* Scrollbar */
  .d-flex::-webkit-scrollbar {
    display:"none";
        height:0;
  }
  .d-flex::-webkit-scrollbar-track {
  display:"none";
      height:0;
  }
  .d-flex::-webkit-scrollbar-thumb {
   display:"none";
      height:0;
  }

  .snap-card {
    min-width: 110px;
    padding: 12px 10px;
    border-radius: 16px;
    background: linear-gradient(145deg, #ffffff, #f9f9f9);
    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    transition: all 0.3s ease;
  }
  .snap-card:hover {
    // transform: translateY(-3px);
    box-shadow: 0 8px 18px rgba(0,0,0,0.12);
  }

  .snap-dp {
    width: 70px;
    height: 70px;
    object-fit: cover;
    border-radius: 50%;
    box-shadow: 0 3px 8px rgba(0,0,0,0.1);
  }

  .snap-name {
    font-size: 13px;
    margin-top: 6px;
    display: block;
    max-width: 90px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Buttons */
  .snap-btn {
    font-size: 11px;
    padding: 5px 12px;
    margin-top: 6px;
    border-radius: 25px;
    min-width: 80px;
    font-weight: 600;
    color: #fff;
    border: none;
    transition: 0.3s;
  }

  .btn-primary {
    background: linear-gradient(45deg, #00c6ff, #0072ff);
  }
  .btn-primary:hover {
    background: linear-gradient(45deg, #0072ff, #00c6ff);
  }

  .btn-outline-warning {
    background: linear-gradient(45deg, #ee6b00ff, #fabb00ff);
  }
  .btn-outline-warning:hover {
    background: linear-gradient(45deg, #ff7300ff, #ffb347);
  }

  .btn-outline-secondary {
    background: linear-gradient(45deg, #56ab2f, #a8e063);
  }
  .btn-outline-secondary:hover {
    background: linear-gradient(45deg, #a8e063, #56ab2f);
  }
`}</style>

    </div>
  );
}
