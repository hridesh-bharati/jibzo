// src\assets\users\DeleteAccount.jsx
import React, { useState } from "react";
import { ref, remove, onValue } from "firebase/database";
import { auth, db } from "../utils/firebaseConfig";
import { deleteUser } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const DeleteAccount = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const user = auth.currentUser;

const handleDeleteAccount = async () => {
  if (!user) return toast.error("User not found!");

  const confirm = window.confirm(
    "⚠️ This will permanently delete your account and all your data. This cannot be undone. Are you sure?"
  );

  if (!confirm) return;

  setLoading(true);
  try {
    // 1. Remove user data
    await remove(ref(db, `usersData/${user.uid}`));

    // 2. Remove user's posts
    const postsRef = ref(db, "galleryImages");
    onValue(
      postsRef,
      async (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const deletePromises = Object.entries(data)
          .filter(([_, post]) => post.userId === user.uid)
          .map(([id]) => remove(ref(db, `galleryImages/${id}`)));

        await Promise.all(deletePromises);
      },
      { onlyOnce: true }
    );

    // 3. Delete user from Firebase Auth
    await deleteUser(user);

    // ✅ Force sign out
    await auth.signOut();

    toast.success("✅ Account deleted permanently.");
    navigate("/login");
  } catch (error) {
    console.error("Delete error:", error);
    toast.error("❌ Failed to delete account. Re-authentication may be required.");
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="text-center my-4">
      <button
        className="threeD-btn redBtn"
        onClick={handleDeleteAccount}
        disabled={loading}
      >
        {loading ? "Deleting..." : "🗑️ Delete Account Permanently"}
      </button>
    </div>
  );
};

export default DeleteAccount;
