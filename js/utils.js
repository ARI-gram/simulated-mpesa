async function hashPin(pin) {
  const data = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyPin(pin, storedHash) {
  return (await hashPin(pin)) === storedHash;
}

function generateReferenceId(transactionDate = new Date()) {
  // -----------------------------------------
  // 1. YEAR
  // -----------------------------------------
  // 2026 -> U
  // 2025 -> T
  // 2024 -> S
  //
  // The sequence advances alphabetically each year.
  const year = transactionDate.getFullYear();

  const yearCode = String.fromCharCode("S".charCodeAt(0) + (year - 2024));

  // -----------------------------------------
  // 2. MONTH
  // -----------------------------------------
  // January = A
  // February = B
  // ...
  // September = I
  // December = L
  const month = transactionDate.getMonth(); // 0-11

  const monthCode = String.fromCharCode("A".charCodeAt(0) + month);

  // -----------------------------------------
  // 3. DAY
  // -----------------------------------------
  const day = transactionDate.getDate();

  let dayCode;

  if (day <= 9) {
    dayCode = String(day);
  } else {
    // 10 = A
    // 11 = B
    // ...
    // 31 = V
    dayCode = String.fromCharCode("A".charCodeAt(0) + (day - 10));
  }

  // -----------------------------------------
  // 4. RANDOM 7 CHARACTERS
  // -----------------------------------------
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  let suffix = "";

  for (let i = 0; i < 7; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }

  return `${yearCode}${monthCode}${dayCode}${suffix}`;
}

function formatCurrency(amount) {
  return (
    "Ksh " +
    amount.toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatDateTime(timestampMs) {
  const d = new Date(timestampMs);
  const datePart = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
  const timePart = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart} at ${timePart}`;
}

// "Ksh100.00" (no space, like real M-PESA SMS)
function smsMoney(amount) {
  return (
    "Ksh" +
    Number(amount).toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

// "24/9/26 at 7:50 AM" (no leading zeros, uppercase AM/PM)
function smsDateTime(ts) {
  const d = new Date(ts);
  const datePart = `${d.getDate()}/${d.getMonth() + 1}/${String(
    d.getFullYear(),
  ).slice(-2)}`;
  const timePart = d
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toUpperCase();
  return `${datePart} at ${timePart}`;
}

function isValidPhone(phone) {
  return /^0\d{9}$/.test(phone);
}

function normalizePhone(input) {
  let p = input.trim();
  if (p.startsWith("+254")) p = "0" + p.slice(4);
  else if (p.startsWith("254")) p = "0" + p.slice(3);
  return p;
}

// The atomic "deduct + record + message" operation — equivalent of
// TransactionRepository.processPayment() from the Android version.
// Now TWO-SIDED: the recipient is also credited.
function processPayment(senderCustomerId, amount, buildFields) {
  const customer = DB.getCustomerById(senderCustomerId);
  if (!customer) throw new Error("Customer not found");
  if (customer.balance < amount) throw new Error("Insufficient balance");

  // Build the transaction fields to extract recipient info
  const fields = buildFields("PENDING", 0); // refId placeholder, bal placeholder

  const recipientIdentifier = fields.recipientIdentifier;
  const recipientName = fields.recipientName;

  if (!recipientIdentifier) {
    throw new Error("Missing recipient identifier");
  }

  // 🔹 Two-sided: ensure the recipient exists, then credit them
  const recipientCustomer = DB.findOrCreateCustomerByPhone(
    recipientIdentifier,
    recipientName,
  );

  // Generate the reference ID for the sender's transaction
  let referenceId;
  do {
    referenceId = generateReferenceId();
  } while (DB.referenceIdExists(referenceId));

  // --- Debit sender ---
  const newSenderBalance = customer.balance - amount;
  DB.updateCustomerBalance(senderCustomerId, newSenderBalance);

  // --- Credit recipient ---
  const newRecipientBalance = DB.creditCustomer(recipientCustomer.id, amount);

  // Try to enrich the transaction with the recipient's saved avatar
  const savedRecipient = DB.getRecipientByPhone(recipientIdentifier);

  const transaction = DB.insertTransaction({
    ...fields,
    referenceId,
    balanceAfter: newSenderBalance,
    recipientCustomerId: recipientCustomer.id,
    avatarUrl: savedRecipient?.avatarUrl || fields.avatarUrl || "",
    avatarColor: savedRecipient?.avatarColor || fields.avatarColor || "",
    status: "SUCCESS",
    createdAt: Date.now(),
  });

  // --- Insert transaction for the recipient (IN) ---
  DB.insertTransaction({
    senderCustomerId: recipientCustomer.id,
    type: "RECEIVE_MONEY",
    direction: "IN",
    amount: amount,
    recipientName: customer.name, // "from" them
    recipientIdentifier: customer.phone,
    referenceId, // same ref — one event, two ledgers
    balanceAfter: newRecipientBalance,
    counterpartyCustomerId: senderCustomerId, // 🔹 link back
    status: "SUCCESS",
    createdAt: Date.now(),
  });

  // --- SMS for the sender (M-PESA confirmation) ---
  const transactionType = (transaction.type || "").toUpperCase();

  const isPochi =
    transactionType === "POCHI" || transactionType === "POCHI_PAY";

  const verb = isPochi ? "paid to" : "sent to";

  const recipientPart = isPochi
    ? transaction.recipientName.toUpperCase()
    : `${transaction.recipientName.toUpperCase()} ${transaction.recipientIdentifier}`;

  const dailyTransactionLimitRemaining = 499890;

  const body =
    `${transaction.referenceId} Confirmed. ${smsMoney(transaction.amount)} ${verb} ` +
    `${recipientPart} on ` +
    `${smsDateTime(transaction.createdAt)}. ` +
    `New M-PESA balance is ${smsMoney(newSenderBalance)}. ` +
    `Transaction cost, Ksh0.00. ` +
    `Amount you can transact within the day is ${dailyTransactionLimitRemaining.toLocaleString(
      "en-KE",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    )}. ` +
    `See all your balances now https://saf.cx/iqIzU`;

  const message = DB.insertMessage({
    transactionId: transaction.id,
    threadName: "M-PESA",
    body,
    createdAt: transaction.createdAt,
  });

  // Show a system notification when the transaction succeeds.
  if (typeof showMpesaNotification === "function") {
    showMpesaNotification(transaction, message);
  }

  return transaction;
}

/* ============================================================
   SHARED UI HELPERS
   Used across pages to avoid duplication.
   ============================================================ */

/**
 * Get up to two initials from a full name.
 * Handles empty strings, double spaces, single-word names.
 */
function getInitials(name) {
  if (!name) return "?";
  return (
    String(name)
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

/**
 * Format a timestamp as "16th Sep 2026 | 8:18 am"
 */
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

/**
 * Format a timestamp as "8:18 am" if today, else "21 Sep".
 */
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

/**
 * Extract the M-PESA reference ID from the start of a message body.
 * Example: "UILGR6Y29R Confirmed. Ksh80.00 sent to ..." → "UILGR6Y29R"
 */
function extractReference(body) {
  if (!body) return null;
  const m = String(body).match(/^([A-Z0-9]{8,12})\s+Confirmed\./i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Format a timestamp as a message day-divider label:
 * "Today" / "Yesterday" / "21 Sep 2026"
 */
function formatDayLabel(ts) {
  const d = new Date(ts);
  const today = new Date();

  const dayKey = (x) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;

  if (dayKey(d) === dayKey(today)) return "Today";

  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (dayKey(d) === dayKey(y)) return "Yesterday";

  return `${d.getDate()} ${d.toLocaleString("en-GB", {
    month: "short",
  })} ${d.getFullYear()}`;
}

/**
 * Escape HTML entities to prevent injection when inserting into innerHTML.
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Convert URLs inside plain text to clickable links.
 * Assumes the text is already HTML-escaped.
 */
function linkify(text) {
  return String(text).replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`,
  );
}

/**
 * Show a simple "coming soon" toast at the bottom of the screen.
 * Auto-dismisses after 2 seconds. No dependencies.
 */
function showComingSoon(label) {
  const id = "coming-soon-toast";

  // Remove any existing one first
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const el = document.createElement("div");
  el.id = id;
  el.textContent = `${label} — coming soon`;
  Object.assign(el.style, {
    position: "fixed",
    left: "50%",
    bottom: "80px",
    transform: "translateX(-50%)",
    background: "#1f1f1f",
    color: "#e6e6e6",
    padding: "10px 18px",
    borderRadius: "999px",
    fontSize: "13px",
    fontWeight: "600",
    boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
    zIndex: "9999",
    opacity: "0",
    transition: "opacity 0.2s ease, transform 0.2s ease",
    pointerEvents: "none",
    fontFamily: "inherit",
    maxWidth: "calc(100vw - 40px)",
    textAlign: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  });

  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateX(-50%) translateY(-6px)";
  });

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%)";
    setTimeout(() => el.remove(), 250);
  }, 2000);
}

/**
 * Update every `.status-bar .time` on the page to the current time.
 * Called by pages on DOMContentLoaded.
 */
function updateStatusBarTime() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const str = `${hh}:${mm}`;
  document.querySelectorAll(".status-bar .time").forEach((el) => {
    el.textContent = str;
  });
}

/* Auto-run status-bar time refresh on every page that loads utils.js */
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateStatusBarTime);
  } else {
    updateStatusBarTime();
  }
}

/* ============================================================
   AVATAR HELPERS
   Used by admin + every page that shows a recipient avatar.
   ============================================================ */

/**
 * Render an avatar block. Prioritizes:
 *   1. Avatar image URL (from URL field or uploaded data URL)
 *   2. Initials on a colored background
 *
 * @param {Object} rec - { name, avatarUrl?, avatarColor? }
 * @param {Object} opts
 *   - className: base class (default "avatar")
 *   - fallbackColor: color name when rec.avatarColor is empty
 *   - fallbackClass: overrides the color class (for type-based colors)
 * @returns HTML string
 */
function renderAvatar(rec, opts = {}) {
  const className = opts.className || "avatar";
  const color = rec.avatarColor || opts.fallbackColor || "purple";
  const extraClass = opts.fallbackClass || color;
  const initials = getInitials(rec.name || "?");
  const url = rec.avatarUrl || "";

  if (url) {
    return `
      <div class="${className} avatar-img">
        <img
          src="${escapeHtml(url)}"
          alt="${escapeHtml(initials)}"
          onerror="this.parentElement.classList.remove('avatar-img'); this.parentElement.textContent='${escapeHtml(initials)}';"
        />
      </div>
    `;
  }

  return `<div class="${className} ${extraClass}">${initials}</div>`;
}

/**
 * Compress an uploaded image File to a small square JPEG data URL.
 * @param {File} file
 * @param {number} maxSize  pixel size of the square output (default 64)
 * @returns Promise<string>  data URL like "data:image/jpeg;base64,..."
 */
function compressImageFile(file, maxSize = 64) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Not a valid image"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d");

        // Center-crop to square
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;

        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);

        // 64×64 JPEG at 75% quality ≈ 3–5 KB
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
