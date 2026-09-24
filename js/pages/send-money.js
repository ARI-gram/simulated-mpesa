// ============================================================
// SEND MONEY — UI ONLY
// All business logic (transactions, PIN, etc.) is stubbed.
// Look for "TODO" comments to wire up real behavior.
// ============================================================

// ---------- Session / customer ----------
const customerId = Session.getLoggedInCustomerId();
const customer = customerId ? DB.getCustomerById(customerId) : null;

if (!customer) {
  // Not logged in → bounce to login
  window.location.href = "login.html";
}

// ---------- Page state ----------
const sendState = {
  activeTab: "mobile", // "mobile" | "pochi"
  paymentMethod: "mpesa", // "mpesa" | "shiriki"
  phone: "",
  amount: "",
};

// ---------- Favourite avatar colors ----------
// Deterministic color per recipient id so avatars stay stable.
const AVATAR_COLORS = ["purple", "blue", "green", "red"];

function colorForId(id) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

/**
 * Get favourites from DB for a given tab.
 * For now, both tabs show the same recipients. Later you can
 * filter by a "type" field if you add one.
 */
function getFavourites(tab) {
  const all = DB.getAllRecipients();
  // For pochi tab, only show recipients with a Pochi-ish phone
  // (dummy filter — replace with a real `type` field later)
  const filtered =
    tab === "pochi"
      ? all.filter((r) => /^0[57]/.test(r.phone)) // 07xxx or 05xxx = mobile/pochi-ish
      : all;
  return filtered.slice(0, 8); // cap at 8
}
// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  renderFavourites();
  refreshMpesaBalance();
  applyPrefill();
  updateRecipientPreview();
});

function applyPrefill() {
  let phone = sessionStorage.getItem("mpesa_prefill_phone");
  let tab = null;

  // A person tapped from the Frequents list on Home
  const rawPick = sessionStorage.getItem("mpesa_frequent_pick");
  if (rawPick) {
    sessionStorage.removeItem("mpesa_frequent_pick");
    try {
      const pick = JSON.parse(rawPick);
      phone = pick.phone;
      tab = pick.type; // "mobile" | "pochi"
    } catch (_) {}
  }

  if (!phone) return;

  sessionStorage.removeItem("mpesa_prefill_phone");

  // Pay tab picks open the Pochi tab
  if (tab === "pochi") switchSendTab("pochi");

  const input = document.getElementById("phoneInput");
  if (input) {
    input.value = phone;
    onPhoneInput();
    // Focus the amount field so the user can type the amount right away
    const amt = document.getElementById("amountInput");
    if (amt) amt.focus();
  }
}

function refreshMpesaBalance() {
  const el = document.getElementById("mpesaBalance");
  if (!el || !customer) return;
  el.textContent = `Bal. ${formatCurrency(customer.balance)}`;
}

// ============================================================
// TAB SWITCH
// ============================================================

function switchSendTab(tab) {
  sendState.activeTab = tab;

  document.querySelectorAll(".segment").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  renderFavourites();
  // TODO: if switching to pochi, you may want to change the phone input
  // placeholder, hide the contact-picker icon, etc.
}

// ============================================================
// RENDER FAVOURITES
// ============================================================

function renderFavourites() {
  const row = document.getElementById("favouritesRow");
  const list = getFavourites(sendState.activeTab);

  row.innerHTML = `
  <button type="button" class="fav-item" onclick="addFavourite()">
    <div class="fav-avatar add">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none"
           stroke-linecap="round" stroke-width="2.2">
        <path d="M12 5v14" stroke="#22c55e" />
        <path d="M5 12h14" stroke="#ef4444" />
      </svg>
    </div>
    <span class="fav-name">Add</span>
  </button>
`;

  list.forEach((f) => {
    const color = f.avatarColor || colorForId(f.id);

    const avatarHtml = f.avatarUrl
      ? `<div class="fav-avatar avatar-img"><img src="${escapeHtml(f.avatarUrl)}" alt="" /></div>`
      : `<div class="fav-avatar ${color}">${getInitials(f.name)}</div>`;

    row.insertAdjacentHTML(
      "beforeend",
      `
    <button type="button" class="fav-item" onclick="selectFavourite(${f.id})">
      ${avatarHtml}
      <span class="fav-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
    </button>
  `,
    );
  });
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
// INPUT HANDLERS
// ============================================================

function onPhoneInput() {
  const input = document.getElementById("phoneInput");
  input.value = input.value.replace(/\D/g, "").slice(0, 10);
  sendState.phone = input.value;
  updateContinueButton();
  updateRecipientPreview(); // 🔹 NEW
}

/**
 * Show/hide the recipient preview under the phone input.
 * Called on every phone input change.
 */
function updateRecipientPreview() {
  const wrap = document.getElementById("recipientPreview");
  const textEl = document.getElementById("recipientPreviewText");
  if (!wrap || !textEl) return;

  const phone = sendState.phone;

  // Hide if the phone is empty or too short
  if (!phone || phone.length < 10) {
    wrap.classList.add("hidden");
    return;
  }

  // Try to resolve a saved recipient or customer
  const recipient =
    DB.getRecipientByPhone(phone) || DB.getCustomerByPhone(phone);

  if (recipient) {
    textEl.textContent = recipient.name;
    wrap.classList.remove("hidden", "muted");
    return;
  }

  // No match — but if the phone is still valid, show a "new recipient" hint
  if (isValidPhone(phone)) {
    textEl.textContent = "New recipient — name will be saved on send";
    wrap.classList.remove("hidden");
    wrap.classList.add("muted");
    return;
  }

  // Otherwise hide
  wrap.classList.add("hidden");
  wrap.classList.remove("muted");
}

function onAmountInput() {
  const input = document.getElementById("amountInput");
  // digits only
  input.value = input.value.replace(/[^\d]/g, "");
  sendState.amount = input.value;
  updateContinueButton();
}

function updateContinueButton() {
  const btn = document.getElementById("continueBtn");
  const ready =
    sendState.phone.length >= 9 && // allow 9 or 10 digits
    Number(sendState.amount) > 0;
  btn.classList.toggle("ready", ready);
}

// ============================================================
// PAYMENT METHOD
// ============================================================

function selectPaymentMethod(method) {
  sendState.paymentMethod = method;

  document.querySelectorAll(".payment-method").forEach((el) => {
    el.classList.toggle("selected", el.dataset.method === method);
  });

  // TODO: if "shiriki", fetch Shiriki Pay balance and update UI
}

// ============================================================
// FAVOURITE ACTIONS
// ============================================================

function addFavourite() {
  // TODO: open "add favourite" modal
  alert("Add favourite — coming next.");
}

function selectFavourite(id) {
  const fav = DB.getAllRecipients().find((r) => r.id === id);
  if (!fav) return;

  const input = document.getElementById("phoneInput");
  input.value = fav.phone;
  onPhoneInput();

  // Focus amount field for fast entry
  const amt = document.getElementById("amountInput");
  if (amt) amt.focus();
}

function viewAllFavourites() {
  // TODO: navigate to favourites page / open modal
  alert("All favourites — coming next.");
}

// ============================================================
// INPUT ACTION BUTTONS
// ============================================================

function pickFromContacts() {
  // TODO: use Contact Picker API or a modal
  alert("Pick from contacts — coming next.");
}

function scanQrCode() {
  // TODO: launch camera / QR scanner
  alert("Scan QR — coming next.");
}

// ============================================================
// CONTINUE
// ============================================================

function handleContinue() {
  const { phone, amount, paymentMethod, activeTab } = sendState;

  if (!isValidPhone(phone) && phone.length !== 9) {
    alert("Please enter a valid phone number.");
    return;
  }
  if (!amount || Number(amount) <= 0) {
    alert("Please enter an amount.");
    return;
  }
  if (paymentMethod !== "mpesa") {
    alert("Only M-PESA is supported in this build.");
    return;
  }

  // Look up recipient (fallback to a generic name if unknown)
  const recipient = DB.getRecipientByPhone(phone) || {
    name: activeTab === "pochi" ? "Pochi Merchant" : "Unknown Recipient",
    phone,
  };

  const draft = {
    type: activeTab,
    phone,
    amount: Number(amount),
    paymentMethod,
    recipientName: recipient.name,
    recipientId: recipient.id || null,
    avatarUrl: recipient.avatarUrl || "",
    avatarColor: recipient.avatarColor || "",
    createdAt: Date.now(),
  };

  sessionStorage.setItem("mpesa_draft_tx", JSON.stringify(draft));
  window.location.href = "confirm.html";
}

// ============================================================
// DO MORE
// ============================================================

function sendToMany() {
  // TODO: navigate to send-to-many page
  alert("Send to Many — coming next.");
}

function requestMoney() {
  window.location.href = "request-money.html";
}

function internationalTransfers() {
  alert("International Transfers — coming next.");
}

// ============================================================
// NAVIGATION
// ============================================================

function goBack() {
  // Prefer history if available, otherwise go home
  if (document.referrer && history.length > 1) {
    history.back();
  } else {
    window.location.href = "home.html";
  }
}
