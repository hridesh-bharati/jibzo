import emailjs from "@emailjs/browser";

const sendResetEmail = async (email, otp, expiryTime) => {
  const serviceId = import.meta.env.VITE_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAIL_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAIL_API_KEY;

  const templateParams = {
    user_email: email,
    otp,
    expiryTime,
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
    console.error("Email send error:", error);
    return { success: false, error };
  }
};
export default sendResetEmail;
