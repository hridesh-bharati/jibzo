import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebaseConfig";
import { ref, get, update } from "firebase/database";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function InstaUserProfile() {
  const { uid } = useParams(); 
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canView, setCanView] = useState(false);
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userRef = ref(db, `usersData/${uid}`);
        const snapshot = await get(userRef);

        if (!snapshot.exists()) {
          toast.error("User not found!");
          navigate("/all-insta-users");
          return;
        }

        const data = snapshot.val();
        setUserData(data);

        // 🔒 Privacy check
        if (!data.isPrivate) {
          setCanView(true); // Public profile
        } else if (currentUser?.uid === uid) {
          setCanView(true); // Owner can always view
        } else {
          // check if currentUser is in followers
          const followersSnap = await get(ref(db, `usersData/${uid}/followers/${currentUser?.uid}`));
          setCanView(followersSnap.exists());
        }
      } catch (error) {
        console.error(error);
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [uid, currentUser, navigate]);

  // 🔒 Toggle Privacy (Owner only)
  const togglePrivacy = async () => {
    try {
      await update(ref(db, `usersData/${uid}`), { isPrivate: !userData.isPrivate });
      setUserData((prev) => ({ ...prev, isPrivate: !prev.isPrivate }));
      toast.success(userData.isPrivate ? "Profile unlocked (Public)" : "Profile locked (Private)");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update privacy");
    }
  };

  if (loading) return <p className="text-center mt-5">Loading...</p>;
  if (!userData) return <p className="text-center mt-5">No user data found.</p>;

  const isOwner = currentUser?.uid === uid;

  if (!canView) {
    return (
      <div className="container mt-5 text-center">
        <img
          src={userData.photoURL || "https://via.placeholder.com/150"}
          alt="Profile"
          className="rounded-circle mb-3"
          style={{ width: "120px", height: "120px", objectFit: "cover" }}
        />
        <h4>{userData.username || "Unnamed User"}</h4>
        <p className="text-muted">🔒 This profile is private</p>
      </div>
    );
  }

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
        <p><strong>Bio:</strong> {userData.bio || "No bio added."}</p>
        <p><strong>Joined:</strong> {userData.createdAt ? new Date(userData.createdAt).toLocaleString() : "N/A"}</p>

        {!isOwner && (
          <button className="btn btn-primary mt-3" onClick={() => navigate(`/messages/${uid}`)}>
            Chat
          </button>
        )}

        {isOwner && (
          <button className="btn btn-warning mt-3" onClick={togglePrivacy}>
            {userData.isPrivate ? "Unlock Profile 🔓" : "Lock Profile 🔒"}
          </button>
        )}
      </div>
    </div>
  );
}
