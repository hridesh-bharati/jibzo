// src/utils/email.js
import emailjs from "@emailjs/browser";

const sendResetEmail = async (email) => {
  const serviceId = import.meta.env.VITE_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAIL_TEMPLETE_ID;
  const publicKey = import.meta.env.VITE_EMAIL_API_KEY;

  const templateParams = {
    user_email: email,
  };

  try {
    const response = await emailjs.send(
      serviceId,
      templateId,
      templateParams,
      publicKey
    );
    return { success: true, response };
  } catch (error) {
    return { success: false, error };
  }
};

export default sendResetEmail;
