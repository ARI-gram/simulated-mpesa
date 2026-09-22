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
});

function renderThreadHeader() {
  document.getElementById("threadName").textContent = THREAD_NAME;
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
    <div class="msg-row">
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
