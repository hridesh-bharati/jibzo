import React, { useEffect, useState } from "react";
import { db } from "../../firebaseConfig";
import { ref, get, child } from "firebase/database";
import { Link } from "react-router-dom";

export default function Following() {
  const [followingUsers, setFollowingUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = localStorage.getItem("userUID");
    if (!uid) return;

    const fetchFollowingUsers = async () => {
      try {
        const followingRef = ref(db, `usersData/${uid}/following`);
        const followingSnap = await get(followingRef);

        if (!followingSnap.exists()) {
          setFollowingUsers([]);
          setLoading(false);
          return;
        }

        const followingUIDs = Object.keys(followingSnap.val());

        // Fetch details of all followed users
        const usersData = await Promise.all(
          followingUIDs.map(async (userId) => {
            const userSnap = await get(ref(db, `usersData/${userId}`));
            return userSnap.exists() ? { uid: userId, ...userSnap.val() } : null;
          })
        );

        // Filter out any null (non-existent) users
        setFollowingUsers(usersData.filter(Boolean));
      } catch (err) {
        console.error("Error loading following list:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFollowingUsers();
  }, []);

  if (loading) return <p className="text-center mt-5">Loading...</p>;

  return (
    <div className="container mt-4">
      <h3 className="mb-3">Following</h3>
      {followingUsers.length > 0 ? (
        <ul className="list-group">
          {followingUsers.map((user) => (
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
        <p className="text-muted">You're not following anyone yet.</p>
      )}
    </div>
  );
}
