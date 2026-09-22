// ============================================================
// TRANSACTION DETAILS PAGE
// Reads a transaction either from:
//   1. sessionStorage key "mpesa_view_tx"  (set by statements/messages)
//   2. URL query        ?ref=ABC123        (lookup by referenceId)
//   3. URL query        ?id=42             (lookup by DB id)
// If nothing is found, falls back to the last successful transaction.
// ============================================================

const customerId = Session.getLoggedInCustomerId();
const customer = customerId ? DB.getCustomerById(customerId) : null;

if (!customer) {
  window.location.href = "login.html";
}

// ---------- Resolve the transaction ----------
let tx = null;

tx = loadFromSession() || loadFromQuery() || loadLastTransaction();

if (!tx) {
  // Nothing to show
  alert("Transaction not found.");
  window.location.href = "home.html";
}

// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  renderTransaction(tx);
});

// ============================================================
// LOADERS
// ============================================================

function loadFromSession() {
  try {
    const raw = sessionStorage.getItem("mpesa_view_tx");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Prefer the full DB record if we have an id
    if (parsed.id) {
      const fromDb = DB.getAllTransactions().find((t) => t.id === parsed.id);
      if (fromDb) return fromDb;
    }
    // Also resolve by referenceId (messages.js only stores this, not id)
    if (parsed.referenceId) {
      const fromDb = DB.getAllTransactions().find(
        (t) => t.referenceId === parsed.referenceId,
      );
      if (fromDb) return fromDb;
    }
    return parsed;
  } catch (_) {
    return null;
  }
}

function loadFromQuery() {
  const params = new URLSearchParams(window.location.search);

  const ref = params.get("ref");
  if (ref) {
    const found = DB.getAllTransactions().find((t) => t.referenceId === ref);
    if (found) return found;
  }

  const id = params.get("id");
  if (id) {
    const found = DB.getAllTransactions().find((t) => t.id === Number(id));
    if (found) return found;
  }

  return null;
}

function loadLastTransaction() {
  try {
    const raw = sessionStorage.getItem("mpesa_last_tx");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.id) {
      const fromDb = DB.getAllTransactions().find((t) => t.id === parsed.id);
      if (fromDb) return fromDb;
    }
    return parsed;
  } catch (_) {
    return null;
  }
}

// Try to resolve a recipient avatar
const recipient = tx.recipientIdentifier
  ? DB.getRecipientByPhone(tx.recipientIdentifier)
  : null;

if (recipient && (recipient.avatarUrl || recipient.avatarColor)) {
  // Replace the icon with a real avatar
  const iconEl = document.getElementById("txIcon");
  const avatarHtml = renderAvatar(
    {
      name: recipient.name,
      avatarUrl: recipient.avatarUrl,
      avatarColor: recipient.avatarColor,
    },
    { className: "tx-icon avatar-img" },
  );
  iconEl.outerHTML = avatarHtml.replace(
    'class="tx-icon avatar-img',
    'id="txIcon" class="tx-icon avatar-img',
  );
}

// ============================================================
// RENDER
// ============================================================

function renderTransaction(tx) {
  const status = (tx.status || "SUCCESS").toUpperCase();

  // -- Hero icon --
  const iconEl = document.getElementById("txIcon");
  const cardEl = document.querySelector(".tx-card");

  if (status === "FAILED") {
    iconEl.textContent = "✕";
    iconEl.classList.add("failed");
    cardEl.classList.add("failed");
  } else if (status === "PENDING") {
    iconEl.textContent = "…";
    iconEl.classList.add("pending");
    cardEl.classList.add("pending");
  } else {
    iconEl.textContent = "✓";
  }

  // -- Status banner --
  document.getElementById("txStatus").textContent =
    status === "FAILED"
      ? "Transaction Failed"
      : status === "PENDING"
        ? "Transaction Pending"
        : "Transaction Successful";

  // -- Amount --
  document.getElementById("txAmount").textContent =
    `${formatCurrency(tx.amount)}`;

  // -- Type subtitle --
  document.getElementById("txType").textContent = describeType(tx);

  // -- Details --
  document.getElementById("txRecipient").textContent = tx.recipientName || "—";
  document.getElementById("txIdentifier").textContent =
    tx.recipientIdentifier || "—";
  document.getElementById("txDateTime").textContent = formatTxDate(
    tx.createdAt,
  );
  document.getElementById("txCost").textContent = "Ksh 0.00";

  const balEl = document.getElementById("txBalance");
  balEl.textContent =
    typeof tx.balanceAfter === "number" ? formatCurrency(tx.balanceAfter) : "—";

  document.getElementById("txRef").textContent = tx.referenceId || "—";

  // -- Reverse tile: only for successful outgoing transactions --
  const reverseTile = document.getElementById("reverseTile");
  const canReverse =
    status === "SUCCESS" && tx.direction !== "IN" && !tx.reversed;

  if (!canReverse) {
    reverseTile.disabled = true;
    reverseTile.style.opacity = 0.35;
    reverseTile.style.cursor = "not-allowed";
    reverseTile.title = tx.reversed ? "Already reversed" : "Not reversible";
  }

  // -- Cache for handlers --
  window.__viewTx = tx;
}

function describeType(tx) {
  switch ((tx.type || "").toUpperCase()) {
    case "SEND_MONEY":
      return "Sent to mobile number";
    case "POCHI_PAY":
      return "Sent to Pochi la Biashara";
    case "LIPA":
      return "Paid to merchant";
    case "WITHDRAW":
      return "Withdrawn from agent";
    case "AIRTIME":
      return "Airtime purchase";
    case "BUNDLES":
      return "Bundle purchase";
    default:
      return "M-PESA transaction";
  }
}

function formatTxDate(ts) {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleString("en-GB", { month: "short" });
  const year = d.getFullYear();
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

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

// ============================================================
// ACTIONS
// ============================================================

function copyRef() {
  const tx = window.__viewTx;
  if (!tx || !tx.referenceId) return;

  navigator.clipboard.writeText(tx.referenceId).then(
    () => alert(`Reference ID copied:\n${tx.referenceId}`),
    () => alert("Could not copy. Please copy manually:\n" + tx.referenceId),
  );
}

function handleShare() {
  const tx = window.__viewTx;
  if (!tx) return;

  const text = buildReceiptText(tx);

  if (navigator.share) {
    navigator.share({ title: "M-PESA Receipt", text }).catch(() => {});
  } else {
    alert("Share not supported on this device.\n\n" + text);
  }
}

function handleDownload() {
  const tx = window.__viewTx;
  if (!tx) return;

  const text = buildReceiptText(tx);
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mpesa-receipt-${tx.referenceId}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

function handleReport() {
  alert("Report an issue — coming next.");
}

function handleHome() {
  // Clear the viewing context so home doesn't re-show this
  sessionStorage.removeItem("mpesa_view_tx");
  window.location.href = "home.html";
}

// ============================================================
// NAVIGATION
// ============================================================

function goBack() {
  if (document.referrer && history.length > 1) {
    history.back();
  } else {
    window.location.href = "home.html";
  }
}

// ============================================================
// HELPERS
// ============================================================

function buildReceiptText(tx) {
  return [
    "M-PESA TRANSACTION RECEIPT",
    "---------------------------------",
    `Reference ID:   ${tx.referenceId}`,
    `Status:         ${tx.status || "SUCCESS"}`,
    `Date:           ${formatTxDate(tx.createdAt)}`,
    `Amount:         ${formatCurrency(tx.amount)}`,
    `Cost:           Ksh 0.00`,
    `Recipient:      ${tx.recipientName}`,
    `Identifier:     ${tx.recipientIdentifier}`,
    `Balance After:  ${
      typeof tx.balanceAfter === "number"
        ? formatCurrency(tx.balanceAfter)
        : "—"
    }`,
    "---------------------------------",
    "This is a simulated M-PESA receipt.",
  ].join("\n");
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
