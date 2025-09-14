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
      // 1. Remove user profile data including email from usersData
      await remove(ref(db, `usersData/${user.uid}`));

      // 2. If you store emails separately, delete that too:
      // await remove(ref(db, `emails/${user.uid}`)); // Uncomment if used

      // 3. Remove user's posts from galleryImages
      const postsRef = ref(db, "galleryImages");
      await new Promise((resolve, reject) => {
        onValue(
          postsRef,
          async (snapshot) => {
            const data = snapshot.val();
            if (!data) {
              resolve(); // No posts to delete
              return;
            }

            const deletePromises = Object.entries(data)
              .filter(([_, post]) => post.userId === user.uid)
              .map(([id]) => remove(ref(db, `galleryImages/${id}`)));

            await Promise.all(deletePromises);
            resolve();
          },
          {
            onlyOnce: true,
            error: (err) => reject(err),
          }
        );
      });

      // 4. Delete user from Firebase Auth
      await deleteUser(user);

      // 5. Sign out forcibly after deletion
      await auth.signOut();

      toast.success("✅ Account deleted permanently.");
      navigate("/login");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(
        "❌ Failed to delete account. Re-authentication may be required."
      );
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
