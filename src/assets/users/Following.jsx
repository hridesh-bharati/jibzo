// src/assets/users/Following.jsx
import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebaseConfig";
import { ref, get, update } from "firebase/database";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

export default function Following() {
  const { uid: paramUid } = useParams();
  const [followingList, setFollowingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  const navigate = useNavigate();
  const currentUser = auth.currentUser;
  const uid = paramUid || currentUser?.uid;

  useEffect(() => {
    if (!uid) return;

    const fetchData = async () => {
      try {
        const userSnap = await get(ref(db, `usersData/${uid}`));
        if (!userSnap.exists()) {
          setUserData(null);
          setLoading(false);
          return;
        }
        const data = userSnap.val();
        setUserData(data);

        const isOwner = currentUser?.uid === uid;
        const isFriend = data.friends && currentUser?.uid && data.friends[currentUser.uid];

        if (data.isPrivate && !isOwner && !isFriend) {
          setFollowingList([]);
          setLoading(false);
          return;
        }

        const followingSnap = await get(ref(db, `usersData/${uid}/following`));
        if (!followingSnap.exists()) {
          setFollowingList([]);
          setLoading(false);
          return;
        }

        const followingUIDs = Object.keys(followingSnap.val());
        const followingData = await Promise.all(
          followingUIDs.map(async (fUid) => {
            const snap = await get(ref(db, `usersData/${fUid}`));
            return snap.exists() ? { uid: fUid, ...snap.val() } : null;
          })
        );

        setFollowingList(followingData.filter(Boolean));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [uid, currentUser]);

  const unfollowUser = async (fUid) => {
    if (!currentUser) return;
    try {
      const updates = {};
      updates[`usersData/${uid}/following/${fUid}`] = null;
      updates[`usersData/${fUid}/followers/${uid}`] = null;
      // Remove friend if exists
      updates[`usersData/${uid}/friends/${fUid}`] = null;
      updates[`usersData/${fUid}/friends/${uid}`] = null;

      await update(ref(db), updates);
      setFollowingList(prev => prev.filter(u => u.uid !== fUid));
      toast.success("Unfollowed ✅");
    } catch (err) {
      console.error(err);
      toast.error("Failed to unfollow ❌");
    }
  };

  if (loading) return <p className="text-center mt-5">Loading following...</p>;
  if (!userData) return <p className="text-center mt-5">User not found.</p>;
  if (userData.isPrivate && currentUser?.uid !== uid && !(userData.friends && userData.friends[currentUser?.uid]))
    return <p className="text-center mt-5">This profile is private 🔒</p>;

  return (
    <div className="container mt-4">
      <h3 className="mb-3">Following</h3>
      {followingList.length > 0 ? (
        <ul className="list-group">
          {followingList.map((user) => (
            <li
              key={user.uid}
              className="list-group-item list-group-item-action d-flex align-items-center justify-content-between"
            >
              <div className="d-flex align-items-center" style={{ cursor: "pointer" }} onClick={() => navigate(`/user-profile/${user.uid}`)}>
                <img
                  src={user.photoURL || "https://via.placeholder.com/50"}
                  alt="Profile"
                  className="rounded-circle me-3"
                  style={{ width: "50px", height: "50px", objectFit: "cover" }}
                />
                <div>
                  <strong>{user.username || "Unnamed"}</strong>
                  <p className="mb-0 text-muted" style={{ fontSize: "14px" }}>
                    {user.email || "No email"}
                  </p>
                </div>
              </div>

              {/* Only owner can unfollow */}
              {currentUser?.uid === uid && (
                <button className="btn btn-sm btn-danger" onClick={() => unfollowUser(user.uid)}>Unfollow</button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted">Not following anyone yet.</p>
      )}
    </div>
  );
}
