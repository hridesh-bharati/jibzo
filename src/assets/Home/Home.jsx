import React, { useEffect, useState } from "react";
import Navbar from "../Navbar/Navbar";
import { db } from "../../assets/utils/firebaseConfig";
import { ref, onValue, update, get } from "firebase/database";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import SnapStarBar from "./SnapStarBar";
import "./Home.css";
import GetPost from '../uploads/GetPost'
import { SnapStarBarPlaceholder } from "./SnapStarBarPlaceholder";
const Home = () => {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [followingList, setFollowingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const navigate = useNavigate();
  const auth = getAuth();

  // 🔐 Check login status and set current user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/login");
      } else {
        setCurrentUser(user);
        setAuthChecked(true);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // 🔄 Load users (real-time)
  useEffect(() => {
    if (!authChecked) return;

    const usersRef = ref(db, "usersData");

    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const usersArray = Object.entries(data).map(([uid, userData]) => ({
          uid,
          ...userData,
        }));

        usersArray.sort((a, b) => {
          if (a.username === "admin") return -1;
          if (b.username === "admin") return 1;
          return 0;
        });

        setUsers(usersArray);
      } else {
        setUsers([]);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [authChecked]);

  // 🔄 Fetch following list in real-time
  useEffect(() => {
    if (!currentUser?.uid) return;

    const followingRef = ref(db, `usersData/${currentUser.uid}/following`);
    const unsubscribe = onValue(followingRef, (snapshot) => {
      setFollowingList(snapshot.exists() ? Object.keys(snapshot.val()) : []);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // ✅ Follow / Unfollow logic
  const handleFollowToggle = async (targetUID) => {
    if (!currentUser || currentUser.uid === targetUID) return;

    const currentUID = currentUser.uid;
    const isFollowing = followingList.includes(targetUID);
    const updates = {};

    if (isFollowing) {
      updates[`usersData/${currentUID}/following/${targetUID}`] = null;
      updates[`usersData/${targetUID}/followers/${currentUID}`] = null;
    } else {
      updates[`usersData/${currentUID}/following/${targetUID}`] = true;
      updates[`usersData/${targetUID}/followers/${currentUID}`] = true;
    }

    try {
      await update(ref(db), updates);
      toast.success(isFollowing ? "Unfollowed" : "Followed");
    } catch (error) {
      console.error("Follow toggle failed:", error);
      toast.error("Failed to update follow status");
    }
  };

  if (!authChecked) return null;

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container mt-5 text-center">
          <SnapStarBarPlaceholder />
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="container mt-4">
        <SnapStarBar
          users={users}
          currentUser={currentUser}
          followingList={followingList}
          handleFollowToggle={handleFollowToggle}
        />

        <div className="mb-5 pb-4">
       <GetPost showFilter={false} shuffle={true} />
        </div>
      </div>
    </>
  );
};

export default Home;
