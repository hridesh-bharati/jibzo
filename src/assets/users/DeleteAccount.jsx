import React, { useState } from "react";
import { ref, remove, get, update } from "firebase/database";
import { auth, db } from "../utils/firebaseConfig";
import {
  deleteUser,
  signOut,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "bootstrap/dist/css/bootstrap.min.css";

const DeleteAccount = () => {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const user = auth.currentUser;

  // Clear all app/browser data
  const clearAppData = () => {
    try {
      // Local storage & session storage clear
      localStorage.clear();
      sessionStorage.clear();

      // Clear all cookies
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
      });

      // Clear caches (PWA / service workers)
      if ("caches" in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }

      // Clear IndexedDB
      if (window.indexedDB) {
        indexedDB.databases().then((databases) => {
          databases.forEach((db) => {
            if (db.name) indexedDB.deleteDatabase(db.name);
          });
        });
      }
    } catch (err) {
      console.error("Error clearing app data:", err);
    }
  };

  // Remove user from other users' followers/following lists
  const cleanupUserRelations = async (uid) => {
    try {
      const usersRef = ref(db, `usersData`);
      const usersSnapshot = await get(usersRef);
      
      if (!usersSnapshot.exists()) return;

      const usersData = usersSnapshot.val();
      const updatePromises = [];

      Object.keys(usersData).forEach(otherUserId => {
        if (otherUserId !== uid) {
          const updates = {};
          
          // Remove from followers
          if (usersData[otherUserId].followers?.[uid]) {
            updates[`followers/${uid}`] = null;
          }
          
          // Remove from following
          if (usersData[otherUserId].following?.[uid]) {
            updates[`following/${uid}`] = null;
          }
          
          // Remove from follow requests
          if (usersData[otherUserId].followRequests?.received?.[uid]) {
            updates[`followRequests/received/${uid}`] = null;
          }
          if (usersData[otherUserId].followRequests?.sent?.[uid]) {
            updates[`followRequests/sent/${uid}`] = null;
          }
          
          if (Object.keys(updates).length > 0) {
            const userRef = ref(db, `usersData/${otherUserId}`);
            updatePromises.push(update(userRef, updates));
          }
        }
      });

      await Promise.all(updatePromises);
    } catch (error) {
      console.error("Error cleaning up user relations:", error);
      throw error;
    }
  };

  // Delete user's posts from galleryImages
  const deleteUserPosts = async (uid) => {
    try {
      const postsRef = ref(db, "galleryImages");
      const postsSnapshot = await get(postsRef);
      
      if (!postsSnapshot.exists()) return;

      const postsData = postsSnapshot.val();
      const deletePromises = [];

      Object.keys(postsData).forEach(postId => {
        if (postsData[postId].userId === uid) {
          deletePromises.push(remove(ref(db, `galleryImages/${postId}`)));
        }
      });

      await Promise.all(deletePromises);
    } catch (error) {
      console.error("Error deleting user posts:", error);
      throw error;
    }
  };

  // Delete user's likes, comments, and other related data
  const deleteUserActivity = async (uid) => {
    try {
      // Delete user's likes
      const likesRef = ref(db, `likes/${uid}`);
      await remove(likesRef);

      // Delete user's comments
      const commentsRef = ref(db, `comments/${uid}`);
      await remove(commentsRef);

      // Delete user's notifications
      const notificationsRef = ref(db, `notifications/${uid}`);
      await remove(notificationsRef);

    } catch (error) {
      console.error("Error deleting user activity:", error);
      // Don't throw error here as these are secondary data
    }
  };

  // Main delete function
  const handleDeleteAccount = async () => {
    if (!user) {
      toast.error("User not found!");
      return;
    }

    if (!password) {
      toast.error("⚠️ Please enter your password!");
      return;
    }

    setLoading(true);

    try {
      // 1. Re-authenticate user
      toast.info("Verifying your identity...");
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);

      toast.info("Deleting your data...");

      // 2. Clean up user relations first (important!)
      await cleanupUserRelations(user.uid);

      // 3. Delete user's posts
      await deleteUserPosts(user.uid);

      // 4. Delete user's activity data
      await deleteUserActivity(user.uid);

      // 5. Remove user profile data
      await remove(ref(db, `usersData/${user.uid}`));

      // 6. Delete user from Firebase Auth
      toast.info("Deleting your account...");
      await deleteUser(user);

      // 7. Force signout
      await signOut(auth);

      // 8. Clear all app/browser data
      clearAppData();

      // 9. Success message and redirect
      toast.success("✅ Account deleted permanently. All data has been removed.");
      
      // Small delay for user to see success message
      setTimeout(() => {
        navigate("/login");
      }, 2000);

    } catch (error) {
      console.error("Delete error:", error);
      
      // Specific error handling
      if (error.code === "auth/wrong-password") {
        toast.error("❌ Incorrect password. Please try again.");
      } else if (error.code === "auth/requires-recent-login") {
        toast.error("❌ Please log in again before deleting your account.");
      } else if (error.code === "auth/network-request-failed") {
        toast.error("❌ Network error. Please check your internet connection.");
      } else {
        toast.error(error.message || "❌ Failed to delete account.");
      }
    } finally {
      setLoading(false);
      setShowModal(false);
      setPassword("");
    }
  };

  return (
    <div className="text-center">
      <button
        className="btn btn-outline-danger btn-sm"
        onClick={() => setShowModal(true)}
        disabled={loading}
      >
        <i className="bi bi-trash-fill me-1"></i>
        {loading ? "Deleting..." : "Delete Account Permanently"}
      </button>

      {/* Confirmation Modal */}
      {showModal && (
        <div 
          className="modal fade show" 
          style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header border-bottom bg-danger text-white">
                <h5 className="modal-title">
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  Delete Account Permanently
                </h5>
                <button 
                  type="button" 
                  className="btn-close btn-close-white"
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                ></button>
              </div>
              
              <div className="modal-body">
                <div className="alert alert-warning mb-3">
                  <strong>Warning:</strong> This action cannot be undone!
                </div>
                
                <ul className="text-danger small mb-3">
                  <li>Your profile and all personal data will be permanently deleted</li>
                  <li>All your posts, likes, and comments will be removed</li>
                  <li>Your account will be deleted from Firebase Authentication</li>
                  <li>You will be removed from other users' followers/following lists</li>
                  <li>All app data will be cleared from your browser</li>
                </ul>
                
                <div className="mb-3">
                  <label htmlFor="deletePassword" className="form-label">
                    Enter your password to confirm:
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    id="deletePassword"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your current password"
                    disabled={loading}
                    autoComplete="current-password"
                  />
                </div>
              </div>
              
              <div className="modal-footer border-top">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger"
                  onClick={handleDeleteAccount}
                  disabled={loading || !password}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Deleting Account...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-trash-fill me-2"></i>
                      Delete Permanently
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeleteAccount;