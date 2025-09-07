import React, { useEffect, useState } from "react";
import { db } from "../../firebaseConfig";
import { ref, get } from "firebase/database";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function InstaUserProfile() {
  const { uid } = useParams(); // Get UID from URL
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userRef = ref(db, `usersData/${uid}`);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
          setUserData(snapshot.val());
        } else {
          toast.error("User not found!");
          navigate("/all-insta-users");
        }
      } catch (error) {
        console.error(error);
        toast.error("Failed to load user profile");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [uid, navigate]);

  if (loading) return <p className="text-center mt-5">Loading...</p>;
  if (!userData) return <p className="text-center mt-5">No user data found.</p>;

  return (
    <div className="container mt-5" style={{ maxWidth: 500 }}>
      <div className="card p-4 shadow-sm text-center">
        <img
          src={userData.photoURL || "https://via.placeholder.com/150"}
          alt="Profile"
          className="rounded-circle mb-3"
          style={{ width: "120px", height: "120px", objectFit: "cover" }}
        />
        <h4>{userData.username || "Unnamed User"}</h4>
        <p className="text-muted">{userData.email || "No email"}</p>
        <hr />
        <p>
          <strong>Bio:</strong> {userData.bio || "No bio added."}
        </p>
        <p>
          <strong>Joined:</strong>{" "}
          {userData.createdAt
            ? new Date(userData.createdAt).toLocaleString()
            : "N/A"}
        </p>

        {/* Chat Button */}
        <button
          className="btn btn-primary mt-3"
          onClick={() => navigate(`/messages/${uid}`)}
        >
          Chat
        </button>
      </div>
    </div>
  );
}
