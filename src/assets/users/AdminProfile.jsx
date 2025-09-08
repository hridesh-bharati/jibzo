import React, { useEffect, useState } from "react";
import { db, auth } from "../../firebaseConfig";
import { ref, onValue } from "firebase/database";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const AdminProfile = () => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      navigate("/login");
      return;
    }

    const userRef = ref(db, `usersData/${currentUser.uid}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setProfileData({
          ...data,
          followers: data.followers ? Object.keys(data.followers).length : 0,
          following: data.following ? Object.keys(data.following).length : 0,
          posts: data.posts ? Object.values(data.posts) : [],
          reels: data.reels ? Object.values(data.reels) : [],
        });
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  if (loading) return <p>Loading profile...</p>;
  if (!profileData) return <p>No profile data found.</p>;

  return (
    <div className="container my-5" style={{ maxWidth: 900 }}>
      <div className="d-flex align-items-center mb-4">
        <img
          src={profileData.photoURL || "https://via.placeholder.com/150"}
          alt="Profile"
          className="rounded-circle"
          width={150}
          height={150}
          style={{ objectFit: "cover" }}
        />
        <div className="ms-4">
          <h2>{profileData.username}</h2>
          <p><strong>Email:</strong> {profileData.email || "Not provided"}</p>
          <p><strong>Password:</strong> {"••••••••"}</p>
          <p>
            <strong>Joined:</strong>{" "}
            {profileData.createdAt ? new Date(profileData.createdAt).toLocaleDateString() : "N/A"}
          </p>
          <p><strong>Followers:</strong> {profileData.followers}</p>
          <p><strong>Following:</strong> {profileData.following}</p>
        </div>
      </div>

      <hr />

      <h4>Posts</h4>
      <div className="row g-3 mb-4">
        {profileData.posts.length > 0 ? (
          profileData.posts.map((post, idx) => (
            <div key={idx} className="col-12 col-sm-6 col-md-4">
              <div className="card shadow-sm">
                <img
                  src={post.image}
                  className="card-img-top rounded"
                  alt={post.caption || ""}
                  style={{ objectFit: "cover", height: 200 }}
                />
                <div className="card-body">
                  <p className="card-text">{post.caption}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p>No posts available</p>
        )}
      </div>

      <h4>Reels</h4>
      <div className="row g-3 mb-4">
        {profileData.reels.length > 0 ? (
          profileData.reels.map((reel, idx) => (
            <div key={idx} className="col-12 col-md-6">
              <div className="card shadow-sm">
                <video
                  controls
                  src={reel.video}
                  className="card-img-top rounded"
                  style={{ maxHeight: 350, objectFit: "cover" }}
                />
                <div className="card-body">
                  <p className="card-text">{reel.caption}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p>No reels available</p>
        )}
      </div>

      <button className="btn btn-outline-danger mt-3" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
};

export default AdminProfile;
