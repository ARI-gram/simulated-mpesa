// ============================================================
// M-PESA NOTIFICATIONS
// System-level notifications for the PWA.
//
// This uses the browser Notification API.
// The notification can appear in the phone/desktop notification
// area and can be tapped to open the transaction.
// ============================================================

function requestMpesaNotificationPermission() {
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

  if (!("Notification" in window)) {
    console.log("[Notifications] Not supported.");
    return;
  }

  if (Notification.permission !== "granted") {
    console.log("[Notifications] Permission not granted.");
    return;
  }

  const amount = formatCurrency(transaction.amount);

  const title = "M-PESA";

  let body = message?.body || "Transaction successful.";

  // Keep the system notification short.
  if (body.length > 120) {
    body = body.substring(0, 117) + "...";
  }

  const options = {
    body,
    icon: "icons/icon.svg",
    badge: "icons/icon.svg",
    tag: `mpesa-${transaction.referenceId}`,
    renotify: true,
    data: {
      referenceId: transaction.referenceId,
      transactionId: transaction.id,
    },
  };

  // Use the service worker when available.
  // This gives the notification better PWA behavior.
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

        // Fallback to normal browser notification.
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

    const ref = options.data?.referenceId;

    if (ref) {
      window.location.href = `transaction.html?ref=${encodeURIComponent(ref)}`;
    }

    notification.close();
  };
}
