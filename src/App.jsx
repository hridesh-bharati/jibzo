import React, { useEffect, useState } from "react";
import { Route, Routes, useLocation, Navigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// Toastify import
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import UserRegister from "./assets/users/UserRegister";
import Login from "./assets/users/Login";
import Home from "./assets/Home/Home";
import BottomFooter from "./assets/Navbar/BottomFotter";
import Profile from "./assets/users/AdminProfile";
import InstaUsers from "./assets/users/InstaUsers";
import InstaUserProfile from "./assets/users/InstaUserProfile";
import Followers from "./assets/users/Followers";
import Following from "./assets/users/Following";
import UploadPost from "./assets/uploads/UploadPost";
import GetPost from "./assets/uploads/GetPost";
import Messages from "./assets/messages/Messages";
import Loader from "./assets/Loader/Loader";
import Requested from "./assets/users/Requested";

const App = () => {
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem("currentUser");
    return cached ? JSON.parse(cached) : null;
  });
  const [loadingAuth, setLoadingAuth] = useState(true);
  const location = useLocation();

  // Auth state listener
  useEffect(() => {
    const auth = getAuth();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoadingAuth(false);
      if (u) localStorage.setItem("currentUser", JSON.stringify(u));
      else localStorage.removeItem("currentUser");
    });
  }, []);

  if (loadingAuth) return <Loader />;

  return (
    <>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/home" /> : <UserRegister />} />
        <Route path="/register" element={user ? <Navigate to="/home" /> : <UserRegister />} />
        <Route path="/login" element={user ? <Navigate to="/home" /> : <Login />} />
        <Route path="/home" element={user ? <Home /> : <Navigate to="/login" />} />
        <Route path="/followers" element={user ? <Followers /> : <Navigate to="/login" />} />
        <Route path="/following" element={user ? <Following /> : <Navigate to="/login" />} />
        <Route path="/Requested" element={user ? <Requested /> : <Navigate to="/login" />} />

        <Route path="/followers/:uid" element={<Followers />} />
        <Route path="/following/:uid" element={<Following />} />
        <Route path="/requested/:uid" element={<Requested />} />
        <Route path="/all-insta-users" element={user ? <InstaUsers /> : <Navigate to="/login" />} />
        <Route path="/admin-profile" element={user ? <Profile /> : <Navigate to="/login" />} />
        <Route path="/user-profile/:uid" element={user ? <InstaUserProfile /> : <Navigate to="/login" />} />
        <Route path="/user/new/post" element={user ? <UploadPost /> : <Navigate to="/login" />} />
        <Route path="/post/:postId" element={<GetPost />} />
        <Route path="/user/get-all-post/post" element={user ? <GetPost /> : <Navigate to="/login" />} />
        <Route path="/messages/:uid" element={user ? <Messages /> : <Navigate to="/login" />} />
        <Route path="/messages" element={user ? <Messages /> : <Navigate to="/login" />} />
      </Routes>

      {user && !["/login", "/register", "/"].includes(location.pathname) && <BottomFooter />}

      {/* 🔹 Toast container (global notifications) */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        pauseOnHover
        draggable
        theme="colored"
      />
    </>
  );
};

export default App;
