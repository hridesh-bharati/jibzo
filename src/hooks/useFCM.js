import { useCallback } from "react";
import { toast } from "react-toastify";
import { requestFcmToken, onForegroundMessage } from "../assets/utils/fcmClient";

export const useFCM = () => {
  const initializeFCM = useCallback(async (user) => {
    if (!user || !("Notification" in window)) return;

    try {
      const token = await requestFcmToken();
      if (!token) return;

      console.log("FCM token obtained:", token);

      // Save token to backend
      const response = await fetch("/api/saveAndPushMulti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          token,
          title: "Welcome!",
          body: "You will now receive notifications on this device."
        }),
      });

      if (!response.ok) throw new Error("Failed to save token");

      toast.success("Notifications enabled for this device!");
      
      // Set up foreground message listener
      onForegroundMessage((payload) => {
        const { title, body } = payload.notification || {};
        if (title && body) {
          toast.info(`${title}: ${body}`, { autoClose: 5000 });
        }
      });

    } catch (error) {
      console.error("FCM initialization failed:", error);
      toast.error("Failed to enable notifications.");
    }
  }, []);

  return { initializeFCM };
};