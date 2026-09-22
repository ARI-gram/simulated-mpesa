// ============================================================
// STATEMENTS PAGE
// Lists all transactions for the logged-in customer with filters.
// Tapping any row → transaction.html?id=...
// ============================================================

const customerId = Session.getLoggedInCustomerId();
const customer = customerId ? DB.getCustomerById(customerId) : null;

if (!customer) {
  window.location.href = "login.html";
}

// ---------- Page state ----------
let activeFilter = "all"; // all | out | in | reversal

// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  attachFilterListeners();
  renderSummary();
  renderList();
});

// ============================================================
// FILTER TABS
// ============================================================

function attachFilterListeners() {
  document.querySelectorAll(".filter-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.filter;
      document
        .querySelectorAll(".filter-tab")
        .forEach((b) => b.classList.toggle("active", b === btn));
      renderList();
    });
  });
}

// ============================================================
// SUMMARY (money in / out)
// ============================================================

function renderSummary() {
  const txns = DB.getTransactionsBySender(customer.id);

  const moneyIn = txns
    .filter((t) => t.direction === "IN" && t.status === "SUCCESS")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const moneyOut = txns
    .filter((t) => t.direction !== "IN" && t.status === "SUCCESS")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  document.getElementById("sumIn").textContent = formatCurrency(moneyIn);
  document.getElementById("sumOut").textContent = formatCurrency(moneyOut);
}

// ============================================================
// LIST
// ============================================================

function renderList() {
  const all = DB.getTransactionsBySender(customer.id);
  const filtered = applyFilter(all, activeFilter);

  const listEl = document.getElementById("stmtList");
  const emptyEl = document.getElementById("stmtEmpty");

  if (!filtered.length) {
    listEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }

  emptyEl.classList.add("hidden");
  listEl.innerHTML = filtered.map(renderRow).join("");

  // Attach click handlers
  listEl.querySelectorAll(".stmt-row").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.dataset.txId;
      openTransactionById(id);
    });
  });
}

function applyFilter(txns, filter) {
  switch (filter) {
    case "out":
      return txns.filter((t) => t.direction !== "IN");
    case "in":
      return txns.filter((t) => t.direction === "IN" && t.type !== "REVERSAL");
    case "reversal":
      return txns.filter((t) => t.type === "REVERSAL");
    case "all":
    default:
      return txns;
  }
}

function renderRow(tx) {
  const direction = tx.direction === "IN" ? "in" : "out";
  const kind = tx.type === "REVERSAL" ? "reversal" : direction;

  // Icon character
  // Try to resolve an avatar from the sender/recipient phone
  const phone =
    direction === "in" ? tx.recipientIdentifier : tx.recipientIdentifier;
  const recipient = phone ? DB.getRecipientByPhone(phone) : null;

  const hasAvatar = recipient && (recipient.avatarUrl || recipient.avatarColor);

  const avatarHtml = hasAvatar
    ? renderAvatar(
        {
          name: recipient.name,
          avatarUrl: recipient.avatarUrl,
          avatarColor: recipient.avatarColor,
        },
        { className: "stmt-icon" },
      )
    : `<div class="stmt-icon ${kind}">${
        tx.type === "REVERSAL" ? "↺" : direction === "in" ? "↓" : "↑"
      }</div>`;

  // Title = recipient (or sender if IN)
  const title = tx.recipientName || "Unknown";

  // Sub = reference + reversed badge if applicable
  const ref = tx.referenceId || "";
  const reversed = tx.reversed
    ? `<span class="stmt-badge">REVERSED</span>`
    : "";

  // Amount sign
  const sign = direction === "in" ? "+" : "-";

  return `
  <div class="stmt-row" data-tx-id="${tx.id}">
    ${avatarHtml}

    <div class="stmt-mid">
      <div class="stmt-title">
        ${escapeHtml(title)}
        ${reversed}
      </div>

      <div class="stmt-sub">
        ${escapeHtml(ref)}
      </div>
    </div>

    <div class="stmt-right">
      <div class="stmt-amount ${kind}">
        ${sign}${formatCurrency(tx.amount)}
      </div>

      <div class="stmt-time">
        ${formatShortTime(tx.createdAt)}
      </div>
    </div>
  </div>
`;
}

// ============================================================
// HELPERS
// ============================================================

function formatShortTime(ts) {
  const d = new Date(ts);
  const today = new Date();

  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  if (sameDay) {
    return d
      .toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .toLowerCase();
  }

  const day = d.getDate();
  const month = d.toLocaleString("en-GB", { month: "short" });
  return `${day} ${month}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ============================================================
// NAVIGATION
// ============================================================

function openTransactionById(id) {
  sessionStorage.setItem("mpesa_view_tx", JSON.stringify({ id: Number(id) }));
  window.location.href = `transaction.html?id=${encodeURIComponent(id)}`;
}

function goBack() {
  if (document.referrer && history.length > 1) history.back();
  else window.location.href = "home.html";
}
