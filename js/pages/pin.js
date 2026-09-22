// ============================================================
// ENTER M-PESA PIN — UI + verification
// Reads the pending transaction from sessionStorage, verifies
// the entered PIN against the customer's pinHash, then either
// proceeds to success.html or shows an error.
// ============================================================

const customerId = Session.getLoggedInCustomerId();
const customer = customerId ? DB.getCustomerById(customerId) : null;

if (!customer) {
  window.location.href = "login.html";
}

// ---------- Load pending transaction ----------
let pending = null;
try {
  const raw = sessionStorage.getItem("mpesa_pending_tx");
  pending = raw ? JSON.parse(raw) : null;
} catch (_) {
  pending = null;
}

if (!pending) {
  // No transaction to authorize — bounce back to Send Money
  window.location.href = "send-money.html";
}

// ---------- State ----------
let pin = "";
let locked = false; // true while verifying / navigating

// ---------- Cache DOM ----------
const pinBoxes = Array.from(document.querySelectorAll(".pin-box"));
const pinErrorEl = document.getElementById("pinError");
const keypad = document.getElementById("keypad");

// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  populateRecipient();
  attachKeypadListeners();
  attachKeyboardListener();
  updateBiometricButton();
});

/**
 * Show/hide the fingerprint key based on device + account support.
 * Hides it entirely when unsupported so it doesn't confuse users.
 */
async function updateBiometricButton() {
  const btn = document.querySelector('.key[data-key="fingerprint"]');
  if (!btn) return;

  if (!WebAuthn.isSupported()) {
    btn.style.display = "none";
    return;
  }

  const hasSensor = await WebAuthn.hasPlatformAuthenticator();
  if (!hasSensor) {
    btn.style.display = "none";
    return;
  }

  // Dim if the customer hasn't registered a biometric yet
  if (!customer.webauthnCredentialId) {
    btn.style.opacity = "0.45";
    btn.title = "Enable biometric by logging in with your PIN once";
  }
}

function populateRecipient() {
  const avatarEl = document.getElementById("recipientAvatar");
  const nameEl = document.getElementById("recipientName");
  const subEl = document.getElementById("recipientSub");

  // Build avatar
  const avatarHtml = renderAvatar(
    {
      name: pending.recipientName,
      avatarUrl: pending.avatarUrl,
      avatarColor: pending.avatarColor,
    },
    {
      className: "recipient-avatar",
      fallbackClass: "red", // keeps your red default
    },
  );

  avatarEl.outerHTML = avatarHtml.replace(
    'class="recipient-avatar',
    'id="recipientAvatar" class="recipient-avatar',
  );

  nameEl.textContent = (
    pending.recipientName || "Unknown Recipient"
  ).toUpperCase();

  const amount = Number(pending.amount || 0).toFixed(2);
  subEl.innerHTML = `Ksh. ${amount} &nbsp; Fee: Ksh. 0.00`;
}

// ============================================================
// KEYPAD
// ============================================================

function attachKeypadListeners() {
  keypad.querySelectorAll(".key").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key;
      if (key === "delete") return handleDelete();
      if (key === "fingerprint") return handleFingerprint();
      return handleDigit(key);
    });
  });
}

// ============================================================
// PHYSICAL KEYBOARD (desktop convenience)
// ============================================================

function attachKeyboardListener() {
  document.addEventListener("keydown", (e) => {
    if (locked) return;

    if (/^[0-9]$/.test(e.key)) return handleDigit(e.key);
    if (e.key === "Backspace") return handleDelete();
    if (e.key === "Escape") return goBack();
  });
}

// ============================================================
// DIGIT
// ============================================================

function handleDigit(digit) {
  if (locked) return;
  if (pin.length >= 4) return;

  clearError();
  pin += digit;
  renderPin();

  if (pin.length === 4) {
    // Small delay so the 4th dot renders before we verify
    setTimeout(verifyAndProceed, 150);
  }
}

// ============================================================
// DELETE
// ============================================================

function handleDelete() {
  if (locked) return;
  if (pin.length === 0) return;

  clearError();
  pin = pin.slice(0, -1);
  renderPin();
}

// ============================================================
// FINGERPRINT (stub)
// ============================================================

async function handleFingerprint() {
  if (locked) return;

  clearError();

  // If customer has no credential or browser doesn't support it → explain.
  if (!WebAuthn.isSupported()) {
    showError("Biometric isn't supported on this device.");
    return;
  }
  if (!customer.webauthnCredentialId) {
    showError("Biometric not set up. Log in with your PIN once to enable it.");
    return;
  }

  locked = true;

  try {
    const ok = await WebAuthn.verify({
      credentialId: customer.webauthnCredentialId,
    });

    if (!ok) throw new Error("Verify returned false");

    // Biometric success → carry the transaction through to success.
    Session.clearLoginLock();
    window.location.href = "success.html";
  } catch (err) {
    locked = false;
    if (WebAuthn.isUserCancelled(err)) {
      showError("Biometric cancelled. Enter your PIN to continue.");
    } else {
      console.error("Biometric error:", err);
      showError("Biometric failed. Please use your PIN.");
    }
  }
}

// ============================================================
// RENDER PIN DOTS
// ============================================================

function renderPin() {
  pinBoxes.forEach((box, i) => {
    if (i < pin.length) {
      box.textContent = "•";
      box.classList.add("filled");
    } else {
      box.textContent = "";
      box.classList.remove("filled");
    }
    box.classList.remove("error");
  });
}

// ============================================================
// VERIFY + PROCEED
// ============================================================

async function verifyAndProceed() {
  locked = true;

  const ok = await verifyPin(pin, customer.pinHash);

  if (!ok) {
    // Wrong PIN
    Session.registerFailedLogin();
    flashError("Incorrect PIN. Please try again.");
    pin = "";
    renderPin();
    locked = false;
    return;
  }

  // Correct PIN
  Session.clearLoginLock();

  // NOTE: We are NOT yet calling processPayment() here.
  // That will be wired when we build success.html so the flow is:
  //   pin.html  →  success.html  (success.html reads pending tx and processes it)
  //
  // If you'd rather process here, uncomment the block below:

  /*
  try {
    const tx = processPayment(customer.id, Number(pending.amount), (refId, newBal) => ({
      senderCustomerId: customer.id,
      type: pending.type === "pochi" ? "POCHI_PAY" : "SEND_MONEY",
      amount: Number(pending.amount),
      recipientName: pending.recipientName,
      recipientIdentifier: pending.phone,
      direction: "OUT",
    }));

    sessionStorage.setItem("mpesa_last_tx", JSON.stringify(tx));
  } catch (err) {
    locked = false;
    flashError(err.message || "Transaction failed.");
    return;
  }
  */

  // Navigate to success page
  window.location.href = "success.html";
}

// ============================================================
// ERROR UI
// ============================================================

function showError(message) {
  pinErrorEl.textContent = message;
  pinErrorEl.style.display = "block";
}

function clearError() {
  pinErrorEl.textContent = "";
  pinErrorEl.style.display = "none";
}

function flashError(message) {
  showError(message);
  pinBoxes.forEach((b) => b.classList.add("error"));

  // Optional haptic on mobile
  if (navigator.vibrate) navigator.vibrate(120);

  setTimeout(() => {
    pinBoxes.forEach((b) => b.classList.remove("error"));
  }, 400);
}

// ============================================================
// NAVIGATION
// ============================================================

function goBack() {
  // Go back to the confirm screen
  window.location.href = "confirm.html";
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
