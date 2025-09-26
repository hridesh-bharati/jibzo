let oneSignalInitialized = false;

// Initialize OneSignal
export function initOneSignal(currentUid) {
  if (typeof window === "undefined" || !window.OneSignal) return;
  if (oneSignalInitialized) return;

  const OneSignal = window.OneSignal || [];
  OneSignal.push(() => {
    OneSignal.init({
      appId: import.meta.env.VITE_NOTIFY_APP_ID,
      allowLocalhostAsSecureOrigin: true,
      notifyButton: { enable: true },
    });

    if (currentUid) OneSignal.setExternalUserId(currentUid);

    // Show subscription prompt
    OneSignal.showSlidedownPrompt().then(() => {
      // Get OneSignal Player ID for debugging
      OneSignal.getUserId().then(id => console.log("Player ID:", id));
    });
  });

  oneSignalInitialized = true;
}

// Show local foreground notification
export function showLocalNotification(title, message, data = {}) {
  if (typeof window === "undefined" || !window.OneSignal) return;
  const OneSignal = window.OneSignal || [];
  OneSignal.push(() => {
    OneSignal.sendSelfNotification(title, message, null, data);
  });
}

// Call serverless function to send push
export async function sendPushNotification(title, message, data = {}, targetUserId = null) {
  try {
    const res = await fetch("/api/sendNotification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, message, data, targetUserId }),
    });

    const result = await res.json();
    console.log("Push sent:", result);
    return result;
  } catch (err) {
    console.error("Push error:", err);
  }
}
