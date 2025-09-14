import React, { useState } from "react";
import { ref, remove, onValue } from "firebase/database";
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
import "bootstrap/dist/js/bootstrap.bundle.min.js";

const DeleteAccount = () => {
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState(""); // password confirm ke liye
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
    } catch (err) {
      console.error("Error clearing app data:", err);
    }
  };

  // Main delete function
  const handleDeleteAccount = async () => {
    if (!user) return toast.error("User not found!");
    if (!password) return toast.error("⚠️ Please enter your password!");

    setLoading(true);

    try {
      // 1. Re-authenticate user
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);

      // 2. Remove user profile data
      await remove(ref(db, `usersData/${user.uid}`));

      // 3. Remove user's posts from galleryImages
      const postsRef = ref(db, "galleryImages");
      await new Promise((resolve, reject) => {
        onValue(
          postsRef,
          async (snapshot) => {
            const data = snapshot.val();
            if (!data) {
              resolve();
              return;
            }

            const deletePromises = Object.entries(data)
              .filter(([_, post]) => post.userId === user.uid)
              .map(([id]) => remove(ref(db, `galleryImages/${id}`)));

            await Promise.all(deletePromises);
            resolve();
          },
          { onlyOnce: true, error: (err) => reject(err) }
        );
      });

      // 4. Delete user from Firebase Auth (email bhi hat jayega)
      await deleteUser(user);

      // 5. Force signout
      await signOut(auth);

      // 6. Clear all app/browser data
      clearAppData();

      // 7. Success toast + navigate
      toast.success("✅ Account deleted permanently.");
      navigate("/login");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(error.message || "❌ Failed to delete account.");
    } finally {
      setLoading(false);
      setShowModal(false);
      setPassword("");
    }
  };

  return (
    <div className="text-center">
      <button
        className="threeD-btn redBtn"
        onClick={() => setShowModal(true)}
        disabled={loading}
      >
        {loading ? "Deleting..." : "🗑️ Delete Account Permanently"}
      </button>

      {/* Center Modal */}
      {showModal && (
        <div
          className="modal fade show"
          style={{ display: "block", background: "rgba(0,0,0,0.5)" }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title text-danger">Confirm Delete</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                ></button>
              </div>

              <div className="modal-body text-center">
                <p>
                  ⚠️ This will permanently delete your account and all your data.{" "}
                  <b>This cannot be undone.</b>
                </p>
                <input
                  type="password"
                  className="form-control mt-2"
                  placeholder="Enter password to confirm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleDeleteAccount}
                  disabled={loading}
                >
                  {loading ? "Deleting..." : "Yes, Delete"}
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
