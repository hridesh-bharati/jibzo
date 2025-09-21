import React from "react";
import { Link } from "react-router-dom";

// Shuffle function to randomize array order
function shuffleArray(array) {
  return array
    .map((item) => ({ item, sortKey: Math.random() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ item }) => item);
}

export default function SnapStarBar({ users, currentUser, followingList, handleFollowToggle }) {
  if (!currentUser) return null;

  // Filter out currentUser and then shuffle the rest
  const filteredUsers = shuffleArray(users.filter((user) => user.uid !== currentUser.uid));

  return (
    <div className="d-flex overflow-auto gap-3 px-2 pb-3 snap-star-bar">
      {/* {filteredUsers.length === 0 && <p>No users found</p>} */}
      {filteredUsers.map((user, index) => {
        const isAdmin = user.username === "admin";
        const isFollowing = followingList.includes(user.uid);

        return (
          <div
            key={`${user.uid}-${index}`} // ensures uniqueness
            className="d-flex flex-column align-items-center justify-content-center"
            style={{
              minWidth: 100,
              padding: 8,
              borderRadius: 12,
              backgroundColor: "#f8f9fa",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            }}
          >
            <Link to={`/user-profile/${user.uid}`}>
              <img
                src={user.photoURL || "icons/avatar.jpg"}
                alt={user.username || user.email || "User"}
                className="rounded-circle mb-2"
                style={{
                  width: 70,
                  height: 70,
                  objectFit: "cover",
                  border: `3px solid ${isAdmin ? "#007AFF" : "#ccc"}`,
                }}
              />
            </Link>

            <div
              className="fw-semibold text-dark text-center"
              style={{ fontSize: "13px", maxWidth: 80, overflowWrap: "break-word" }}
            >
              {isAdmin ? "Snap Star" : user.username || "User"}
            </div>

            <button
              onClick={() => handleFollowToggle(user.uid)}
              className={`btn btn-sm mt-1 ${isFollowing ? "btn-outline-secondary" : "btn-primary"}`}
              style={{ fontSize: "12px", padding: "2px 8px" }}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          </div>
        );
      })}

    </div>
  );
}
