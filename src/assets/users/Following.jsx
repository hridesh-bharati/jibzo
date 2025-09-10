// src/assets/users/Following.jsx
import React, { useEffect, useState } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update, get } from "firebase/database";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

export default function Following() {
  const { uid: paramUid } = useParams();
  const [followingList, setFollowingList] = useState([]);
  const [requests, setRequests] = useState([]);
  const [followers, setFollowers] = useState([]);
  const navigate = useNavigate();
  const currentUser = auth.currentUser;
  const uid = paramUid || currentUser?.uid;

  // Fetch Following + Followers + Requests
  useEffect(() => {
    if (!uid) return;

    const followingRef = ref(db, `usersData/${uid}/following`);
    const followersRef = ref(db, `usersData/${uid}/followers`);
    const requestsRef = ref(db, `usersData/${uid}/followRequests/received`);

    const unsubFollowing = onValue(followingRef, async (snap) => {
      if (!snap.exists()) {
        setFollowingList([]);
        return;
      }
      const uids = Object.keys(snap.val());
      const data = await Promise.all(
        uids.map(async (fUid) => {
          const userSnap = await get(ref(db, `usersData/${fUid}`));
          return userSnap.exists() ? { uid: fUid, ...userSnap.val() } : null;
        })
      );
      setFollowingList(data.filter(Boolean));
    });

    const unsubFollowers = onValue(followersRef, (snap) => {
      setFollowers(snap.exists() ? Object.keys(snap.val()) : []);
    });

    const unsubRequests = onValue(requestsRef, (snap) => {
      setRequests(snap.exists() ? Object.keys(snap.val()) : []);
    });

    return () => {
      unsubFollowing();
      unsubFollowers();
      unsubRequests();
    };
  }, [uid]);

  // Unfollow handler
  const handleUnfollow = async (fUid) => {
    if (!currentUser) return toast.error("Login first!");
    await update(ref(db), {
      [`usersData/${fUid}/followers/${currentUser.uid}`]: null,
      [`usersData/${currentUser.uid}/following/${fUid}`]: null,
      [`usersData/${fUid}/friends/${currentUser.uid}`]: null,
      [`usersData/${currentUser.uid}/friends/${fUid}`]: null,
    });
    toast.info("Unfollowed ✅");
  };

  // Follow back handler
  const handleFollowBack = async (fUid) => {
    if (!currentUser) return toast.error("Login first!");
    await update(ref(db), {
      [`usersData/${fUid}/followers/${currentUser.uid}`]: true,
      [`usersData/${currentUser.uid}/following/${fUid}`]: true,
    });
    toast.success("Followed back 👥");
  };

  // Accept request handler
  const handleAccept = async (fUid) => {
    if (!currentUser) return toast.error("Login first!");
    await update(ref(db), {
      [`usersData/${currentUser.uid}/friends/${fUid}`]: true,
      [`usersData/${fUid}/friends/${currentUser.uid}`]: true,
      [`usersData/${currentUser.uid}/followers/${fUid}`]: true,
      [`usersData/${fUid}/following/${currentUser.uid}`]: true,
      [`usersData/${currentUser.uid}/followRequests/received/${fUid}`]: null,
      [`usersData/${fUid}/followRequests/sent/${currentUser.uid}`]: null,
    });
    toast.success("Request accepted ✅");
  };

  return (
    <div className="container mt-3">
      <h4>Following</h4>
      {followingList.length === 0 ? (
        <p>No following</p>
      ) : (
        followingList.map((f) => (
          <div
            key={f.uid}
            className="border p-2 mb-2 d-flex align-items-center justify-content-between rounded shadow-sm"
          >
            <div
              className="d-flex align-items-center"
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/user-profile/${f.uid}`)}
            >
              <img
                src={f.photoURL || "https://via.placeholder.com/50"}
                alt="DP"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  marginRight: 10,
                }}
              />
              <span>{f.username || f.uid}</span>
            </div>

            {currentUser?.uid !== f.uid && (
              <div className="d-flex gap-2">
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => handleUnfollow(f.uid)}
                >
                  Unfollow
                </button>

                {followers.includes(f.uid) && !followingList.some((u) => u.uid === f.uid) && (
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => handleFollowBack(f.uid)}
                  >
                    Follow Back
                  </button>
                )}

                {requests.includes(f.uid) && (
                  <button
                    className="btn btn-sm btn-success"
                    onClick={() => handleAccept(f.uid)}
                  >
                    Accept
                  </button>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
