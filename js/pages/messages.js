// ============================================================
// M-PESA MESSAGES PAGE
// Renders the SMS thread stored by processPayment() in DB.
// Tapping a bubble → transaction.html?ref=XXXXXXX
// ============================================================

const customerId = Session.getLoggedInCustomerId();
const customer = customerId ? DB.getCustomerById(customerId) : null;

if (!customer) {
  window.location.href = "login.html";
}

const THREAD_NAME = "M-PESA";

// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  renderThreadHeader();
  renderMessages();
  initMessageDelete();
  initPinchZoom();
});

function renderThreadHeader() {
  document.getElementById("threadName").textContent = "MPESA";
}

// ============================================================
// RENDER MESSAGES
// ============================================================

function renderMessages() {
  const list = document.getElementById("msgList");

  const messages = DB.getMessagesByThread(THREAD_NAME).sort(
    (a, b) => a.createdAt - b.createdAt,
  );

  if (!messages.length) {
    list.innerHTML = `
      <div class="msg-empty">
        No M-PESA messages yet.<br />
        Send money to see your transaction confirmations here.
      </div>
    `;
    return;
  }

  let lastDayKey = null;
  let html = "";

  messages.forEach((msg) => {
    const dayKey = dayKeyFrom(msg.createdAt);

    if (dayKey !== lastDayKey) {
      html += `
        <div class="msg-date-divider">
          <span>${formatDayLabel(msg.createdAt)}</span>
        </div>
      `;

      lastDayKey = dayKey;
    }

    html += renderBubble(msg);
  });

  list.innerHTML = html;

  // No transaction click handlers here.
  // Messages behave like normal SMS messages.

  list.scrollTop = list.scrollHeight;
}

function renderBubble(msg) {
  const safeBody = linkify(escapeHtml(msg.body));

  return `
    <div class="msg-row" data-id="${msg.id}">
      <div class="msg-avatar">
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="#fff"
          stroke-width="1.8"
          stroke-linecap="round"
        >
          <circle cx="12" cy="9" r="3" />
          <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
        </svg>
      </div>

      <div class="msg-bubble">
        ${safeBody}
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkify(text) {
  // Basic URL linkifier
  return text.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`,
  );
}

function dayKeyFrom(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();

  if (dayKeyFrom(ts) === dayKeyFrom(today)) return "Today";

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKeyFrom(ts) === dayKeyFrom(yesterday)) return "Yesterday";

  const day = d.getDate();
  const month = d.toLocaleString("en-GB", { month: "short" });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

// ============================================================
// DELETE MESSAGE (long-press on touch, right-click on desktop)
// ============================================================

function initMessageDelete() {
  const list = document.getElementById("msgList");
  let timer = null;
  let lastAsk = 0;

  function askDelete(row) {
    // Avoid a double prompt when touch and contextmenu both fire
    if (Date.now() - lastAsk < 800) return;
    lastAsk = Date.now();

    const id = Number(row.dataset.id);
    if (!id) return;

    if (confirm("Delete this message?")) {
      DB.deleteMessage(id);
      renderMessages();
    }
  }

  function cancel() {
    clearTimeout(timer);
  }

  list.addEventListener(
    "touchstart",
    (e) => {
      const row = e.target.closest(".msg-row");
      if (!row) return;
      timer = setTimeout(() => askDelete(row), 550);
    },
    { passive: true },
  );

  list.addEventListener("touchend", cancel);
  list.addEventListener("touchmove", cancel, { passive: true });
  list.addEventListener("touchcancel", cancel);

  list.addEventListener("contextmenu", (e) => {
    const row = e.target.closest(".msg-row");
    if (!row) return;
    e.preventDefault();
    askDelete(row);
  });
}

// ============================================================
// PINCH-TO-ZOOM (text size only)
// ============================================================

const ZOOM_KEY = "mpesa_msg_text_scale";
const ZOOM_MIN = 0.8;
const ZOOM_MAX = 1.8;

function initPinchZoom() {
  const list = document.getElementById("msgList");

  // Restore the saved size
  const saved = parseFloat(localStorage.getItem(ZOOM_KEY));
  let scale = saved && saved >= ZOOM_MIN && saved <= ZOOM_MAX ? saved : 1;
  list.style.setProperty("--msg-scale", scale);

  let startDist = 0;
  let startScale = scale;

  function dist(touches) {
    const [a, b] = touches;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  list.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 2) {
        startDist = dist(e.touches);
        startScale = scale;
      }
    },
    { passive: true },
  );

  list.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length === 2) {
        e.preventDefault(); // stop the page from scrolling while pinching
        const ratio = dist(e.touches) / startDist;
        scale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, startScale * ratio));
        list.style.setProperty("--msg-scale", scale);
      }
    },
    { passive: false },
  );

  list.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) {
      localStorage.setItem(ZOOM_KEY, scale);
    }
  });
}

function goBack() {
  if (document.referrer && history.length > 1) history.back();
  else window.location.href = "home.html";
}

function callThread() {
  alert("Dial *334# to contact M-PESA support.");
}

function infoThread() {
  alert("M-PESA\n67372\nSafaricom");
}
