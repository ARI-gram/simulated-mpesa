// Seed demo data on first launch (this used to happen on index.html)
if (typeof seedIfEmpty === "function") seedIfEmpty();

// Register the service worker (this used to happen on index.html)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .catch((err) => console.warn("[PWA] SW registration failed:", err));
  });
}

let pin = "";

const pinBoxes = [
  document.getElementById("pinBox1"),
  document.getElementById("pinBox2"),
  document.getElementById("pinBox3"),
  document.getElementById("pinBox4"),
];

const loginPin = document.getElementById("loginPin");

const phoneInput = document.getElementById("loginPhone");

const displayPhone = document.getElementById("displayPhone");

const customerName = document.getElementById("customerName");

const customerInitials = document.getElementById("customerInitials");

// ============================================================
// REMEMBERED PHONE
// ============================================================

const REMEMBER_KEY = "mpesa:lastPhone";
let rememberedMode = false;

function maskPhone(p) {
  return p.length >= 10 ? p.slice(0, 4) + "****" + p.slice(-2) : p;
}

function getRememberedPhone() {
  try {
    return localStorage.getItem(REMEMBER_KEY) || "";
  } catch {
    return "";
  }
}

function rememberPhone(p) {
  try {
    localStorage.setItem(REMEMBER_KEY, p);
  } catch {}
}

function forgetPhone() {
  try {
    localStorage.removeItem(REMEMBER_KEY);
  } catch {}
}

function applyRememberedUser() {
  const phone = getRememberedPhone();
  if (!phone) return;

  const customer = DB.getCustomerByPhone(phone);
  if (!customer || customer.status === "INACTIVE") {
    forgetPhone();
    return;
  }

  rememberedMode = true;
  phoneInput.value = phone; // stays in the hidden field for login
  updateCustomerProfile();

  document.querySelector(".phone-input-wrapper").style.display = "none";
  document.getElementById("switchAccount").style.display = "block";
}

function switchAccount() {
  forgetPhone();
  rememberedMode = false;

  phoneInput.value = "";
  pin = "";
  updatePinDisplay();
  clearError();
  updateCustomerProfile();

  document.querySelector(".phone-input-wrapper").style.display = "";
  document.getElementById("switchAccount").style.display = "none";
  phoneInput.focus();
}

// ============================================================
// ERROR
// ============================================================

function showError(message) {
  const el = document.getElementById("errorMsg");

  el.textContent = message;
  el.style.display = "block";
}

// ============================================================
// HIDE ERROR
// ============================================================

function clearError() {
  const el = document.getElementById("errorMsg");

  el.textContent = "";
  el.style.display = "none";
}

// ============================================================
// GET CUSTOMER INITIALS
// ============================================================

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

// ============================================================
// UPDATE CUSTOMER PROFILE
// ============================================================

function updateCustomerProfile() {
  const phone = phoneInput.value.trim();

  displayPhone.textContent = phone
    ? rememberedMode
      ? maskPhone(phone)
      : phone
    : "----------";

  if (!phone) {
    customerInitials.textContent = "?";
    customerName.textContent = "Enter phone number";
    return;
  }

  const customer = DB.getCustomerByPhone(phone);

  if (!customer) {
    customerInitials.textContent = "?";
    customerName.textContent = "Customer not found";
    return;
  }

  customerInitials.textContent = getInitials(customer.name);

  customerName.textContent = customer.name;
}

// ============================================================
// PHONE INPUT
// ============================================================

phoneInput.addEventListener("input", function () {
  clearError();

  // Only allow numbers
  this.value = this.value.replace(/\D/g, "");

  updateCustomerProfile();
});

// ============================================================
// PIN DISPLAY
// ============================================================

function updatePinDisplay() {
  pinBoxes.forEach((box, index) => {
    if (index < pin.length) {
      box.textContent = "•";

      box.classList.add("filled");
    } else {
      box.textContent = "";

      box.classList.remove("filled");
    }
  });

  loginPin.value = pin;
}

// ============================================================
// ENTER PIN NUMBER
// ============================================================

function enterNumber(number) {
  clearError();

  if (pin.length >= 4) {
    return;
  }

  pin += number;

  updatePinDisplay();
}

// ============================================================
// DELETE PIN NUMBER
// ============================================================

function deleteNumber() {
  clearError();

  if (pin.length === 0) {
    return;
  }

  pin = pin.slice(0, -1);

  updatePinDisplay();
}

// ============================================================
// BIOMETRIC
// ============================================================

async function biometricLogin() {
  clearError();

  const phone = phoneInput.value.trim();
  if (!isValidPhone(phone)) {
    showError("Enter your phone number first, then tap the fingerprint.");
    return;
  }

  const customer = DB.getCustomerByPhone(phone);
  if (!customer) {
    showError("No account found for this phone number.");
    return;
  }
  if (customer.status === "INACTIVE") {
    showError("This account is no longer active.");
    return;
  }
  if (!customer.webauthnCredentialId) {
    showError(
      "Biometric not set up for this account. Log in with your PIN once to enable it.",
    );
    return;
  }

  if (!WebAuthn.isSupported()) {
    showError("This browser doesn't support biometric login.");
    return;
  }

  try {
    await WebAuthn.verify({
      credentialId: customer.webauthnCredentialId,
    });

    // Success → log in
    Session.clearLoginLock();
    Session.setLoggedInCustomerId(customer.id);
    rememberPhone(phone);
    window.location.href = "home.html";
  } catch (err) {
    if (WebAuthn.isUserCancelled(err)) {
      showError("Biometric cancelled. Try again or use your PIN.");
    } else {
      console.error("Biometric error:", err);
      showError("Biometric failed. Please use your PIN.");
    }
  }
}

// ============================================================
// LOGIN
// ============================================================

document
  .getElementById("loginForm")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    clearError();

    // --------------------------------------------------------
    // CHECK LOGIN LOCK
    // --------------------------------------------------------

    const lockedUntil = Session.getLoginLockUntil();

    if (lockedUntil && Date.now() < lockedUntil) {
      const secondsLeft = Math.ceil((lockedUntil - Date.now()) / 1000);

      showError(`Too many attempts. Try again in ${secondsLeft} seconds.`);

      return;
    }

    // --------------------------------------------------------
    // GET INPUTS
    // --------------------------------------------------------

    const phone = document.getElementById("loginPhone").value.trim();

    const enteredPin = document.getElementById("loginPin").value.trim();

    // --------------------------------------------------------
    // VALIDATE PHONE
    // --------------------------------------------------------

    if (!isValidPhone(phone)) {
      showError("Enter a valid phone number (e.g. 07XXXXXXXX).");

      return;
    }

    // --------------------------------------------------------
    // VALIDATE PIN
    // --------------------------------------------------------

    if (!/^\d{4}$/.test(enteredPin)) {
      showError("Enter your 4-digit PIN.");

      return;
    }

    // --------------------------------------------------------
    // FIND CUSTOMER
    // --------------------------------------------------------

    const customer = DB.getCustomerByPhone(phone);

    const genericError = "Incorrect phone number or PIN.";

    // --------------------------------------------------------
    // CUSTOMER NOT FOUND
    // --------------------------------------------------------

    if (!customer) {
      Session.registerFailedLogin();

      showError(genericError);

      return;
    }

    // --------------------------------------------------------
    // ACCOUNT INACTIVE
    // --------------------------------------------------------

    if (customer.status === "INACTIVE") {
      showError("This account is no longer active.");

      return;
    }

    // --------------------------------------------------------
    // VERIFY PIN
    // --------------------------------------------------------

    const pinMatches = await verifyPin(enteredPin, customer.pinHash);

    if (!pinMatches) {
      Session.registerFailedLogin();

      showError(genericError);

      return;
    }

    // --------------------------------------------------------
    // LOGIN SUCCESS
    // --------------------------------------------------------

    Session.clearLoginLock();

    Session.setLoggedInCustomerId(customer.id);
    rememberPhone(phone); // save the number for next time

    // Try to enrol a biometric credential (only once, never blocks login)
    await maybeRegisterBiometric(customer);

    window.location.href = "home.html";
  });
/**
 * Silently offers to register a biometric credential the first time
 * a customer logs in with their PIN. Does not block login on failure.
 */
async function maybeRegisterBiometric(customer) {
  try {
    if (!WebAuthn.isSupported()) return;
    if (customer.webauthnCredentialId) return;

    const canDoBiometric = await WebAuthn.hasPlatformAuthenticator();
    if (!canDoBiometric) return;

    const reg = await WebAuthn.register({
      userId: customer.id,
      userName: customer.phone,
      userDisplayName: customer.name,
    });

    DB.updateCustomer(customer.id, {
      webauthnCredentialId: reg.credentialId,
      webauthnRegisteredAt: reg.createdAt,
    });
  } catch (err) {
    // Silent — biometric is a nice-to-have, never blocks the login
    if (!WebAuthn.isUserCancelled(err)) {
      console.warn("Biometric registration skipped:", err);
    }
  }
}

/**
 * Show a small hint under the keypad if biometric is available.
 */
async function updateBiometricHint() {
  const hint = document.getElementById("bioHint");
  if (!hint) return;

  if (!WebAuthn.isSupported()) return;

  const hasSensor = await WebAuthn.hasPlatformAuthenticator();
  if (!hasSensor) return;

  hint.textContent = getRememberedPhone()
    ? "Tap the fingerprint icon to log in."
    : "Tap the fingerprint icon after entering your phone number.";
}

document.addEventListener("DOMContentLoaded", () => {
  applyRememberedUser();
  updateBiometricHint();
});

// ============================================================
// HIDDEN ADMIN ENTRY
// Tap the title 5 times within ~3 seconds, or Ctrl/Cmd+Shift+A
// ============================================================
(function () {
  const trigger = document.querySelector(".login-container h1");
  const ADMIN_URL = "admin-dashboard.html";
  let taps = 0;
  let timer = null;

  if (trigger) {
    trigger.style.userSelect = "none";
    trigger.style.webkitTapHighlightColor = "transparent";

    trigger.addEventListener("click", () => {
      taps += 1;
      clearTimeout(timer);
      timer = setTimeout(() => (taps = 0), 3000);

      if (taps >= 5) {
        taps = 0;
        window.location.href = ADMIN_URL;
      }
    });
  }

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "a") {
      e.preventDefault();
      window.location.href = ADMIN_URL;
    }
  });
})();
