// // src/assets/users/Requested.jsx
// import React, { useEffect, useState } from "react";
// import { db, auth } from "../../assets/utils/firebaseConfig";
// import { ref, onValue, update } from "firebase/database";
// import { toast } from "react-toastify";

// export default function Requested() {
//   const currentUser = auth.currentUser;
//   const [requests, setRequests] = useState([]);

//   useEffect(() => {
//     if (!currentUser) return;
//     const reqRef = ref(db, `usersData/${currentUser.uid}/followRequests/received`);
//     const unsubscribe = onValue(reqRef, (snap) => {
//       if (!snap.exists()) {
//         setRequests([]);
//         return;
//       }
//       setRequests(Object.keys(snap.val()));
//     });
//     return () => unsubscribe();
//   }, [currentUser]);

//   const handleAccept = async (senderId) => {
//     try {
//       // 1. Friends
//       await update(ref(db, `usersData/${currentUser.uid}/friends`), { [senderId]: true });
//       await update(ref(db, `usersData/${senderId}/friends`), { [currentUser.uid]: true });

//       // 2. Followers + Following (both sides)
//       await update(ref(db, `usersData/${currentUser.uid}/followers`), { [senderId]: true });
//       await update(ref(db, `usersData/${senderId}/followers`), { [currentUser.uid]: true });
//       await update(ref(db, `usersData/${currentUser.uid}/following`), { [senderId]: true });
//       await update(ref(db, `usersData/${senderId}/following`), { [currentUser.uid]: true });

//       // 3. Remove requests
//       await update(ref(db, `usersData/${currentUser.uid}/followRequests/received`), { [senderId]: null });
//       await update(ref(db, `usersData/${senderId}/followRequests/sent`), { [currentUser.uid]: null });

//       toast.success("Friend request accepted ✅");
//     } catch (error) {
//       console.error(error);
//       toast.error("Failed to accept ❌");
//     }
//   };

//   const handleReject = async (senderId) => {
//     await update(ref(db, `usersData/${currentUser.uid}/followRequests/received`), { [senderId]: null });
//     await update(ref(db, `usersData/${senderId}/followRequests/sent`), { [currentUser.uid]: null });
//     toast.info("Request rejected ❌");
//   };

//   return (
//     <div className="container mt-3">
//       <h4>Friend Requests</h4>
//       {requests.length === 0 ? (
//         <p>No requests</p>
//       ) : (
//         requests.map((rUid) => (
//           <div key={rUid} className="border p-2 mb-2 d-flex align-items-center justify-content-between rounded shadow-sm">
//             <span>{rUid}</span>
//             <div>
//               <button className="btn btn-sm btn-success me-2" onClick={() => handleAccept(rUid)}>
//                 Accept
//               </button>
//               <button className="btn btn-sm btn-outline-danger" onClick={() => handleReject(rUid)}>
//                 Reject
//               </button>
//             </div>
//           </div>
//         ))
//       )}
//     </div>
//   );
// }

// src/assets/users/Requested.jsx
import React, { useEffect, useState } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update, get } from "firebase/database";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function Requested() {
  const [requests, setRequests] = useState([]);
  const currentUser = auth.currentUser;
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser?.uid) return;

    const requestsRef = ref(db, `usersData/${currentUser.uid}/followRequests/received`);

    const unsubRequests = onValue(requestsRef, async (snap) => {
      if (!snap.exists()) {
        setRequests([]);
        return;
      }
      const uids = Object.keys(snap.val());
      const data = await Promise.all(
        uids.map(async (rUid) => {
          const snapUser = await get(ref(db, `usersData/${rUid}`));
          return snapUser.exists() ? { uid: rUid, ...snapUser.val() } : null;
        })
      );
      setRequests(data.filter(Boolean));
    });

    return () => unsubRequests();
  }, [currentUser]);

  const handleAccept = async (senderId) => {
    try {
      await update(ref(db), {
        [`usersData/${currentUser.uid}/friends/${senderId}`]: true,
        [`usersData/${senderId}/friends/${currentUser.uid}`]: true,
        [`usersData/${currentUser.uid}/followers/${senderId}`]: true,
        [`usersData/${senderId}/following/${currentUser.uid}`]: true,
        [`usersData/${currentUser.uid}/followRequests/received/${senderId}`]: null,
        [`usersData/${senderId}/followRequests/sent/${currentUser.uid}`]: null,
      });
      toast.success("Friend request accepted!");
    } catch {
      toast.error("Failed to accept!");
    }
  };

  const handleReject = async (senderId) => {
    try {
      await update(ref(db), {
        [`usersData/${currentUser.uid}/followRequests/received/${senderId}`]: null,
        [`usersData/${senderId}/followRequests/sent/${currentUser.uid}`]: null,
      });
      toast.info("Friend request rejected ❌");
    } catch {
      toast.error("Failed to reject!");
    }
  };

  return (
    <div className="container mt-3">
      <h4>Requested</h4>
      {requests.length === 0 ? (
        <p>No requests</p>
      ) : (
        requests.map((req) => (
          <div
            key={req.uid}
            className="border p-2 mb-2 d-flex align-items-center justify-content-between rounded shadow-sm"
          >
            <div
              className="d-flex align-items-center"
              style={{ cursor: "pointer" }}
              onClick={() => navigate(`/user-profile/${req.uid}`)}
            >
              <img
                src={req.photoURL || "https://via.placeholder.com/50"}
                alt="DP"
                style={{ width: 40, height: 40, borderRadius: "50%", marginRight: 10 }}
              />
              <span>{req.username || req.uid}</span>
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-success" onClick={() => handleAccept(req.uid)}>
                Accept
              </button>
              <button className="btn btn-sm btn-outline-danger" onClick={() => handleReject(req.uid)}>
                Reject
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
