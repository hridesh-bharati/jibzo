import React from "react";

const StatusBubble = ({ user, isSeen, isOwn, storyCount, totalViews, totalLikes, onClick }) => {
  const userPic = user?.photoURL || user?.userPic || "/icons/avatar.jpg";
  const username = user?.username || user?.userName || "User";

  return (
    <div className={`status-bubble my-3 ${isSeen ? 'seen' : ''} ${isOwn ? 'own' : ''}`} onClick={onClick}>
      <div className="bubble-container">
        <div className="status-ring">
          <img
            src={userPic}
            alt={username}
            className="status-thumb"
          />
          {!isSeen && <div className="unseen-glow"></div>}
        </div>
        
        {isOwn && storyCount > 0 && (
          <div className="story-count-badge">
            {storyCount}
          </div>
        )}
        
        {!isOwn && totalViews > 0 && (
          <div className="live-views-badge">
            <i className="bi bi-eye-fill"></i>
            {totalViews}
          </div>
        )}
        
        {totalLikes > 0 && (
          <div className="live-likes-badge">
            <i className="bi bi-heart-fill"></i>
            {totalLikes}
          </div>
        )}
        
        {!isSeen && (
          <div className="new-activity-indicator">
            <div className="activity-dot"></div>
          </div>
        )}
      </div>
      
      <div className="user-info">
        <div className="status-username w-100">{username}</div>
        <div className="live-stats-mini">
          {totalViews > 0 && <span>👁️ {totalViews}</span>}
          {totalLikes > 0 && <span>❤️ {totalLikes}</span>}
        </div>
      </div>
      
      <div className="bubble-hover-effect">
        <div className="ripple ripple-1"></div>
        <div className="ripple ripple-2"></div>
        <div className="ripple ripple-3"></div>
      </div>
    </div>
  );
};

export default StatusBubble;