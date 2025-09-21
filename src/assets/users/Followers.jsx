// // src/assets/users/Followers.jsx
// import React, { useEffect, useState } from "react";
// import { db, auth } from "../../assets/utils/firebaseConfig";
// import { ref, onValue } from "firebase/database";
// import { useParams, useNavigate } from "react-router-dom";

// export default function Followers() {
//   const { uid: paramUid } = useParams();
//   const currentUser = auth.currentUser;
//   const uid = paramUid || currentUser?.uid;
//   const [followers, setFollowers] = useState([]);
//   const navigate = useNavigate();

//   useEffect(() => {
//     if (!uid) return;
//     const followersRef = ref(db, `usersData/${uid}/followers`);
//     const unsubscribe = onValue(followersRef, (snap) => {
//       if (!snap.exists()) {
//         setFollowers([]);
//         return;
//       }
//       setFollowers(Object.keys(snap.val()));
//     });
//     return () => unsubscribe();
//   }, [uid]);

//   return (
//     <div className="container mt-3">
//       <h4>Followers</h4>
//       {followers.length === 0 ? (
//         <p>No followers</p>
//       ) : (
//         followers.map((fUid) => (
//           <div
//             key={fUid}
//             className="border p-2 mb-2 d-flex align-items-center rounded shadow-sm"
//             style={{ cursor: "pointer" }}
//             onClick={() => navigate(`/user-profile/${fUid}`)}
//           >
//             <span>{fUid}</span>
//           </div>
//         ))
//       )}
//     </div>
//   );
// }


// src/assets/users/Followers.jsx
import React, { useEffect, useState } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update, get } from "firebase/database";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";

export default function Followers() {
  const { uid: paramUid } = useParams();
  const [followersList, setFollowersList] = useState([]);
  const [following, setFollowing] = useState([]);
  const [requests, setRequests] = useState([]);
  const navigate = useNavigate();
  const currentUser = auth.currentUser;
  const uid = paramUid || currentUser?.uid;

  useEffect(() => {
    if (!uid) return;

    const followersRef = ref(db, `usersData/${uid}/followers`);
    const followingRef = ref(db, `usersData/${uid}/following`);
    const requestsRef = ref(db, `usersData/${uid}/followRequests/received`);

    const unsubFollowers = onValue(followersRef, async (snap) => {
      if (!snap.exists()) {
        setFollowersList([]);
        return;
      }
      const uids = Object.keys(snap.val());
      const data = await Promise.all(
        uids.map(async (fUid) => {
          const userSnap = await get(ref(db, `usersData/${fUid}`));
          return userSnap.exists() ? { uid: fUid, ...userSnap.val() } : null;
        })
      );
      setFollowersList(data.filter(Boolean));
    });

    const unsubFollowing = onValue(followingRef, (snap) => {
      setFollowing(snap.exists() ? Object.keys(snap.val()) : []);
    });

    const unsubRequests = onValue(requestsRef, (snap) => {
      setRequests(snap.exists() ? Object.keys(snap.val()) : []);
    });

    return () => {
      unsubFollowers();
      unsubFollowing();
      unsubRequests();
    };
  }, [uid]);

  const handleRemoveFollower = async (fUid) => {
    if (!currentUser) return toast.error("Login first!");
    await update(ref(db), {
      [`usersData/${uid}/followers/${fUid}`]: null,
      [`usersData/${fUid}/following/${uid}`]: null,
    });
    toast.info("Removed follower ❌");
  };

  const handleFollowBack = async (fUid) => {
    if (!currentUser) return toast.error("Login first!");
    await update(ref(db), {
      [`usersData/${fUid}/followers/${currentUser.uid}`]: true,
      [`usersData/${currentUser.uid}/following/${fUid}`]: true,
    });
    toast.success("Followed back 👥");
  };

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
      <h4>Followers</h4>
      {followersList.length === 0 ? (
        <p>No followers</p>
      ) : (
        followersList.map((f) => (
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
                style={{ width: 40, height: 40, borderRadius: "50%", marginRight: 10 }}
              />
              <span>{f.username || f.uid}</span>
            </div>
            {currentUser?.uid !== f.uid && (
              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-outline-danger" onClick={() => handleRemoveFollower(f.uid)}>
                  Remove
                </button>
                {!following.includes(f.uid) && (
                  <button className="btn btn-sm btn-outline-primary" onClick={() => handleFollowBack(f.uid)}>
                    Follow Back
                  </button>
                )}
                {requests.includes(f.uid) && (
                  <button className="btn btn-sm btn-success" onClick={() => handleAccept(f.uid)}>
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
