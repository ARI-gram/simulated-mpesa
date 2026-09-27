// ============================================================
// CONFIRM PAGE — UI ONLY
// Reads the draft transaction from sessionStorage
// and renders the correct layout for mobile vs pochi.
// ============================================================

const customerId = Session.getLoggedInCustomerId();
const customer = customerId ? DB.getCustomerById(customerId) : null;

if (!customer) {
  window.location.href = "login.html";
}

// ---------- Load draft ----------
let draft = null;
try {
  const raw = sessionStorage.getItem("mpesa_draft_tx");
  draft = raw ? JSON.parse(raw) : null;
} catch (_) {
  draft = null;
}

// If no draft (e.g. user refreshed / opened direct), bounce back
if (!draft) {
  window.location.href = "send-money.html";
}

// ============================================================
// RENDER
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  renderConfirm();
});

function renderConfirm() {
  const avatarEl = document.getElementById("confirmAvatar");
  const head = document.getElementById("confirmHead");
  const rows = document.getElementById("confirmRows");

  const isPochi = draft.type === "pochi";

  // Build the avatar (image or initials on color)
  const avatarHtml = renderAvatar(
    {
      name: draft.recipientName,
      avatarUrl: draft.avatarUrl,
      avatarColor: draft.avatarColor,
    },
    {
      className: "confirm-avatar",
      fallbackClass: isPochi ? "blue" : "purple",
    },
  );

  // Replace the placeholder avatar element with our rendered one
  avatarEl.outerHTML = avatarHtml.replace(
    'class="confirm-avatar',
    'id="confirmAvatar" class="confirm-avatar',
  );

  // Header text
  head.textContent = isPochi
    ? "Pay to Pochi La Biashara"
    : "Send money to mobile number";

  // Rows
  const amountRow = `
    <div class="confirm-row">
      <div class="lbl">Amount</div>
      <div class="val">Ksh ${Number(draft.amount).toFixed(2)}</div>
    </div>
  `;

  const sendToRow = `
    <div class="confirm-row">
      <div class="lbl">Send to</div>
      <div class="val">${escapeHtml(draft.recipientName || "Unknown")}</div>
    </div>
  `;

  const costRow = `
    <div class="confirm-row">
      <div class="lbl">Transaction cost</div>
      <div class="val">N/A</div>
    </div>
  `;

  rows.innerHTML = isPochi
    ? amountRow + sendToRow + costRow
    : sendToRow + amountRow + costRow;
}

// ============================================================
// SEND
// ============================================================

function handleSend() {
  // TODO: real flow → process payment (utils.processPayment) after PIN entry.
  // For now, carry the draft forward and navigate to PIN screen.
  sessionStorage.setItem("mpesa_pending_tx", JSON.stringify(draft));
  window.location.href = "pin.html";

  // When you build the PIN + success pages, this is what the chain looks like:
  //   confirm.html  →  pin.html  →  success.html
  // and processPayment() runs right before success.html is shown.
}

// ============================================================
// NAVIGATION
// ============================================================

function goBack() {
  window.location.href = "send-money.html";
}

// ============================================================
// HELPERS
// ============================================================

function getInitials(name) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
