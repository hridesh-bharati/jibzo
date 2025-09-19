// src/assets/users/Support.jsx
import React, { useState } from "react";

const Support = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Here you can integrate emailjs or Firebase to send messages
    console.log("Support request submitted:", formData);
    alert("Support request submitted!");
    setFormData({ name: "", email: "", message: "" });
  };

  return (
    <div className="container mt-5" style={{ maxWidth: 600 }}>
      <h2 className="text-center mb-4">Need Help? Contact Support</h2>
      <form className="card p-4 shadow-sm" onSubmit={handleSubmit}>
        <input
          type="text"
          name="name"
          placeholder="Your Name"
          value={formData.name}
          onChange={handleChange}
          className="form-control mb-3"
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Your Email"
          value={formData.email}
          onChange={handleChange}
          className="form-control mb-3"
          required
        />
        <textarea
          name="message"
          placeholder="How can we help you?"
          value={formData.message}
          onChange={handleChange}
          className="form-control mb-3"
          rows={5}
          required
        />
        <button type="submit" className="btn btn-primary w-100">
          Submit
        </button>
      </form>
    </div>
  );
};

export default Support;
