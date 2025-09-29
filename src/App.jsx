// App.jsx
import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Components
import PrivateRoute from "./assets/Navbar/PrivateRoute";
import Loader from "./assets/Loader/Loader";
import BottomFooter from "./assets/Navbar/BottomFotter";

// Pages
import UserRegister from "./assets/users/UserRegister";
import Login from "./assets/users/Login";
import Home from "./assets/Home/Home";
import Profile from "./assets/users/AdminProfile";
import InstaUsers from "./assets/users/InstaUsers";
import InstaUserProfile from "./assets/users/InstaUserProfile";
import Followers from "./assets/users/Followers";
import Following from "./assets/users/Following";
import Requested from "./assets/users/Requested";
import UploadPost from "./assets/uploads/UploadPost";
import GetPost from "./assets/uploads/GetPost";
import Messages from "./assets/messages/Messages";
import UploadStatus from "./assets/Status/UploadStatus";
import ViewStatus from "./assets/Status/ViewStatuses";
import DeleteAccount from "./assets/users/DeleteAccount";
import Support from "./assets/users/Support";
import Blocked from "./assets/users/Blocked";
import { UserRelationsProvider } from "./context/UserRelationsContext";
import GadgetsTools from "./assets/Gadgets/GadgetsTools";
import FileConverter from "./assets/Gadgets/FileConverter";
import ImageCompressor from "./assets/Gadgets/ImageCompressor";
import ImageResizer from "./assets/Gadgets/ImageResizer";
import InstallPrompt from "./assets/Pwa/InstallApp";

const App = () => {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        localStorage.setItem("currentUser", JSON.stringify(u));
      } else {
        setUser(null);
        localStorage.removeItem("currentUser");
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  if (loadingAuth) return <Loader />;

  return (
    <UserRelationsProvider>

      <>
        <InstallPrompt />
        <Routes>
          {/* Root redirects to login */}
          <Route path="/" element={<Navigate to="/login" />} />

          {/* Public Routes */}
          <Route
            path="/register"
            element={user ? <Navigate to="/home" /> : <UserRegister />}
          />
          <Route
            path="/login"
            element={user ? <Navigate to="/home" /> : <Login />}
          />

          {/* Protected Routes */}
          <Route
            path="/home"
            element={<PrivateRoute user={user}><Home /></PrivateRoute>}
          />

          {/* Profile Routes */}
          <Route
            path="/admin-profile"
            element={<PrivateRoute user={user}><Profile /></PrivateRoute>}
          />
          <Route
            path="/admin-profile/:uid"
            element={<PrivateRoute user={user}><Profile /></PrivateRoute>}
          />

          {/* User Discovery Routes */}
          <Route
            path="/all-insta-users"
            element={<PrivateRoute user={user}><InstaUsers /></PrivateRoute>}
          />
          <Route
            path="/user-profile/:uid"
            element={<PrivateRoute user={user}><InstaUserProfile /></PrivateRoute>}
          />

          {/* Relationship Routes */}
          <Route
            path="/followers/:uid?"
            element={<PrivateRoute user={user}><Followers /></PrivateRoute>}
          />
          <Route
            path="/following/:uid?"
            element={<PrivateRoute user={user}><Following /></PrivateRoute>}
          />
          <Route
            path="/blocked/:uid?"  // FIXED: Removed double slash
            element={<PrivateRoute user={user}><Blocked /></PrivateRoute>}
          />
          <Route
            path="/requested/:uid?"
            element={<PrivateRoute user={user}><Requested /></PrivateRoute>}
          />

          {/* Content Routes */}
          <Route
            path="/user/new/post"
            element={<PrivateRoute user={user}><UploadPost /></PrivateRoute>}
          />
          <Route
            path="/user/get-all-post/post"
            element={<PrivateRoute user={user}><GetPost /></PrivateRoute>}
          />
          <Route
            path="/post/:postId"
            element={<PrivateRoute user={user}><GetPost /></PrivateRoute>}
          />

          {/* Messaging Routes */}
          <Route
            path="/messages/:uid?"
            element={<PrivateRoute user={user}><Messages /></PrivateRoute>}
          />

          {/* Status Routes */}
          <Route
            path="/status/upload"
            element={<PrivateRoute user={user}><UploadStatus /></PrivateRoute>}
          />

          {/* Account Management Routes */}
          <Route
            path="/delete-account"
            element={<PrivateRoute user={user}><DeleteAccount /></PrivateRoute>}
          />

          {/* Public Routes */}
          <Route path="/status" element={<ViewStatus />} />
          <Route path="/support" element={<Support />} />

          <Route path="/gadgets-and-tools" element={<GadgetsTools />}>
            <Route index element={<h4 className="text-center mt-3">Welcome to Gadgets & Tools</h4>} />
            <Route path="file-converter" element={<FileConverter />} />
            <Route path="image-compression" element={<ImageCompressor />} />
            <Route path="image-resizer" element={<ImageResizer />} />
          </Route>

          {/* Catch-all route for 404 */}
          <Route path="*" element={<Navigate to="/home" />} />
        </Routes>

        {/* Footer only if logged in and not on login/register/root */}
        {user && !["/", "/login", "/register"].includes(location.pathname) && (
          <BottomFooter />
        )}

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
    </UserRelationsProvider>

  );
};

export default App;