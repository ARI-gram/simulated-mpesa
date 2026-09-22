// ============================================================
// SUCCESS PAGE
// Processes the pending transaction once on load, then renders
// the confirmation card. All action buttons are stubs.
// ============================================================

const customerId = Session.getLoggedInCustomerId();
const customer = customerId ? DB.getCustomerById(customerId) : null;

if (!customer) {
  window.location.href = "login.html";
}

// ---------- Load pending transaction ----------
let pending = null;
let processedTx = null;
let __processingDone = false;

try {
  const rawPending = sessionStorage.getItem("mpesa_pending_tx");
  const rawLastTx = sessionStorage.getItem("mpesa_last_tx");

  pending = rawPending ? JSON.parse(rawPending) : null;

  // If the PIN page already processed the tx (uncommented block),
  // we'll find it here; otherwise process it now.
  processedTx = rawLastTx ? JSON.parse(rawLastTx) : null;
} catch (_) {
  pending = null;
  processedTx = null;
}

if (!pending && !processedTx) {
  // Nothing to show — bounce home
  window.location.href = "home.html";
}

// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  // Guard: only process once per page-load
  if (!__processingDone && !processedTx && pending) {
    __processingDone = true;

    try {
      processedTx = processPayment(
        customer.id,
        Number(pending.amount),
        (refId, newBal) => ({
          senderCustomerId: customer.id,
          type: pending.type === "pochi" ? "pochi" : "mobile",
          amount: Number(pending.amount),
          recipientName: pending.recipientName,
          recipientIdentifier: pending.phone,
          direction: "OUT",
        }),
      );

      sessionStorage.setItem("mpesa_last_tx", JSON.stringify(processedTx));
      sessionStorage.removeItem("mpesa_pending_tx"); // ← important: clear immediately
    } catch (err) {
      console.error("processPayment failed:", err);
      alert(err.message || "Transaction failed.");
      window.location.href = "send-money.html";
      return;
    }
  }

  renderSuccess();
});

// ============================================================
// RENDER
// ============================================================

function renderSuccess() {
  const tx = processedTx;

  // Date + time
  document.getElementById("successDate").textContent = formatTxDate(
    tx.createdAt,
  );

  // Amount
  document.getElementById("successAmount").textContent =
    `Ksh ${Number(tx.amount).toFixed(2)}`;

  // Transaction cost (you can compute this properly later)
  document.getElementById("successCost").textContent =
    "Transaction cost: Ksh 0.00";

  // Reference ID
  document.getElementById("successRef").textContent = tx.referenceId;

  // Send-to block
  const name = tx.recipientName || "Unknown";
  const phone = tx.recipientIdentifier || "";
  const isPochi = tx.type === "pochi";

  document.getElementById("stName").textContent = name.toUpperCase();
  document.getElementById("stPhone").textContent = phone
    ? `Phone number:${phone}`
    : "";

  // Look up the original recipient to inherit their avatar
  const recipient = DB.getRecipientByPhone(tx.recipientIdentifier);

  const avatarEl = document.getElementById("stAvatar");
  const avatarHtml = renderAvatar(
    {
      name,
      avatarUrl: recipient?.avatarUrl || "",
      avatarColor: recipient?.avatarColor || "",
    },
    {
      className: "st-avatar",
      fallbackClass: tx.type === "pochi" ? "blue" : "purple",
    },
  );

  avatarEl.outerHTML = avatarHtml.replace(
    'class="st-avatar',
    'id="stAvatar" class="st-avatar',
  );

  // Stash for later handlers
  window.__lastTx = tx;
}

function formatTxDate(ts) {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleString("en-GB", { month: "short" });
  const year = d.getFullYear();
  const time = d
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase()
    .replace(" ", " ");
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  return `${day}${suffix} ${month} ${year} | ${time}`;
}

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

// ============================================================
// ACTIONS (STUBS)
// ============================================================

function handleClose() {
  // Close button → discard and go home
  cleanupAndGoHome();
}

function handleShare() {
  // TODO: Web Share API
  alert("Share receipt — coming next.");
}

function handleCopyId() {
  const tx = window.__lastTx;
  if (!tx) return;

  const text = tx.referenceId;
  navigator.clipboard.writeText(text).then(
    () => alert(`Reference ID copied:\n${text}`),
    () => alert("Could not copy. Please copy manually:\n" + text),
  );
}

function handleAddFavourite() {
  const tx = window.__lastTx || window.__viewTx;
  if (!tx) return;

  const phone = tx.recipientIdentifier;
  const name = tx.recipientName;

  if (!phone || !name) {
    alert("Cannot save this contact — missing details.");
    return;
  }

  // Already a favourite?
  const existing = DB.getRecipientByPhone(phone);
  if (existing) {
    alert(`${name} is already in your favourites.`);
    return;
  }

  DB.insertRecipient({
    name,
    phone,
    createdAt: Date.now(),
  });

  alert(`${name} added to favourites.`);
}

async function handleReverse() {
  const tx = window.__viewTx || window.__lastTx;
  if (!tx) return;

  const confirmed = confirm(
    `Reverse transaction ${tx.referenceId}?\n\n` +
      `Amount: ${formatCurrency(tx.amount)}\n` +
      `Recipient: ${tx.recipientName}\n\n` +
      `Funds will be refunded to your M-PESA balance.`,
  );
  if (!confirmed) return;

  try {
    // Prevent double reversal
    const fresh = DB.getTransactionByRef(tx.referenceId);
    if (!fresh) {
      alert("Transaction not found.");
      return;
    }
    if (fresh.reversed) {
      alert("This transaction has already been reversed.");
      return;
    }
    if ((fresh.status || "SUCCESS").toUpperCase() !== "SUCCESS") {
      alert("Only successful transactions can be reversed.");
      return;
    }

    const reversal = DB.insertReversal(fresh);

    // Hand the reversal tx to the transaction page so it shows immediately
    sessionStorage.setItem(
      "mpesa_view_tx",
      JSON.stringify({ id: reversal.id }),
    );

    alert(
      `Transaction reversed successfully.\n\n` +
        `Reversal ref: ${reversal.referenceId}\n` +
        `New balance: ${formatCurrency(reversal.balanceAfter)}`,
    );

    // Reload the page so the UI reflects the new state
    window.location.reload();
  } catch (err) {
    console.error("Reverse failed:", err);
    alert(err.message || "Could not reverse this transaction.");
  }
}

function handleSchedule() {
  alert("Schedule payment — coming next.");
}

function handleDownload() {
  // Basic receipt as a .txt download — replace with PDF later
  const tx = window.__lastTx;
  if (!tx) return;

  const lines = [
    "M-PESA TRANSACTION RECEIPT",
    "---------------------------------",
    `Reference ID: ${tx.referenceId}`,
    `Date:         ${formatTxDate(tx.createdAt)}`,
    `Amount:       Ksh ${Number(tx.amount).toFixed(2)}`,
    `Cost:         Ksh 0.00`,
    `Recipient:    ${tx.recipientName}`,
    `Phone:        ${tx.recipientIdentifier}`,
    `Sender:       ${customer.name} (${customer.phone})`,
    `Balance After: Ksh ${Number(tx.balanceAfter).toFixed(2)}`,
    "---------------------------------",
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mpesa-receipt-${tx.referenceId}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function handleDone() {
  cleanupAndGoHome();
}

function cleanupAndGoHome() {
  // Clear pending transaction so a refresh doesn't reprocess
  sessionStorage.removeItem("mpesa_pending_tx");
  sessionStorage.removeItem("mpesa_last_tx");

  window.location.href = "home.html";
}
