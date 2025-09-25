// src\assets\users\InstaUserProfile.jsx

import React, { useEffect, useState } from "react";
import { db, auth } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update } from "firebase/database";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import GetPost from "../uploads/GetPost";
import { useNavigate } from "react-router-dom";
export default function UserProfile() {
  const { uid } = useParams();
  const [userData, setUserData] = useState(null);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;
  const navigate = useNavigate();
  // 🔹 Fetch profile user data
  useEffect(() => {
    if (!uid) return;
    const userRef = ref(db, `usersData/${uid}`);
    const unsubscribeUser = onValue(userRef, (snap) => {
      if (snap.exists()) setUserData(snap.val());
      setLoading(false);
    });

    return () => unsubscribeUser();
  }, [uid]);

  // 🔹 Fetch current logged in user data
  useEffect(() => {
    if (!currentUser) return;
    const curRef = ref(db, `usersData/${currentUser.uid}`);
    return onValue(curRef, (snap) => {
      if (snap.exists()) setCurrentUserData(snap.val());
    });
  }, [currentUser]);

  if (loading) return <p className="text-center mt-5">Loading profile...</p>;
  if (!userData) return <p className="text-center mt-5">No user found</p>;

  // 🔒 Lock & Friends logic
  const isLocked = userData?.isLocked === true;
  const isFriend =
    currentUser &&
    (userData?.friends?.[currentUser.uid] ||
      currentUserData?.friends?.[uid]);
  const isFollowing = currentUser && userData?.followers?.[currentUser.uid];
  const hasRequested =
    currentUser &&
    userData?.followRequests?.received &&
    Object.keys(userData.followRequests.received || {}).includes(
      currentUser.uid
    );

  // ✅ Follow / Unfollow / Request handlers
  const sendRequest = async () => {
    if (!currentUser) return toast.error("Login first!");
    await update(ref(db), {
      [`usersData/${uid}/followRequests/received/${currentUser.uid}`]: true,
      [`usersData/${currentUser.uid}/followRequests/sent/${uid}`]: true,
    });
    toast.success("Follow request sent ✅");
  };

  const cancelRequest = async () => {
    if (!currentUser) return;
    await update(ref(db), {
      [`usersData/${uid}/followRequests/received/${currentUser.uid}`]: null,
      [`usersData/${currentUser.uid}/followRequests/sent/${uid}`]: null,
    });
    toast.info("Request canceled ❌");
  };

  const unfollow = async () => {
    if (!currentUser) return;
    await update(ref(db), {
      [`usersData/${uid}/followers/${currentUser.uid}`]: null,
      [`usersData/${currentUser.uid}/following/${uid}`]: null,
      [`usersData/${uid}/friends/${currentUser.uid}`]: null,
      [`usersData/${currentUser.uid}/friends/${uid}`]: null,
      [`usersData/${currentUser.uid}/followRequests/sent/${uid}`]: null,
      [`usersData/${uid}/followRequests/received/${currentUser.uid}`]: null,
    });
    toast.info("Unfollowed");
  };

  return (
    <div className="container mx-auto p-0">
      {/* Wallpaper & Profile */}
      <div className="w-100 bg-dark">
        <div
          className="position-relative w-100 mb-5 pb-3"
          style={{
            backgroundImage: `url(${userData.wallpaper || "https://via.placeholder.com/900x200"
              })`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            height: "170px",
          }}
        >
          <div
            className="position-absolute d-flex align-items-center justify-content-start w-100 px-2"
            style={{ top: "85%", transform: "translateY(-50%)" }}
          >
            {/* DP */}
            <img
              src={userData.photoURL || "icons/avatar.jpg"}
              alt="Profile"
              className="rounded-circle shadow-sm border border-3"
              width={120}
              height={120}
              style={{ objectFit: "cover" }}
            />
          </div>
        </div>
      </div>

      {/* Follow / Unfollow */}
      {currentUser?.uid !== uid && (
        <div className="text-end me-2">
          {isFriend || isFollowing ? (
            <button className="btn btn-sm btn-danger" onClick={unfollow}>
              Unfollow
            </button>
          ) : hasRequested ? (
            <button
              className="btn btn-sm btn-secondary"
              onClick={cancelRequest}
            >
              Cancel Request
            </button>
          ) : (
            <button className="btn btn-sm btn-primary" onClick={sendRequest}>
              Follow
            </button>
          )}
        </div>
      )}

      <div className="ms-3 small">
        <h5 className="fw-bolder">{userData.username}</h5>
        {currentUser?.uid !== uid && (
          <p className="fw-bolder text-muted">{userData.email}</p>
        )}
      </div>

      {/* Locked Profile */}
      {isLocked && !isFriend && currentUser?.uid !== uid ? (
        <div
          className="d-flex flex-column align-items-center justify-content-center text-muted"
          style={{ minHeight: "30vh" }}
        >
          <i className="bi bi-person-heart display-1 mb-3 fs-1 text-secondary"></i>
          <h2 className="fw-bold">This profile is locked 🔒</h2>
          <p className="mt-2">Follow to see posts and details</p>
        </div>
      ) : (
        <>
          {/* Followers / Following */}
          <div className="d-flex gap-2 m-3 flex-wrap">
            <Link
              to={`/followers/${uid}`}
              className="btn btn-sm btn-outline-primary"
            >
              Followers:{" "}
              {userData.followers ? Object.keys(userData.followers).length : 0}
            </Link>
            <Link
              to={`/following/${uid}`}
              className="btn btn-sm btn-outline-success"
            >
              Following:{" "}
              {userData.following ? Object.keys(userData.following).length : 0}
            </Link>
            {currentUser?.uid === uid && userData.followRequests?.received && (
              <Link
                to={`/requested/${uid}`}
                className="btn btn-sm btn-outline-warning"
              >
                Requests:{" "}
                {Object.keys(userData.followRequests.received).length}
              </Link>
            )}
          </div>
          {currentUser?.uid !== uid && (
            <button
              className="btn chat-3d-btn m-2"
              onClick={() => navigate(`/messages/${uid}`)}
            >
              Chat with {userData.username}
            </button>
          )}
          {/* Bio */}
          <p className="m-3">{userData.bio || "No bio"}</p>
          <GetPost uid={uid} />
        </>
      )}
    </div>
  );
}
