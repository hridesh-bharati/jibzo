// src/assets/users/AllUsers.jsx
import React, { useEffect, useState } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update } from "firebase/database";
import { toast } from "react-toastify";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function AllUsers() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [sentRequests, setSentRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [searchTerm, setSearchTerm] = useState(""); // 🔍 search state
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        const userRef = ref(db, `usersData/${user.uid}`);
        onValue(userRef, (snapshot) => {
          const data = snapshot.val();
          setSentRequests(data?.followRequests?.sent ? Object.keys(data.followRequests.sent) : []);
          setFriends(data?.friends ? Object.keys(data.friends) : []);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const usersRef = ref(db, "usersData");
    onValue(usersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const allUsers = Object.entries(data).map(([uid, info]) => ({ uid, ...info }));
      setUsers(allUsers);
    });
  }, []);

  const sendFollowRequest = async (targetUID) => {
    if (!currentUser?.uid) return;
    const updates = {};
    updates[`usersData/${targetUID}/followRequests/received/${currentUser.uid}`] = true;
    updates[`usersData/${currentUser.uid}/followRequests/sent/${targetUID}`] = true;
    await update(ref(db), updates);
    toast.success("Request sent 🚀");
  };

  const cancelFollowRequest = async (targetUID) => {
    if (!currentUser?.uid) return;
    const updates = {};
    updates[`usersData/${targetUID}/followRequests/received/${currentUser.uid}`] = null;
    updates[`usersData/${currentUser.uid}/followRequests/sent/${targetUID}`] = null;
    await update(ref(db), updates);
    toast.info("Request cancelled ❌");
  };

  const unfriendUser = async (targetUID) => {
    if (!currentUser?.uid) return;
    const updates = {};
    updates[`usersData/${currentUser.uid}/friends/${targetUID}`] = null;
    updates[`usersData/${targetUID}/friends/${currentUser.uid}`] = null;
    updates[`usersData/${currentUser.uid}/followers/${targetUID}`] = null;
    updates[`usersData/${targetUID}/followers/${currentUser.uid}`] = null;
    updates[`usersData/${currentUser.uid}/following/${targetUID}`] = null;
    updates[`usersData/${targetUID}/following/${currentUser.uid}`] = null;
    await update(ref(db), updates);
    toast.info("Unfriended ❌");
  };

  const openUserProfile = (userUID) => navigate(`/user-profile/${userUID}`);

  // 🔍 Filter users by search term
  const filteredUsers = users.filter(
    (u) =>
      u.uid !== currentUser?.uid &&
      (u.username || "Unnamed User")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container my-3" style={{ maxWidth: 600 }}>
      <h3 className="mb-3">All Users</h3>

      {/* 🔍 Search Box */}
      <input
        type="text"
        className="form-control mb-3"
        placeholder="Search by name..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <ul className="list-group mb-5">
        {filteredUsers.map((user) => (
          <li
            key={user.uid}
            className="list-group-item d-flex align-items-center justify-content-between"
          >
            <div
              className="d-flex align-items-center"
              style={{ cursor: "pointer" }}
              onClick={() => openUserProfile(user.uid)}
            >
              <img
                src={user.photoURL || "https://via.placeholder.com/50"}
                alt="avatar"
                className="rounded-circle me-3"
                style={{ width: 50, height: 50, objectFit: "cover" }}
              />
              <div>
                <h6 className="mb-0">{user.username || "Unnamed User"}</h6>
                {user.isPrivate && <small className="text-muted">🔒 Private</small>}
              </div>
            </div>
            <div>
              {friends.includes(user.uid) ? (
                <button
                  className="btn btn-sm btn-success"
                  onClick={() => unfriendUser(user.uid)}
                >
                  Friends
                </button>
              ) : sentRequests.includes(user.uid) ? (
                <button
                  className="btn btn-sm btn-outline-warning"
                  onClick={() => cancelFollowRequest(user.uid)}
                >
                  Cancel
                </button>
              ) : (
                <button
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => sendFollowRequest(user.uid)}
                >
                  Add
                </button>
              )}
            </div>
          </li>
        ))}

        {/* No results */}
        {filteredUsers.length === 0 && (
          <li className="list-group-item text-center text-muted">
            No users found
          </li>
        )}
      </ul>
    </div>
  );
}
