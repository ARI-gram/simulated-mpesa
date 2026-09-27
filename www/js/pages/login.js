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

  displayPhone.textContent = phone || "----------";

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

    // 🔹 Try to enrol a biometric credential for this customer
    // (only if supported, has a platform authenticator, and
    //  they don't already have one registered).
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

  hint.textContent =
    "Tap the fingerprint icon after entering your phone number.";
}

document.addEventListener("DOMContentLoaded", () => {
  updateBiometricHint();
});
