// ============================================================
// SIMPLE SCREEN ROUTER
// One <div id="app"> whose innerHTML we swap based on current screen.
// `state` holds whatever the current screen needs to remember
// (e.g. the logged-in customer, a draft transaction, etc.)
// ============================================================

const state = {
  currentScreen: "splash",
  loggedInCustomerId: null,
};

function navigateTo(screen, extraState = {}) {
  state.currentScreen = screen;
  Object.assign(state, extraState);
  render();
}

function render() {
  const app = document.getElementById("app");
  switch (state.currentScreen) {
    case "splash":
      app.innerHTML = renderSplash();
      break;
    default:
      app.innerHTML = `<p>Unknown screen: ${state.currentScreen}</p>`;
  }
}

// ============================================================
// SCREEN: S1 — Splash / Mode Select
// ============================================================

function renderSplash() {
  return `
    <div class="screen splash-screen">
      <div class="splash-logo">M-PESA</div>
      <p class="splash-subtitle">Simulated M-PESA App</p>

      <button class="btn-primary" onclick="navigateTo('login')">Continue as Customer</button>
      <button class="btn-secondary" onclick="navigateTo('adminDashboard')">Admin Access</button>
    </div>
  `;
}

// ============================================================
// INIT
// ============================================================

(async () => {
  await seedIfEmpty();
  render();
})();
