// ============================================================
// M-PESA NOTIFICATIONS
// System-level notifications for the PWA.
//
// This uses the browser Notification API.
// The notification can appear in the phone/desktop notification
// area and can be tapped to open the transaction.
// ============================================================

// Capacitor's native plugin, when running as a native app.
// window.Capacitor exists only inside the Android/iOS shell, never in a
// plain browser tab, so this safely stays undefined on the web.
const LocalNotifications =
  window.Capacitor?.Plugins?.LocalNotifications || null;

function isNativeApp() {
  return !!window.Capacitor?.isNativePlatform?.();
}

function requestMpesaNotificationPermission() {
  if (isNativeApp() && LocalNotifications) {
    LocalNotifications.requestPermissions().then((result) => {
      console.log("[Notifications] Native permission:", result.display);
    });

    // Create (or update) the channel that names this notification "Messages"
    LocalNotifications.createChannel({
      id: "messages",
      name: "Messages",
      importance: 4, // high — pops up and makes sound
      visibility: 1,
    }).catch((err) => {
      console.warn("[Notifications] Channel creation failed:", err);
    });

    return;
  }

  if (!("Notification" in window)) {
    console.log("[Notifications] Not supported.");
    return;
  }

  if (Notification.permission === "default") {
    Notification.requestPermission().then((permission) => {
      console.log("[Notifications] Permission:", permission);
    });
  }
}

// ============================================================
// SHOW M-PESA TRANSACTION NOTIFICATION
// ============================================================

function showMpesaNotification(transaction, message) {
  if (!transaction) return;

  const title = "MPESA";
  const body = message?.body || "Transaction successful.";

  // ---------- Native app: real Android notification ----------
  if (isNativeApp() && window.Capacitor?.Plugins?.MpesaNotification) {
    const notifId = Number(String(transaction.id).slice(-9)) || Date.now();

    window.Capacitor.Plugins.MpesaNotification.show({
      id: notifId,
      title,
      body,
    }).catch((err) => {
      console.warn("[Notifications] Native schedule failed:", err);
    });

    return;
  }

  // ---------- Web fallback (unchanged from before) ----------
  if (!("Notification" in window)) {
    console.log("[Notifications] Not supported.");
    return;
  }

  if (Notification.permission !== "granted") {
    console.log("[Notifications] Permission not granted.");
    return;
  }

  const options = {
    body,
    tag: `mpesa-${transaction.referenceId}`,
    renotify: true,
    actions: [{ action: "open", title: "Open" }],
    data: {
      referenceId: transaction.referenceId,
      transactionId: transaction.id,
    },
  };

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        return registration.showNotification(title, options);
      })
      .catch((err) => {
        console.warn(
          "[Notifications] Service worker notification failed:",
          err,
        );
        showBrowserNotification(title, options);
      });

    return;
  }

  showBrowserNotification(title, options);
}

// ============================================================
// FALLBACK BROWSER NOTIFICATION
// ============================================================

function showBrowserNotification(title, options) {
  const notification = new Notification(title, options);

  notification.onclick = () => {
    window.focus();
    window.location.href = "messages.html";
    notification.close();
  };
}

// ---------- Native notification tap handling ----------
if (isNativeApp() && LocalNotifications) {
  LocalNotifications.addListener("localNotificationActionPerformed", () => {
    window.location.href = "messages.html";
  });
}

// ---------- Native: resume-from-notification redirect ----------
if (isNativeApp() && window.Capacitor?.Plugins?.MpesaNotification) {
  const checkOpenMessages = () => {
    window.Capacitor.Plugins.MpesaNotification.consumeOpenMessages()
      .then((res) => {
        if (res?.open) window.location.href = "messages.html";
      })
      .catch(() => {});
  };

  document.addEventListener("DOMContentLoaded", checkOpenMessages);
  document.addEventListener("resume", checkOpenMessages);
}
