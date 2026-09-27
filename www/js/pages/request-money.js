// ============================================================
// REQUEST MONEY
// Create outgoing money requests, list them, share them.
// Simulated — no real SMS sent.
// ============================================================

const customerId = Session.getLoggedInCustomerId();
const customer = customerId ? DB.getCustomerById(customerId) : null;

if (!customer) {
  window.location.href = "login.html";
}

// ---------- State ----------
const reqState = {
  tab: "new", // "new" | "mine"
  phone: "",
  amount: "",
  reason: "",
  justCreated: null, // the request object shown in the sheet
};

// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  attachTabListeners();
  updateCreateButton();
  refreshReqCount();
  openPendingRequestFromSearch();
});

function openPendingRequestFromSearch() {
  try {
    const raw = sessionStorage.getItem("mpesa_open_request");
    if (!raw) return;
    sessionStorage.removeItem("mpesa_open_request");

    const { id } = JSON.parse(raw);
    const req = DB.getAllRequests().find((r) => r.id === id);
    if (!req) return;

    // Switch to "My Requests" tab and open the share sheet
    reqState.tab = "mine";
    document
      .querySelectorAll(".req-tab")
      .forEach((b) => b.classList.toggle("active", b.dataset.tab === "mine"));
    document.getElementById("newPanel").classList.add("hidden");
    document.getElementById("minePanel").classList.remove("hidden");
    renderMyRequests();
    openShareSheet(req);
  } catch (_) {
    // ignore
  }
}

// ============================================================
// TABS
// ============================================================

function attachTabListeners() {
  document.querySelectorAll(".req-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      reqState.tab = btn.dataset.tab;
      document
        .querySelectorAll(".req-tab")
        .forEach((b) => b.classList.toggle("active", b === tab()));
      document
        .getElementById("newPanel")
        .classList.toggle("hidden", reqState.tab !== "new");
      document
        .getElementById("minePanel")
        .classList.toggle("hidden", reqState.tab !== "mine");

      if (reqState.tab === "mine") renderMyRequests();
    });
  });
}

function tab() {
  return reqState.tab;
}

// ============================================================
// INPUT HANDLERS
// ============================================================

function onReqPhoneInput() {
  const input = document.getElementById("reqPhone");
  input.value = input.value.replace(/\D/g, "").slice(0, 10);
  reqState.phone = input.value;
  updateCreateButton();
}

function onReqAmountInput() {
  const input = document.getElementById("reqAmount");
  input.value = input.value.replace(/[^\d]/g, "");
  reqState.amount = input.value;
  updateCreateButton();
}

function onReqReasonInput() {
  const input = document.getElementById("reqReason");
  reqState.reason = input.value.trim().slice(0, 60);
}

function updateCreateButton() {
  const btn = document.getElementById("createReqBtn");
  const ready = isValidPhone(reqState.phone) && Number(reqState.amount) > 0;
  btn.disabled = !ready;
}

// ============================================================
// CREATE REQUEST
// ============================================================

function createRequest() {
  if (!isValidPhone(reqState.phone)) {
    showComingSoon("Valid phone"); // tiny toast
    return;
  }
  if (!reqState.amount || Number(reqState.amount) <= 0) {
    showComingSoon("Amount required");
    return;
  }

  // Generate a unique reference ID
  let referenceId;
  do {
    referenceId = generateReferenceId();
  } while (
    DB.referenceIdExists(referenceId) ||
    DB.referenceIdExistsInRequests(referenceId)
  );

  const request = DB.insertRequest({
    requesterCustomerId: customer.id,
    requesterName: customer.name,
    requesterPhone: customer.phone,
    targetPhone: reqState.phone,
    amount: Number(reqState.amount),
    reason: reqState.reason || "",
    referenceId,
    status: "PENDING",
    createdAt: Date.now(),
  });

  // Reset form
  document.getElementById("reqPhone").value = "";
  document.getElementById("reqAmount").value = "";
  document.getElementById("reqReason").value = "";
  reqState.phone = "";
  reqState.amount = "";
  reqState.reason = "";
  updateCreateButton();

  // Show share sheet
  openShareSheet(request);
  refreshReqCount();
}

// ============================================================
// SHARE SHEET
// ============================================================

function openShareSheet(request) {
  reqState.justCreated = request;

  document.getElementById("shareRef").textContent = request.referenceId;
  document.getElementById("shareAmount").textContent = formatCurrency(
    request.amount,
  );
  document.getElementById("shareTo").textContent = request.targetPhone;

  const reasonRow = document.getElementById("shareReasonRow");
  if (request.reason) {
    reasonRow.classList.remove("hidden");
    document.getElementById("shareReason").textContent = request.reason;
  } else {
    reasonRow.classList.add("hidden");
  }

  document.getElementById("shareSheet").classList.remove("hidden");
}

function closeShareSheet() {
  document.getElementById("shareSheet").classList.add("hidden");
  reqState.justCreated = null;
}

function buildRequestText() {
  const r = reqState.justCreated;
  if (!r) return "";

  const lines = [
    `Hi! I'm requesting ${formatCurrency(r.amount)} via M-PESA.`,
    ``,
    `Reference: ${r.referenceId}`,
    `From: ${r.requesterName} (${r.requesterPhone})`,
    r.reason ? `Reason: ${r.reason}` : "",
    ``,
    `Please send to ${r.requesterPhone} and use the reference above.`,
  ];
  return lines.filter(Boolean).join("\n");
}

function copyRequestText() {
  const text = buildRequestText();
  if (!text) return;

  navigator.clipboard.writeText(text).then(
    () => showComingSoon("Copied to clipboard"),
    () => {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        showComingSoon("Copied to clipboard");
      } catch (_) {
        alert(text);
      }
      document.body.removeChild(ta);
    },
  );
}

function shareRequestText() {
  const text = buildRequestText();
  if (!text) return;

  if (navigator.share) {
    navigator
      .share({
        title: "M-PESA Money Request",
        text,
      })
      .catch(() => {});
  } else {
    copyRequestText();
  }
}

// ============================================================
// MY REQUESTS
// ============================================================

function renderMyRequests() {
  const list = DB.getRequestsByRequester(customer.id);
  const listEl = document.getElementById("reqList");
  const emptyEl = document.getElementById("reqEmpty");

  if (!list.length) {
    listEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }

  emptyEl.classList.add("hidden");

  listEl.innerHTML = list
    .map((r) => {
      const initials = getInitials(r.requesterName);
      const time = formatShortTime(r.createdAt);

      return `
        <div class="req-row" data-id="${r.id}">
          <div class="req-row-avatar">${initials}</div>
          <div class="req-row-mid">
            <div class="req-row-title">${escapeHtml(r.targetPhone)}</div>
            <div class="req-row-sub">
              ${escapeHtml(r.referenceId)}
              ${r.reason ? ` · ${escapeHtml(r.reason)}` : ""}
            </div>
          </div>
          <div class="req-row-right">
            <div class="req-row-amount">${formatCurrency(r.amount)}</div>
            <div class="req-row-time">${time}</div>
          </div>
          <button
            type="button"
            class="req-row-delete"
            data-id="${r.id}"
            aria-label="Delete request"
            title="Delete"
          >×</button>
        </div>
      `;
    })
    .join("");

  // Attach delete handlers
  listEl.querySelectorAll(".req-row-delete").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      if (!confirm("Delete this request?")) return;
      DB.deleteRequest(id);
      renderMyRequests();
      refreshReqCount();
    });
  });

  // Attach row tap (re-open share sheet)
  listEl.querySelectorAll(".req-row").forEach((row) => {
    row.addEventListener("click", () => {
      const id = Number(row.dataset.id);
      const req = DB.getAllRequests().find((r) => r.id === id);
      if (req) openShareSheet(req);
    });
  });
}

// ============================================================
// MISC
// ============================================================

function refreshReqCount() {
  const count = DB.getRequestsByRequester(customer.id).length;
  const badge = document.getElementById("reqCount");
  if (count > 0) {
    badge.textContent = String(count);
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

// ============================================================
// NAVIGATION
// ============================================================

function goBack() {
  if (document.referrer && history.length > 1) history.back();
  else window.location.href = "home.html";
}
