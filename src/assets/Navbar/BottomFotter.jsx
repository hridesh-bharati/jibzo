import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FaHome,
  FaFileImage,
  FaCamera,
  FaUsers,
  FaRegImage,
  FaRegCircle, // using this as status icon
} from "react-icons/fa";
import { auth, db } from "../../assets/utils/firebaseConfig";
import { ref, onValue } from "firebase/database";
import { IoMdPhotos } from "react-icons/io";
import { HiOutlineStatusOnline } from "react-icons/hi";
const buttonStyle = (isActive) => ({
  width: 50,
  height: 50,
  borderRadius: "50%",
  backgroundColor: isActive ? "#007AFF" : "transparent",
  border: "none",
  color: isActive ? "#fff" : "#1e3a8a",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 600,
  position: "relative",
  transition: "all 0.3s ease-in-out",
  boxShadow: isActive ? "0 4px 12px rgba(0, 122, 255, 0.4)" : "none",
  overflow: "hidden",
  zIndex: 1100,
});

export default function BottomFooter() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.pathname);
  const [photoURL, setPhotoURL] = useState(null);

  useEffect(() => {
    setActiveTab(location.pathname);

    const uid = auth.currentUser?.uid;
    if (uid) {
      const userRef = ref(db, `usersData/${uid}`);
      onValue(userRef, (snapshot) => {
        const data = snapshot.val();
        if (data?.photoURL) setPhotoURL(data.photoURL);
      });
    }
  }, [location]);

  const navItems = [
    { path: "/home", label: "Home", icon: <FaHome size={21} /> },
    { path: "/user/get-all-post/post", label: "Gallery", icon: <FaRegImage size={21} /> },
    { path: "/user/new/post", label: "Upload", icon: <FaCamera size={21} /> },
    { path: "/all-insta-users", label: "Users", icon: <FaUsers size={21} /> },
    { path: "/status", label: "Story", icon: <HiOutlineStatusOnline size={21} /> },
    {
      path: "/admin-profile",
      label: "Profile",
      icon: photoURL ? (
        <img
          src={photoURL}
          alt="Profile"
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#ccc",
          }}
        />
      ),
    },
  ];

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        height: 60,
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(12px)",
        // borderRadius: 40,
        boxShadow: "0 12px 30px rgba(0,0,0,0.15)",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        padding: "0 1px",
        zIndex: 1000,
        // fontFamily:          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
      }}
    >
      {navItems.map(({ path, label, icon }) => {
        const isActive = activeTab === path;
        return (
          <Link
            to={path}
            key={path}
            aria-label={label}
            style={{ textDecoration: "none" }}
          >
            <button
              aria-current={isActive ? "page" : undefined}
              style={buttonStyle(isActive)}
            >
              {icon}
              <span
                style={{
                  fontSize: 10,
                  marginTop: 4,
                  color: isActive ? "#fff" : "#1e3a8a",
                }}
              >
                {label}
              </span>
            </button>
          </Link>
        );
      })}
    </nav>
  );
}
