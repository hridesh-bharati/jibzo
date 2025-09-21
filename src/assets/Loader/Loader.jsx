import React from "react";
import "./Loader.css";

const Loader = () => {
  return (
    <div className="loader-overlay">
      <div className="loader">
        <div className="loader-circle"></div>
        <p>Loading...</p>
      </div>
    </div>
  );
};

export default Loader;
