// api\sendemail.js
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { email, username, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ success: false, message: "Email and OTP required" });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { 
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS 
      },
    });

    await transporter.sendMail({
      from: `"My App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP Code",
      html: `<h3>Hello ${username || "User"},</h3>
             <p>Your OTP is: <b>${otp}</b></p>
             <p>It expires in 10 minutes.</p>`,
    });

    res.status(200).json({ success: true, message: "OTP sent successfully!" });
  } catch (err) {
    console.error("NodeMailer error:", err);
    res.status(500).json({ success: false, message: "Failed to send OTP." });
  }
}
