import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebaseConfig";
import { ref, onValue, update, get } from "firebase/database";
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

    const userRef = ref(db, `usersData/${uid}`);
    const followingRef = ref(db, `usersData/${uid}/following`);

    // Listen to user data
    const unsubscribeUser = onValue(userRef, snap => {
      if (snap.exists()) {
        setUserData(snap.val());
      } else {
        setUserData(null);
      }
    });

    // Listen to following changes
    const unsubscribeFollowing = onValue(followingRef, async snap => {
      if (!snap.exists()) {
        setFollowingList([]);
        setLoading(false);
        return;
      }

      const followingUIDs = Object.keys(snap.val());
      const followingData = await Promise.all(
        followingUIDs.map(async fUid => {
          const snapUser = await get(ref(db, `usersData/${fUid}`));
          return snapUser.exists() ? { uid: fUid, ...snapUser.val() } : null;
        })
      );

      setFollowingList(followingData.filter(Boolean));
      setLoading(false);
    });

    return () => {
      unsubscribeUser();
      unsubscribeFollowing();
    };
  }, [uid]);

  const handleUnfollow = async (fUid) => {
    if (!currentUser) return toast.error("Login first!");
    try {
      await update(ref(db), {
        [`usersData/${fUid}/followers/${currentUser.uid}`]: null,
        [`usersData/${currentUser.uid}/following/${fUid}`]: null,
        [`usersData/${fUid}/friends/${currentUser.uid}`]: null,
        [`usersData/${currentUser.uid}/friends/${fUid}`]: null,
      });
      toast.info("Unfollowed ✅");
      // No need to manually filter; onValue listener auto-updates
    } catch {
      toast.error("Failed to unfollow");
    }
  };

  if (loading) return <p>Loading following...</p>;

  return (
    <div className="container mt-3">
      <h4>Following</h4>
      {followingList.length === 0 ? <p>No following</p> :
        followingList.map(f => (
          <div key={f.uid} className="border p-2 mb-2 d-flex align-items-center justify-content-between rounded shadow-sm">
            <div style={{ display: "flex", alignItems: "center", cursor: "pointer" }} onClick={() => navigate(`/user-profile/${f.uid}`)}>
              <img 
                src={f.photoURL || "https://via.placeholder.com/50"} 
                alt="DP" 
                style={{ width: 50, height: 50, borderRadius: "50%", objectFit: "cover", marginRight: 10 }} 
              />
              <span>{f.username || f.uid}</span>
            </div>
            {currentUser?.uid !== f.uid && (
              <button className="btn btn-sm btn-outline-danger" onClick={() => handleUnfollow(f.uid)}>
                Unfollow
              </button>
            )}
          </div>
        ))
      }
    </div>
  );
}
