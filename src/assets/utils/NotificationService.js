let oneSignalInitialized = false;

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

    OneSignal.showSlidedownPrompt();
  });

  oneSignalInitialized = true;
}

// Local foreground notification
export function showLocalNotification(title, message, data = {}) {
  if (typeof window === "undefined" || !window.OneSignal) return;
  const OneSignal = window.OneSignal || [];
  OneSignal.push(() => {
    OneSignal.sendSelfNotification(title, message, null, data);
  });
}

// Call serverless function for safe push
export async function sendPushNotification(title, message, data = {}, targetUserId = null) {
  try {
    const res = await fetch("/api/sendNotification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appId: import.meta.env.VITE_NOTIFY_APP_ID,
        authKey: import.meta.env.VITE_NOTIFY_AUTH_ID,
        title,
        message,
        data,
        targetUserId,
      }),
    });

    const result = await res.json();
    console.log("Push sent:", result);
    return result;
  } catch (err) {
    console.error("Push error:", err);
  }
}
