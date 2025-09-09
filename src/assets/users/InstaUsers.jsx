import React, { useEffect, useState } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update } from "firebase/database";
import { toast } from "react-toastify";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function InstaUsers() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [sentRequests, setSentRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const navigate = useNavigate();

  // Track logged-in user
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

  // Fetch all users
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
    await update(ref(db), updates);
    toast.info("Unfriended");
  };

  const openUserProfile = (userUID) => navigate(`/user-profile/${userUID}`);

  return (
    <div className="container mt-3" style={{ maxWidth: 600 }}>
      <h3 className="mb-3">Users</h3>
      <ul className="list-group">
        {users
          .filter((u) => u.uid !== currentUser?.uid)
          .map((user) => (
            <li key={user.uid} className="list-group-item d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center" style={{ cursor: "pointer" }} onClick={() => openUserProfile(user.uid)}>
                <img src={user.photoURL || "https://via.placeholder.com/50"} alt="avatar" className="rounded-circle me-3" style={{ width: 50, height: 50, objectFit: "cover" }} />
                <div><h6 className="mb-0">{user.username || "Unnamed User"}</h6></div>
              </div>
              <div>
                {friends.includes(user.uid) ? (
                  <button className="btn btn-sm btn-success" onClick={() => unfriendUser(user.uid)}>Friends</button>
                ) : sentRequests.includes(user.uid) ? (
                  <button className="btn btn-sm btn-outline-warning" onClick={() => cancelFollowRequest(user.uid)}>Cancel</button>
                ) : (
                  <button className="btn btn-sm btn-outline-primary" onClick={() => sendFollowRequest(user.uid)}>Add</button>
                )}
              </div>
            </li>
          ))}
      </ul>
    </div>
  );
}
