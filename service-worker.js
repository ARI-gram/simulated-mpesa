// ============================================================
// SERVICE WORKER
// Caches the app shell so the whole thing works offline.
// Bump CACHE_VERSION to force a cache refresh after edits.
// ============================================================

const CACHE_VERSION = "mpesa-v7";

// Everything we want available offline
const APP_SHELL = [
  "./",
  "./index.html",
  "./login.html",
  "./register.html",
  "./home.html",
  "./send-money.html",
  "./confirm.html",
  "./pin.html",
  "./success.html",
  "./transaction.html",
  "./messages.html",
  "./statements.html",
  "./request-money.html",
  "./search.html",
  "./admin-dashboard.html",

  "./css/style.css",
  "./css/global.css",
  "./css/login.css",
  "./css/register.css",
  "./css/home.css",
  "./css/send-money.css",
  "./css/confirm.css",
  "./css/pin.css",
  "./css/success.css",
  "./css/transaction.css",
  "./css/messages.css",
  "./css/statements.css",
  "./css/request-money.css",
  "./css/search.css",
  "./css/admin.css",

  "./js/db.js",
  "./js/utils.js",
  "./js/session.js",
  "./js/seed.js",
  "./js/notifications.js",
  "./js/webauthn.js",
  "./js/pages/login.js",
  "./js/pages/register.js",
  "./js/pages/home.js",
  "./js/pages/send-money.js",
  "./js/pages/confirm.js",
  "./js/pages/pin.js",
  "./js/pages/success.js",
  "./js/pages/transaction.js",
  "./js/pages/messages.js",
  "./js/pages/statements.js",
  "./js/pages/request-money.js",
  "./js/pages/search.js",
  "./js/pages/admin.js",

  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-1024.png",
  "./icons/splash.png",
];

// ---------- INSTALL: pre-cache the app shell ----------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) =>
        // addAll fails hard if one file 404s, so add them one-by-one
        Promise.all(
          APP_SHELL.map((url) =>
            cache.add(url).catch((err) => {
              console.warn("[SW] Skipped caching:", url, err.message);
            }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

// ---------- ACTIVATE: clean up old caches ----------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ---------- FETCH: cache-first, network fallback ----------
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle same-origin GETs
  if (req.method !== "GET") return;
  if (!req.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          // Cache successful responses on the fly
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(req, copy).catch(() => {});
            });
          }
          return res;
        })
        .catch(() => {
          // Offline fallback for navigations
          if (req.mode === "navigate") {
            return caches.match("./index.html");
          }
          return new Response("Offline", { status: 503 });
        });
    }),
  );
});

// ---------- MESSAGE: allow manual cache refresh ----------
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ---------- NOTIFICATION CLICK: open the related transaction ----------
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // The explicit "Open" action button and tapping the body do the same thing
  if (event.action && event.action !== "open") return;

  const referenceId = event.notification.data?.referenceId;

  if (!referenceId) return;

  const transactionUrl = new URL(
    `transaction.html?ref=${encodeURIComponent(referenceId)}`,
    self.registration.scope,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // If the app is already open, reuse it.
        for (const client of clientList) {
          if ("focus" in client) {
            return client.focus().then(() => {
              if ("navigate" in client) {
                return client.navigate(transactionUrl);
              }
            });
          }
        }

        // Otherwise open the transaction page.
        if (self.clients.openWindow) {
          return self.clients.openWindow(transactionUrl);
        }
      }),
  );
});
