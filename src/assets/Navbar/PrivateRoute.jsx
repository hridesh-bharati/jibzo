// assets/Navbar/PrivateRoute.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";

const PrivateRoute = ({ user, children }) => {
  const location = useLocation();

  if (!user) {
    // Agar user login nahi hai → login page bhej do
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Agar user login hai → original component render karo
  return children;
};

export default PrivateRoute;
