import React, { useEffect, useState } from "react";
import { Route, Routes, useLocation, Navigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";

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
import Loader from "./assets/Home/Loader"
const App = () => {
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem("currentUser");
    return cached ? JSON.parse(cached) : null;
  });
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const location = useLocation();

  // Firebase auth
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
      if (currentUser) localStorage.setItem("currentUser", JSON.stringify(currentUser));
      else localStorage.removeItem("currentUser");
    });
    return () => unsubscribe();
  }, []);

  // PWA Install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") console.log("✅ User accepted PWA install");
    else console.log("❌ User dismissed PWA install");
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleClosePrompt = () => setShowPrompt(false);

  if (loadingAuth) return <Loader />;

  return (
    <>
      {/* Routes with auth protection */}
      <Routes>
        <Route
          path="/"
          element={user ? <Navigate to="/home" /> : <UserRegister />}
        />
        <Route
          path="/register"
          element={user ? <Navigate to="/home" /> : <UserRegister />}
        />
        <Route
          path="/login"
          element={user ? <Navigate to="/home" /> : <Login />}
        />
        <Route
          path="/home"
          element={user ? <Home /> : <Navigate to="/login" />}
        />
        <Route
          path="/followers"
          element={user ? <Followers /> : <Navigate to="/login" />}
        />
        <Route
          path="/following"
          element={user ? <Following /> : <Navigate to="/login" />}
        />
        <Route
          path="/all-insta-users"
          element={user ? <InstaUsers /> : <Navigate to="/login" />}
        />
        <Route
          path="/admin-profile"
          element={user ? <Profile /> : <Navigate to="/login" />}
        />
        <Route
          path="/user-profile/:uid"
          element={user ? <InstaUserProfile /> : <Navigate to="/login" />}
        />
        <Route
          path="/user/new/post"
          element={user ? <UploadPost /> : <Navigate to="/login" />}
        />
        <Route
          path="/user/get-all-post/post"
          element={user ? <GetPost /> : <Navigate to="/login" />}
        />
        <Route
          path="/messages/:uid"
          element={user ? <Messages /> : <Navigate to="/login" />}
        />
        <Route
          path="/messages"
          element={user ? <Messages /> : <Navigate to="/login" />}
        />
      </Routes>

      {/* Footer only for logged-in users */}
      {user && !["/login", "/register", "/"].includes(location.pathname) && (
        <BottomFooter />
      )}

      {/* PWA Install Toast Top Middle */}
      {showPrompt && (
        <div
          className="position-fixed top-0 start-50 translate-middle-x mt-3 p-3 rounded shadow bg-dark text-white d-flex justify-content-between align-items-center"
          style={{ zIndex: 1050, minWidth: "300px", maxWidth: "90%" }}
        >
          <span>📲 Install Jibzo App?</span>
          <div className="d-flex gap-2">
            <button className="btn btn-sm btn-primary" onClick={handleInstall}>
              Install
            </button>
            <button className="btn btn-sm btn-secondary" onClick={handleClosePrompt}>
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default App;



