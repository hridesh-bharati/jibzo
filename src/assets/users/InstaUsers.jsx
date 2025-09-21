// src/assets/users/AllUsers.jsx
import React, { useEffect, useState } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update, remove } from "firebase/database";
import { toast } from "react-toastify";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

export default function AllUsers() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [sentRequests, setSentRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [requestedCount, setRequestedCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
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
          setFollowersCount(data?.followers ? Object.keys(data.followers).length : 0);
          setFollowingCount(data?.following ? Object.keys(data.following).length : 0);
          setRequestedCount(data?.followRequests?.received ? Object.keys(data.followRequests.received).length : 0);
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

  const deleteUser = async (targetUID) => {
    if (!currentUser?.uid) return;
    if (currentUser.email !== ADMIN_EMAIL) return toast.error("❌ Only founder can delete users!");
    if (targetUID === currentUser.uid) return toast.error("Cannot delete yourself!");
    if (!window.confirm("Are you sure you want to delete this user from jibzo server?")) return;

    try {
      await remove(ref(db, `usersData/${targetUID}`));
      toast.success("User deleted 🗑️");
    } catch {
      toast.error("❌ Failed to delete user");
    }
  };

  const filteredUsers = users.filter(
    (u) => u.uid !== currentUser?.uid && (u.username || "Unnamed User").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-0 p-0 my-3" style={{ maxWidth: 600 }}>
      <h3 className="m-3 d-flex">All <div className="text-danger mx-2"> Jibzo </div> Users</h3>

      {/* Followers / Following / Requested buttons like AdminProfile */}
      <div className="d-flex gap-2 m-1 flex-wrap">
        <button className="threeD-btn redBtn flex-fill" onClick={() => navigate(`/followers/${currentUser?.uid}`)}>
          Followers: {followersCount}
        </button>
        <button className="threeD-btn yellowBtn flex-fill" onClick={() => navigate(`/following/${currentUser?.uid}`)}>
          Following: {followingCount}
        </button>
        <button className="threeD-btn blueBtn flex-fill" onClick={() => navigate(`/requested/${currentUser?.uid}`)}>
          Requested: {requestedCount}
        </button>
      </div>

      <input
        type="text"
        className="form-control my-3"
        placeholder="Search by name..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <ul className="list-group mb-5">
        {filteredUsers.map((user) => (
          <li
            key={user.uid}
            className="list-group-item d-flex align-items-center justify-content-between m-0 px-1"
          >
            <div style={{ cursor: "pointer" }} onClick={() => navigate(`/user-profile/${user.uid}`)}>
              <img
                src={user.photoURL || "icons/avatar.jpg"}
                alt="avatar"
                className="rounded-circle me-3"
                style={{ width: 50, height: 50, objectFit: "cover" }}
              />
              <span>{user.username || "Unnamed User"}</span>
            </div>

            <div className="d-flex gap-2">
              {friends.includes(user.uid) ? (
                <button className="btn btn-sm btn-success" onClick={() => unfriendUser(user.uid)}>Friends</button>
              ) : sentRequests.includes(user.uid) ? (
                <button className="btn btn-sm btn-outline-warning" onClick={() => cancelFollowRequest(user.uid)}>Cancel</button>
              ) : (
                <button className="btn btn-sm btn-outline-primary" onClick={() => sendFollowRequest(user.uid)}>Add</button>
              )}

              {currentUser?.email === ADMIN_EMAIL && (
                <button className="btn btn-sm btn-danger m-0 px-1" onClick={() => deleteUser(user.uid)}> <small><i className="bi bi-trash3"></i>(DB)</small></button>
              )}
            </div>
          </li>
        ))}

        {filteredUsers.length === 0 && (
          <p className="text-center">Loading Users...</p>
        )}
      </ul>
    </div>
  );
}
