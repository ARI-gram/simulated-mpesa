// ============================================================
// ADMIN DASHBOARD
// Gate → Overview stats → Tabs (Customers / Transactions /
// Recipients / Merchants) → Danger zone.
// ============================================================

// ---------- Config ----------
const ADMIN_PASSCODE = "admin1234"; // change this later
const ADMIN_SESSION_KEY = "mpesa_admin_unlocked";
let activeTab = "customers";
let modalType = null;
let modalEditingId = null; // null = new, number = editing
let modalAvatarUrl = ""; // temp URL while editing
let modalAvatarColor = "purple"; // temp color while editing
// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  // Restore unlock for this browser session
  if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") {
    unlockUI();
  } else {
    document.getElementById("adminPass").focus();
  }
});

// ============================================================
// AUTH
// ============================================================

function tryAdminLogin() {
  const input = document.getElementById("adminPass");
  const errEl = document.getElementById("gateError");
  const val = input.value.trim();

  if (val !== ADMIN_PASSCODE) {
    errEl.textContent = "Incorrect passcode.";
    errEl.style.display = "block";
    input.value = "";
    input.focus();
    return;
  }

  errEl.style.display = "none";
  sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
  unlockUI();
}

function lockAdmin() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  document.getElementById("adminPage").classList.add("hidden");
  document.getElementById("adminGate").classList.remove("hidden");
  document.getElementById("adminPass").value = "";
  document.getElementById("gateError").style.display = "none";
  document.getElementById("adminPass").focus();
}

function unlockUI() {
  document.getElementById("adminGate").classList.add("hidden");
  document.getElementById("adminPage").classList.remove("hidden");

  // Seed if empty (so admin always sees something)
  seedIfEmpty().then(() => {
    renderStats();
    attachTabListeners();
    renderPanel();
  });
}

// ============================================================
// STATS
// ============================================================

function renderStats() {
  const customers = DB.getAllCustomers();
  const txns = DB.getAllTransactions();
  const recipients = DB.getAllRecipients();

  const volume = txns.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const active = customers.filter((c) => c.status === "ACTIVE").length;

  document.getElementById("statsGrid").innerHTML = `
    <div class="stat-card">
      <span class="stat-label">Customers</span>
      <div class="stat-value green">${customers.length}</div>
    </div>
    <div class="stat-card">
      <span class="stat-label">Transactions</span>
      <div class="stat-value">${txns.length}</div>
    </div>
    <div class="stat-card">
      <span class="stat-label">Volume</span>
      <div class="stat-value blue">${formatCurrency(volume)}</div>
    </div>
    <div class="stat-card">
      <span class="stat-label">Active / Favourites</span>
      <div class="stat-value">${active} / ${recipients.length}</div>
    </div>
  `;
}

// ============================================================
// TABS
// ============================================================

function attachTabListeners() {
  document.querySelectorAll(".admin-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      document
        .querySelectorAll(".admin-tab")
        .forEach((b) => b.classList.toggle("active", b === btn));
      renderPanel();
    });
  });
}

function renderPanel() {
  const main = document.getElementById("adminMain");

  switch (activeTab) {
    case "customers":
      main.innerHTML = renderCustomersPanel();
      break;
    case "transactions":
      main.innerHTML = renderTransactionsPanel();
      break;
    case "recipients":
      main.innerHTML = renderRecipientsPanel();
      break;
    case "merchants":
      main.innerHTML = renderMerchantsPanel();
      break;
    default:
      main.innerHTML = "";
  }

  attachRowActions();
}

// ============================================================
// PANELS
// ============================================================

function renderCustomersPanel() {
  const customers = DB.getAllCustomers();

  if (!customers.length) {
    return `<div class="admin-empty">No customers yet.</div>`;
  }

  return `
    <div class="data-list">
      ${customers
        .map((c) => {
          const initials = getInitials(c.name);
          const inactive = c.status !== "ACTIVE";
          return `
          <div class="data-row" data-id="${c.id}">
            <div class="data-row-avatar">${initials}</div>
            <div class="data-row-mid">
              <div class="data-row-title">${escapeHtml(c.name)}</div>
              <div class="data-row-sub">${escapeHtml(c.phone)}</div>
            </div>
            <div class="data-row-right">
              <div class="data-row-amount">${formatCurrency(c.balance)}</div>
              ${
                inactive
                  ? `<span class="data-row-badge inactive">INACTIVE</span>`
                  : ``
              }
            </div>
            <button
              type="button"
              class="row-delete"
              data-action="delete-customer"
              data-id="${c.id}"
              aria-label="Delete customer"
              title="Delete"
            >×</button>
          </div>
        `;
        })
        .join("")}
    </div>
  `;
}

function renderTransactionsPanel() {
  const txns = DB.getAllTransactions();

  if (!txns.length) {
    return `<div class="admin-empty">No transactions yet.</div>`;
  }

  return `
    <div class="data-list">
      ${txns
        .slice(0, 100)
        .map((t) => {
          const isIn = t.direction === "IN";
          const sign = isIn ? "+" : "-";
          const cls = isIn ? "in" : "out";
          const initials = getInitials(t.recipientName || "?");

          return `
          <div class="data-row" data-id="${t.id}">
            <div class="data-row-avatar ${
              t.type === "REVERSAL" ? "blue" : isIn ? "purple" : ""
            }">${initials}</div>
            <div class="data-row-mid">
              <div class="data-row-title">${escapeHtml(t.recipientName || "—")}</div>
              <div class="data-row-sub">${escapeHtml(t.referenceId || "")} · ${escapeHtml(t.recipientIdentifier || "")}</div>
            </div>
            <div class="data-row-right">
              <div class="data-row-amount ${cls}">
                ${sign}${formatCurrency(t.amount)}
              </div>
              ${t.reversed ? `<span class="data-row-badge reversed">REVERSED</span>` : ""}
            </div>
          </div>
        `;
        })
        .join("")}
    </div>
  `;
}

function renderRecipientsPanel() {
  const recs = DB.getAllRecipients();

  const addButton = `
    <div class="panel-add-row">
      <button type="button" class="panel-add-btn" onclick="openAddRecipient()">
        <span class="plus">+</span> Add recipient
      </button>
    </div>
  `;

  if (!recs.length) {
    return (
      addButton + `<div class="admin-empty">No saved recipients yet.</div>`
    );
  }

  return (
    addButton +
    `
    <div class="data-list">
      ${recs
        .map((r) => {
          return `
          <div class="data-row" data-id="${r.id}">
            ${renderAvatarHtml(r, "data-row-avatar")}
            <div class="data-row-mid" onclick="openEditRecipient(${r.id})" style="cursor:pointer">
              <div class="data-row-title">${escapeHtml(r.name)}</div>
              <div class="data-row-sub">${escapeHtml(r.phone)}</div>
            </div>
            <button
              type="button"
              class="row-delete"
              data-action="delete-recipient"
              data-id="${r.id}"
              aria-label="Delete recipient"
              title="Delete"
            >×</button>
          </div>
        `;
        })
        .join("")}
    </div>
    `
  );
}

function renderMerchantsPanel() {
  const ms = DB.getAllMerchants();

  const addButton = `
    <div class="panel-add-row">
      <button
        type="button"
        class="panel-add-btn"
        onclick="openAddMerchant()"
      >
        <span class="plus">+</span> Add merchant
      </button>
    </div>
  `;

  if (!ms.length) {
    return addButton + `<div class="admin-empty">No merchants yet.</div>`;
  }

  return (
    addButton +
    `
    <div class="data-list">
      ${ms
        .map(
          (m) => `
          <div class="data-row" data-id="${m.id}">
            <div class="data-row-avatar blue">${(m.type || "?").charAt(0)}</div>
            <div class="data-row-mid">
              <div class="data-row-title">${escapeHtml(m.businessName || "—")}</div>
              <div class="data-row-sub">${escapeHtml(m.type || "")} · ${escapeHtml(m.identifier || "")}</div>
            </div>
            <div class="data-row-right">
              <div class="data-row-amount in">${formatCurrency(m.totalReceived || 0)}</div>
            </div>
            <button
              type="button"
              class="row-delete"
              data-action="delete-merchant"
              data-id="${m.id}"
              aria-label="Delete merchant"
              title="Delete"
            >×</button>
          </div>
        `,
        )
        .join("")}
    </div>
    `
  );
}

// ============================================================
// ROW ACTIONS
// ============================================================

function attachRowActions() {
  document.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = el.dataset.action;
      const id = Number(el.dataset.id);

      if (action === "delete-customer") {
        if (!confirm(`Delete customer #${id} and all their data?`)) return;
        DB.deleteCustomer(id);
        refresh();
        return;
      }

      if (action === "delete-recipient") {
        if (!confirm(`Delete recipient #${id}?`)) return;
        DB.deleteRecipient(id);
        refresh();
        return;
      }

      if (action === "delete-merchant") {
        if (!confirm(`Delete merchant #${id}?`)) return;
        DB.deleteMerchant(id);
        refresh();
        return;
      }
    });
  });
}

function refresh() {
  renderStats();
  renderPanel();
}

// ============================================================
// DANGER ZONE
// ============================================================

function clearAllData() {
  const sure = confirm(
    "This will DELETE all customers, transactions, messages, and recipients.\n\n" +
      "This cannot be undone. Continue?",
  );
  if (!sure) return;

  DB.clearAll();
  refresh();
  alert("All data cleared.");
}

async function reseedData() {
  const sure = confirm(
    "This will CLEAR all data and re-seed the demo accounts.\n\nContinue?",
  );
  if (!sure) return;

  await seedDefaults();
  refresh();
  alert("Demo data restored.");
}

/* ============================================================
   ADMIN MODAL — ADD RECIPIENT / ADD MERCHANT
   ============================================================ */

const modalEl = () => document.getElementById("adminModal");
const modalTitleEl = () => document.getElementById("modalTitle");
const modalFieldsEl = () => document.getElementById("modalFields");
const modalErrorEl = () => document.getElementById("modalError");

// ---------- Recipient ----------

function openAddRecipient() {
  modalType = "recipient";
  modalEditingId = null;
  modalAvatarUrl = "";
  modalAvatarColor = "purple";

  document.getElementById("modalTitle").textContent = "Add recipient";
  document.getElementById("modalError").style.display = "none";
  document.getElementById("modalFields").innerHTML = buildRecipientFieldsHtml();

  updateAvatarPreview();
  updateSwatchSelection();

  document.getElementById("adminModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("recName").focus(), 100);
}

// ---------- Merchant ----------

function openAddMerchant() {
  modalType = "merchant";
  modalTitleEl().textContent = "Add merchant";
  modalErrorEl().style.display = "none";

  modalFieldsEl().innerHTML = `
    <label for="merType">Type</label>
    <select id="merType">
      <option value="TILL">TILL — Buy Goods</option>
      <option value="PAYBILL">PAYBILL — Pay Bill</option>
      <option value="POCHI">POCHI — Pochi la Biashara</option>
    </select>

    <label for="merIdentifier">Identifier</label>
    <input
      type="text"
      id="merIdentifier"
      placeholder="e.g. 123456"
      maxlength="12"
      required
    />

    <label for="merName">Business name</label>
    <input
      type="text"
      id="merName"
      placeholder="e.g. Mama Mboga Grocery"
      maxlength="40"
      required
    />
  `;

  modalEl().classList.remove("hidden");
  setTimeout(() => document.getElementById("merType").focus(), 100);
}

// ---------- Save ----------

function saveAdminModal(event) {
  event.preventDefault();
  modalErrorEl().style.display = "none";

  if (modalType === "recipient") {
    return saveRecipient();
  }
  if (modalType === "merchant") {
    return saveMerchant();
  }
}

function saveRecipient() {
  const name = document.getElementById("recName").value.trim();
  const phone = document.getElementById("recPhone").value.trim();

  if (!name) return showModalError("Please enter a name.");
  if (!isValidPhone(phone))
    return showModalError("Enter a valid phone number (e.g. 07XXXXXXXX).");

  // Duplicate check (skip when editing the same record)
  const existing = DB.getRecipientByPhone(phone);
  if (existing && existing.id !== modalEditingId) {
    return showModalError("This phone is already saved as a recipient.");
  }

  const payload = {
    name,
    phone,
    avatarUrl: modalAvatarUrl || "",
    avatarColor: modalAvatarColor,
  };

  if (modalEditingId) {
    DB.updateRecipient(modalEditingId, payload);
  } else {
    DB.insertRecipient({ ...payload, createdAt: Date.now() });

    // Also ensure a customer record exists
    if (!DB.getCustomerByPhone(phone)) {
      DB.insertCustomer({
        name,
        phone,
        pinHash: "",
        balance: 0,
        status: "ACTIVE",
        isStub: true,
        createdAt: Date.now(),
      });
    }
  }

  closeAdminModal();
  refresh();
}

function saveMerchant() {
  const type = document.getElementById("merType").value;
  const identifier = document.getElementById("merIdentifier").value.trim();
  const businessName = document.getElementById("merName").value.trim();

  if (!identifier) {
    return showModalError("Please enter an identifier.");
  }
  if (!businessName) {
    return showModalError("Please enter a business name.");
  }
  if (
    DB.getAllMerchants().some(
      (m) => m.type === type && m.identifier === identifier,
    )
  ) {
    return showModalError("This merchant already exists.");
  }

  DB.insertMerchant({
    type,
    identifier,
    businessName,
    totalReceived: 0,
    createdAt: Date.now(),
  });

  closeAdminModal();
  refresh();
}

// ---------- Close / errors ----------

function closeAdminModal() {
  modalType = null;
  modalEditingId = null;
  modalAvatarUrl = "";
  modalAvatarColor = "purple";
  document.getElementById("adminModal").classList.add("hidden");
  document.getElementById("modalFields").innerHTML = "";
  document.getElementById("modalError").style.display = "none";
}

function showModalError(message) {
  const el = document.getElementById("modalError");
  el.textContent = message;
  el.style.display = "block";
}

/* ============================================================
   AVATAR PICKER
   ============================================================ */

function onAvatarFilePicked(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  compressImageFile(file, 64)
    .then((dataUrl) => {
      modalAvatarUrl = dataUrl;
      updateAvatarPreview();
    })
    .catch((err) => {
      console.error(err);
      showModalError("Could not process that image.");
    });
}

function onAvatarUrlInput(event) {
  modalAvatarUrl = event.target.value.trim();
  updateAvatarPreview();
}

function pickAvatarColor(color) {
  modalAvatarColor = color;
  // A picked color clears the image so the color wins
  modalAvatarUrl = "";
  const urlInput = document.getElementById("avatarUrl");
  if (urlInput) urlInput.value = "";
  updateAvatarPreview();
  updateSwatchSelection();
}

function updateSwatchSelection() {
  document.querySelectorAll(".swatch").forEach((s) => {
    s.classList.toggle(
      "selected",
      s.dataset.color === modalAvatarColor && !modalAvatarUrl,
    );
  });
}

function updateAvatarPreview() {
  const preview = document.getElementById("avatarPreview");
  if (!preview) return;

  const nameInput = document.getElementById("recName");
  const name = nameInput ? nameInput.value : "";

  if (modalAvatarUrl) {
    preview.innerHTML = `<img src="${modalAvatarUrl}" alt="" />`;
    preview.className = "avatar-preview has-image";
  } else {
    preview.textContent = getInitials(name || "?");
    preview.className = `avatar-preview ${modalAvatarColor}`;
  }
}

function onRecipientFieldChanged() {
  // Keep the preview initial letters in sync with the name field
  updateAvatarPreview();
}

function openEditRecipient(id) {
  const rec = DB.getAllRecipients().find((r) => r.id === id);
  if (!rec) return;

  modalType = "recipient";
  modalEditingId = id;
  modalAvatarUrl = rec.avatarUrl || "";
  modalAvatarColor = rec.avatarColor || "purple";

  document.getElementById("modalTitle").textContent = "Edit recipient";
  document.getElementById("modalError").style.display = "none";

  // Same markup as openAddRecipient — refactor into a shared helper if you like
  document.getElementById("modalFields").innerHTML = buildRecipientFieldsHtml();

  // Pre-fill
  document.getElementById("recName").value = rec.name;
  document.getElementById("recPhone").value = rec.phone;
  document.getElementById("avatarUrl").value = rec.avatarUrl || "";

  updateAvatarPreview();
  updateSwatchSelection();

  document.getElementById("adminModal").classList.remove("hidden");
  setTimeout(() => document.getElementById("recName").focus(), 100);
}

function buildRecipientFieldsHtml() {
  return `
    <div class="avatar-picker">
      <div class="avatar-preview" id="avatarPreview">?</div>
      <div class="avatar-picker-actions">
        <label class="avatar-upload-label" for="avatarFile">Upload photo</label>
        <input type="file" id="avatarFile" accept="image/*"
               style="display:none" onchange="onAvatarFilePicked(event)" />
      </div>
    </div>

    <label for="avatarUrl">Or paste image URL</label>
    <input type="url" id="avatarUrl" placeholder="https://…"
           oninput="onAvatarUrlInput(event)" />

    <label>Or pick a colour</label>
    <div class="color-swatches" id="colorSwatches">
      <button type="button" class="swatch green"  data-color="green"  onclick="pickAvatarColor('green')"></button>
      <button type="button" class="swatch blue"   data-color="blue"   onclick="pickAvatarColor('blue')"></button>
      <button type="button" class="swatch purple" data-color="purple" onclick="pickAvatarColor('purple')"></button>
      <button type="button" class="swatch pink"   data-color="pink"   onclick="pickAvatarColor('pink')"></button>
      <button type="button" class="swatch red"    data-color="red"    onclick="pickAvatarColor('red')"></button>
      <button type="button" class="swatch orange" data-color="orange" onclick="pickAvatarColor('orange')"></button>
    </div>

    <label for="recName">Full name</label>
    <input type="text" id="recName" maxlength="40" autocomplete="name"
           oninput="onRecipientFieldChanged()" required />

    <label for="recPhone">Phone number</label>
    <input type="tel" id="recPhone" maxlength="10" inputmode="numeric"
           autocomplete="tel" oninput="onRecipientFieldChanged()" required />
  `;
}
