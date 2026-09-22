function showError(message) {
  const el = document.getElementById("errorMsg");
  el.textContent = message;
  el.style.display = "block";
}

document
  .getElementById("registerForm")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    const name = document.getElementById("regName").value.trim();
    const phone = document.getElementById("regPhone").value.trim();
    const pin = document.getElementById("regPin").value.trim();
    const pinConfirm = document.getElementById("regPinConfirm").value.trim();

    if (!name) {
      showError("Please enter your name.");
      return;
    }
    if (!isValidPhone(phone)) {
      showError("Enter a valid phone number (e.g. 07XXXXXXXX).");
      return;
    }
    if (DB.getCustomerByPhone(phone)) {
      showError(
        "This phone number is already registered. Try logging in instead.",
      );
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      showError("PIN must be exactly 4 digits.");
      return;
    }
    if (pin !== pinConfirm) {
      showError("PINs do not match.");
      return;
    }

    const newCustomer = DB.insertCustomer({
      name,
      phone,
      pinHash: await hashPin(pin),
      balance: 5000,
      status: "ACTIVE",
      createdAt: Date.now(),
    });

    Session.setLoggedInCustomerId(newCustomer.id);
    window.location.href = "home.html";
  });
