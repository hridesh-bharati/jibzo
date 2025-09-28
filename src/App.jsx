import React, { useEffect, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import PrivateRoute from "./assets/Navbar/PrivateRoute";
import Loader from "./assets/Loader/Loader";
import BottomFooter from "./assets/Navbar/BottomFotter";
import { useAuth } from "./hooks/useAuth";
import { useFCM } from "./hooks/useFCM";
import FloatingNotifications from "./assets/messages/FloatingNotifications";

// Lazy-loaded pages
const UserRegister = React.lazy(() => import("./assets/users/UserRegister"));
const Login = React.lazy(() => import("./assets/users/Login"));
const Home = React.lazy(() => import("./assets/Home/Home"));
const Profile = React.lazy(() => import("./assets/users/AdminProfile"));
const InstaUsers = React.lazy(() => import("./assets/users/InstaUsers"));
const InstaUserProfile = React.lazy(() => import("./assets/users/InstaUserProfile"));
const Followers = React.lazy(() => import("./assets/users/Followers"));
const Following = React.lazy(() => import("./assets/users/Following"));
const Requested = React.lazy(() => import("./assets/users/Requested"));
const UploadPost = React.lazy(() => import("./assets/uploads/UploadPost"));
const GetPost = React.lazy(() => import("./assets/uploads/GetPost"));
const Messages = React.lazy(() => import("./assets/messages/Messages"));
const UploadStatus = React.lazy(() => import("./assets/Status/UploadStatus"));
const ViewStatus = React.lazy(() => import("./assets/Status/ViewStatuses"));
const DeleteAccount = React.lazy(() => import("./assets/users/DeleteAccount"));
const Support = React.lazy(() => import("./assets/users/Support"));

const FOOTER_EXCLUDE_PATHS = ["/", "/login", "/register"];

const App = () => {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { initializeFCM } = useFCM();

  useEffect(() => {
    if (user) initializeFCM(user);
  }, [user, initializeFCM]);

  if (authLoading) return <Loader />;

  const shouldShowFooter = user && !FOOTER_EXCLUDE_PATHS.includes(location.pathname);

  return (
    <>
    <FloatingNotifications/>
      <Suspense fallback={<Loader />}>
      <Routes>
          <Route path="/" element={<Navigate to={user ? "/home" : "/login"} />} />
          <Route path="/register" element={user ? <Navigate to="/home" /> : <UserRegister />} />
          <Route path="/login" element={user ? <Navigate to="/home" /> : <Login />} />
          <Route path="/status" element={<ViewStatus />} />
          <Route path="/support" element={<Support />} />

          {/* Protected routes */}
          <Route path="/home" element={<PrivateRoute user={user}><Home /></PrivateRoute>} />
          <Route path="/admin-profile" element={<PrivateRoute user={user}><Profile /></PrivateRoute>} />
          <Route path="/all-insta-users" element={<PrivateRoute user={user}><InstaUsers /></PrivateRoute>} />
          <Route path="/user-profile/:uid" element={<PrivateRoute user={user}><InstaUserProfile /></PrivateRoute>} />
          <Route path="/followers/:uid?" element={<PrivateRoute user={user}><Followers /></PrivateRoute>} />
          <Route path="/following/:uid?" element={<PrivateRoute user={user}><Following /></PrivateRoute>} />
          <Route path="/requested/:uid?" element={<PrivateRoute user={user}><Requested /></PrivateRoute>} />
          <Route path="/user/new/post" element={<PrivateRoute user={user}><UploadPost /></PrivateRoute>} />
          <Route path="/user/get-all-post/post" element={<PrivateRoute user={user}><GetPost /></PrivateRoute>} />
          <Route path="/post/:postId" element={<PrivateRoute user={user}><GetPost /></PrivateRoute>} />
          <Route path="/messages/:uid?" element={<PrivateRoute user={user}><Messages /></PrivateRoute>} />
          <Route path="/status/upload" element={<PrivateRoute user={user}><UploadStatus /></PrivateRoute>} />
          <Route path="/delete-account" element={<PrivateRoute user={user}><DeleteAccount /></PrivateRoute>} />

          <Route path="*" element={<Navigate to={user ? "/home" : "/login"} />} />
        </Routes>
      </Suspense>

      {shouldShowFooter && <BottomFooter />}

      <ToastContainer
        position="top-right"
        autoClose={5000}
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
