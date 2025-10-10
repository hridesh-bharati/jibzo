// src/App.jsx
import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Components
import PrivateRoute from "./assets/Navbar/PrivateRoute";
import Loader from "./assets/Loader/Loader";
import BottomFooter from "./assets/Navbar/BottomFotter";
import InstallPrompt from "./assets/Pwa/InstallApp";

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
import Friends from "./assets/users/Friends";
import UploadPost from "./assets/uploads/UploadPost";
import GetPost from "./assets/uploads/GetPost";
import Messages from "./assets/messages/Messages";
import UploadStatus from "./assets/Status/UploadStatus";
import ViewStatus from "./assets/Status/ViewStatuses";
import DeleteAccount from "./assets/users/DeleteAccount";
import Support from "./assets/users/Support";
import Blocked from "./assets/users/Blocked";

// Gadgets & Tools
import GadgetsTools from "./assets/Gadgets/GadgetsTools";
import FileConverter from "./assets/Gadgets/FileConverter";
import ImageCompressor from "./assets/Gadgets/ImageCompressor";
import ImageResizer from "./assets/Gadgets/ImageResizer";
import FaceSticker from "./assets/Gadgets/AiModel/FaceSticker";
import AgeCalculator from "./assets/Gadgets/AgeCal/AgeCalculator";

// Context
import { UserRelationsProvider } from "./context/UserRelationsContext";
import Reels from "./assets/uploads/Reels";

// Routes that don't need footer
const NO_FOOTER_ROUTES = ["/", "/login", "/register"];

// Public routes (accessible without authentication)
const publicRoutes = [
  { path: "/register", component: UserRegister },
  { path: "/login", component: Login },
  { path: "/support", component: Support },
  { path: "/gadgets-and-tools", component: GadgetsTools }
];

// Protected routes (require authentication)
const protectedRoutes = [
  { path: "/home", component: Home },
  { path: "/admin-profile", component: Profile },
  { path: "/admin-profile/:uid", component: Profile },
  { path: "/all-insta-users", component: InstaUsers },
  { path: "/user-profile/:uid", component: InstaUserProfile },
  { path: "/followers", component: Followers },
  { path: "/followers/:uid", component: Followers },
  { path: "/following", component: Following },
  { path: "/following/:uid", component: Following },
  { path: "/blocked", component: Blocked },
  { path: "/blocked/:uid", component: Blocked },
  { path: "/requested", component: Requested },
  { path: "/requested/:uid", component: Requested },
  { path: "/friends", component: Friends },
  { path: "/friends/:uid", component: Friends },
  { path: "/user/new/post", component: UploadPost },
  { path: "/user/get-all-post/post", component: GetPost },
  { path: "/post/:postId", component: GetPost },
  { path: "/messages", component: Messages },
  { path: "/messages/:uid", component: Messages },
  { path: "/status/upload", component: UploadStatus },
  { path: "/status", component: ViewStatus },
  { path: "/delete-account", component: DeleteAccount },
  { path: "/reels", component: Reels }
  
];

// Gadgets sub-routes
const gadgetsRoutes = [
  { path: "file-converter", component: FileConverter },
  { path: "image-compression", component: ImageCompressor },
  { path: "image-resizer", component: ImageResizer },
  { path: "face-sticker", component: FaceSticker },
  { path: "age-calculator", component: AgeCalculator }
];

const App = () => {
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        localStorage.setItem("currentUser", JSON.stringify(user));
      } else {
        setUser(null);
        localStorage.removeItem("currentUser");
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // Show loader while checking authentication
  if (loadingAuth) {
    return <Loader />;
  }

  const shouldShowFooter = user && !NO_FOOTER_ROUTES.includes(location.pathname);

  return (
    <UserRelationsProvider>
      <div className="app">
        {/* PWA Install Prompt */}
        <InstallPrompt />
        
        {/* App Routes */}
        <Routes>
          {/* Root redirect */}
          <Route 
            path="/" 
            element={<Navigate to={user ? "/home" : "/login"} replace />} 
          />

          {/* Public Routes */}
          {publicRoutes.map(({ path, component: Component }) => (
            <Route
              key={path}
              path={path}
              element={user ? <Navigate to="/home" replace /> : <Component />}
            />
          ))}

          {/* Protected Routes */}
          {protectedRoutes.map(({ path, component: Component }) => (
            <Route
              key={path}
              path={path}
              element={
                <PrivateRoute user={user}>
                  <Component />
                </PrivateRoute>
              }
            />
          ))}

          {/* Gadgets & Tools nested routes */}
          <Route path="/gadgets-and-tools" element={<GadgetsTools />}>
            <Route index element={<FileConverter />} />
            {gadgetsRoutes.map(({ path, component: Component }) => (
              <Route key={path} path={path} element={<Component />} />
            ))}
          </Route>
          

          {/* Catch-all route */}
          <Route 
            path="*" 
            element={<Navigate to={user ? "/home" : "/login"} replace />} 
          />
        </Routes>

        {/* Footer */}
        {shouldShowFooter && <BottomFooter />}

        {/* Toast Notifications */}
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
      </div>
    </UserRelationsProvider>
  );
};

export default App;