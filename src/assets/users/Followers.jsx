import React, { useEffect, useState } from "react";
import { db } from "../../firebaseConfig";
import { ref, get } from "firebase/database";
import { Link } from "react-router-dom";

export default function Followers() {
  const [followersList, setFollowersList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = localStorage.getItem("userUID");
    if (!uid) return;

    const fetchFollowers = async () => {
      try {
        const followersRef = ref(db, `usersData/${uid}/followers`);
        const followersSnap = await get(followersRef);

        if (!followersSnap.exists()) {
          setFollowersList([]);
          setLoading(false);
          return;
        }

        const followerUIDs = Object.keys(followersSnap.val());

        const usersData = await Promise.all(
          followerUIDs.map(async (userId) => {
            const userSnap = await get(ref(db, `usersData/${userId}`));
            return userSnap.exists() ? { uid: userId, ...userSnap.val() } : null;
          })
        );

        setFollowersList(usersData.filter(Boolean));
      } catch (error) {
        console.error("Error fetching followers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowers();
  }, []);

  if (loading) return <p className="text-center mt-5">Loading followers...</p>;

  return (
    <div className="container mt-4">
      <h3 className="mb-3">Followers</h3>
      {followersList.length > 0 ? (
        <ul className="list-group">
          {followersList.map((user) => (
            <Link
              key={user.uid}
              to={`/user-profile/${user.uid}`}
              className="list-group-item list-group-item-action d-flex align-items-center"
              style={{ textDecoration: "none", cursor: "pointer" }}
            >
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
            </Link>
          ))}
        </ul>
      ) : (
        <p className="text-muted">You don't have any followers yet.</p>
      )}
    </div>
  );
}
