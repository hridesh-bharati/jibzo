// src/assets/users/UpdateEmail.jsx
import React, { useState } from "react";
import { getAuth, updateEmail, signInWithEmailAndPassword } from "firebase/auth";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const UpdateEmail = () => {
  const auth = getAuth();
  const user = auth.currentUser;

  const [formData, setFormData] = useState({ currentPassword: "", newEmail: "" });
  const [loading, setLoading] = useState(false);

  if (!user) {
    return <p className="text-center mt-5">You need to login first.</p>;
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    const { currentPassword, newEmail } = formData;

    if (!currentPassword || !newEmail) {
      return toast.error("All fields are required!");
    }

    setLoading(true);

    try {
      // Re-authenticate user
      const credential = await signInWithEmailAndPassword(user.auth, user.email, currentPassword);
      
      // Update email
      await updateEmail(user, newEmail);
      toast.success("Email updated successfully! Please verify your new email.");
      
      // Optionally, you can send email verification
      await user.sendEmailVerification();

      setFormData({ currentPassword: "", newEmail: "" });
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5" style={{ maxWidth: 400 }}>
      <h3 className="text-center mb-4">Update Email</h3>

      <form onSubmit={handleUpdateEmail} className="card p-4 shadow-sm">
        <input
          type="password"
          name="currentPassword"
          placeholder="Current Password"
          value={formData.currentPassword}
          onChange={handleChange}
          className="form-control mb-3"
          required
        />
        <input
          type="email"
          name="newEmail"
          placeholder="New Email"
          value={formData.newEmail}
          onChange={handleChange}
          className="form-control mb-3"
          required
        />
        <button
          type="submit"
          className="btn btn-primary w-100"
          disabled={loading}
        >
          {loading ? "Updating..." : "Update Email"}
        </button>
      </form>

      <ToastContainer />
    </div>
  );
};

export default UpdateEmail;
