// src/assets/users/Followers.jsx
import React, { useEffect, useState } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update, get } from "firebase/database";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

export default function Followers() {
  const { uid: paramUid } = useParams();
  const [followersList, setFollowersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  const navigate = useNavigate();
  const currentUser = auth.currentUser;
  const uid = paramUid || currentUser?.uid;

  useEffect(() => {
    if (!uid) return;

    const userRef = ref(db, `usersData/${uid}`);
    const followersRef = ref(db, `usersData/${uid}/followers`);

    // Listen to user data
    const unsubscribeUser = onValue(userRef, snap => {
      setUserData(snap.exists() ? snap.val() : null);
    });

    // Listen to followers changes
    const unsubscribeFollowers = onValue(followersRef, async snap => {
      if (!snap.exists()) {
        setFollowersList([]);
        setLoading(false);
        return;
      }

      const followersUIDs = Object.keys(snap.val());
      const followersData = await Promise.all(
        followersUIDs.map(async fUid => {
          const snapUser = await get(ref(db, `usersData/${fUid}`));
          return snapUser.exists()
            ? { uid: fUid, username: snapUser.val().username, photoURL: snapUser.val().photoURL }
            : null;
        })
      );

      setFollowersList(followersData.filter(Boolean));
      setLoading(false);
    });

    return () => {
      unsubscribeUser();
      unsubscribeFollowers();
    };
  }, [uid]);

  // Remove follower / unfriend
  const handleUnfriend = async (fUid) => {
    if (!currentUser) return toast.error("Login first!");

    try {
      await update(ref(db), {
        [`usersData/${uid}/followers/${fUid}`]: null,      // page owner's followers
        [`usersData/${fUid}/following/${uid}`]: null,      // remove from follower's following
        [`usersData/${uid}/friends/${fUid}`]: null,        // remove friendship
        [`usersData/${fUid}/friends/${uid}`]: null,
      });

      toast.info("Friend removed ✅");
      // No manual filtering needed; onValue listener updates automatically
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove friend");
    }
  };

  if (loading) return <p>Loading followers...</p>;

  return (
    <div className="container mt-3">
      <h4>Followers</h4>
      {followersList.length === 0 ? (
        <p>No followers</p>
      ) : (
        followersList.map(f => (
          <div
            key={f.uid}
            className="border p-2 mb-2 d-flex align-items-center justify-content-between rounded shadow-sm"
          >
            <div
              style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
              onClick={() => navigate(`/user-profile/${f.uid}`)}
            >
              <img
                src={f.photoURL || "https://via.placeholder.com/50"}
                alt="DP"
                style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover", marginRight: 10 }}
              />
              <span>{f.username || f.uid}</span>
            </div>
            {currentUser?.uid !== f.uid && (
              <button
                className="btn btn-sm btn-outline-danger"
                onClick={() => handleUnfriend(f.uid)}
              >
                Remove
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}
