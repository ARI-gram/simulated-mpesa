const customerId = Session.getLoggedInCustomerId();
const customer = customerId ? DB.getCustomerById(customerId) : null;

if (!customer) {
  window.location.href = "index.html";
} else {
  const hour = new Date().getHours();

  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const firstName = customer.name.split(" ")[0];

  document.getElementById("homeContent").innerHTML = `
    
    <!-- =========================================
         HEADER
    ========================================== -->

    <header class="home-header">

      <div class="customer-profile">

        <div class="profile-avatar">
          ${getInitials(customer.name)}
        </div>

        <div class="greeting-area">
          <p class="greeting">${greeting},</p>
          <h1>${firstName} 👋</h1>
        </div>

      </div>


      <div class="header-actions">

        <button
          type="button"
          class="header-icon"
          onclick="showNotification()"
          aria-label="Notifications"
        >
          <span class="notification-icon">♧</span>
          <span class="notification-dot"></span>
        </button>

        <button
          type="button"
          class="header-icon"
          onclick="showSearch()"
          aria-label="Search"
        >
          <span class="search-icon"></span>
        </button>

      </div>

    </header>


    <!-- =========================================
         MAIN CONTENT
    ========================================== -->

    <main class="home-main">


      <!-- =====================================
           BALANCE CAROUSEL
      ====================================== -->

      <section class="balance-section">

        <div class="balance-scroll">

          <!-- M-PESA BALANCE -->

          <article class="balance-card mpesa-card">

            <div class="card-pattern"></div>

            <div class="balance-card-content">

              <div class="balance-card-header">

                <span class="balance-label">
                  M-PESA Balance
                </span>

                <button
                  type="button"
                  class="visibility-button"
                  onclick="toggleBalance()"
                  aria-label="Hide balance"
                >
                  <span id="balanceEye">◉</span>
                </button>

              </div>


              <div
                class="balance-amount"
                id="balanceAmount"
              >
                ${formatCurrency(customer.balance)}
              </div>


              <button
                type="button"
                class="statement-button"
                onclick="viewStatements()"
              >
                View Statements
              </button>

            </div>

          </article>


          <!-- AIRTIME BALANCE -->

          <article class="balance-card airtime-card">

            <div class="balance-card-content">

              <span class="balance-label">
                My Balance
              </span>

              <p class="airtime-title">
                Airtime
              </p>

              <div class="airtime-amount">
                Ksh. 0
              </div>

              <button
                type="button"
                class="statement-button"
                onclick="airtimeTopUp()"
              >
                Top Up
              </button>

            </div>

          </article>

        </div>


        <div class="carousel-indicator">

          <span class="indicator active"></span>

          <span class="indicator"></span>

        </div>

      </section>


      <!-- =====================================
           QUICK ACTIONS
      ====================================== -->

      <section class="home-card quick-actions-card">

        <div class="section-header">

          <h2>Quick Actions</h2>

          <button
            type="button"
            onclick="viewAllActions()"
            class="view-all"
          >
            View all <span>›</span>
          </button>

        </div>


        <div class="actions-grid">


          <button
            type="button"
            class="action-item"
            onclick="sendMoney()"
          >
            <span class="action-icon send-icon">➤</span>
            <span>Send<br />Money</span>
          </button>


          <button
            type="button"
            class="action-item"
            onclick="lipaMpesa()"
          >
            <span class="action-icon lipa-icon">▣</span>
            <span>Lipa na<br />M-PESA</span>
          </button>


          <button
            type="button"
            class="action-item"
            onclick="withdrawMoney()"
          >
            <span class="action-icon withdraw-icon">⇩</span>
            <span>Withdraw<br />Money</span>
          </button>


          <button
            type="button"
            class="action-item"
            onclick="pochiWallet()"
          >
            <span class="action-icon pochi-icon">➤</span>
            <span>Pochi<br />Wallet</span>
          </button>


          <button
            type="button"
            class="action-item"
            onclick="buyBundles()"
          >
            <span class="action-icon bundle-icon">⌁</span>
            <span>Buy<br />Bundles</span>
          </button>


          <button
            type="button"
            class="action-item"
            onclick="airtimeTopUp()"
          >
            <span class="action-icon airtime-icon">☎</span>
            <span>Airtime<br />Top Up</span>
          </button>


          <button
            type="button"
            class="action-item"
            onclick="tunukiwaBundles()"
          >
            <span class="action-icon tunukiwa-icon">▣</span>
            <span>Tunukiwa<br />Bundles</span>
          </button>


          <button
            type="button"
            class="action-item"
            onclick="homeInternet()"
          >
            <span class="action-icon internet-icon">⌁</span>
            <span>Home<br />Internet</span>
          </button>

        </div>

      </section>


      <!-- =====================================
           FREQUENTS
      ====================================== -->

      <section class="home-card frequents-card">

        <div class="section-header">

          <h2>Frequents</h2>

          <button
            type="button"
            class="collapse-button"
            onclick="toggleFrequents()"
          >
            ⌃
          </button>

        </div>


        <div id="frequentsContent">

          <div class="frequency-tabs">

            <button class="frequency-tab active">
              Apps
            </button>

            <button class="frequency-tab">
              Send
            </button>

            <button class="frequency-tab">
              Pay
            </button>

            <button class="frequency-tab">
              Bundles
            </button>

          </div>


          <div class="empty-frequents">

            <div class="empty-icon">
              ▦
            </div>

            <div>

              <p>
                It looks like you're starting
                here. See what's available.
              </p>

              <button
                type="button"
                onclick="exploreApps()"
              >
                Explore Apps <span>›</span>
              </button>

            </div>

          </div>

        </div>

      </section>


      <!-- =====================================
           DISCOVER
      ====================================== -->

      <section class="discover-section">

        <h2>
          Explore &amp; Discover Deals 🔥
        </h2>

      </section>


    </main>


    <!-- =========================================
         SCAN TO PAY
    ========================================== -->

    <button
      type="button"
      class="scan-button"
      onclick="scanToPay()"
    >

      <span class="scan-symbol">
        ▦
      </span>

      <span>
        Scan to pay
      </span>

    </button>


    <!-- =========================================
         LOGOUT
    ========================================== -->

    <button
      type="button"
      class="logout-button"
      onclick="handleLogout()"
    >
      Log out
    </button>

  `;
}

/* =========================================
   HELPERS
========================================= */

function getInitials(name) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

/* =========================================
   BALANCE
========================================= */

let balanceVisible = true;

function toggleBalance() {
  const balanceElement = document.getElementById("balanceAmount");
  const eye = document.getElementById("balanceEye");

  if (balanceVisible) {
    balanceElement.textContent = "Ksh ••••••";
    eye.textContent = "◌";
    balanceVisible = false;
  } else {
    // Re-fetch the customer so we always show the current balance,
    // even if it changed after this page first rendered.
    const fresh =
      DB.getCustomerById(Session.getLoggedInCustomerId()) || customer;

    balanceElement.textContent = formatCurrency(fresh.balance);
    eye.textContent = "◉";
    balanceVisible = true;
  }
}

/* =========================================
   NAVIGATION PLACEHOLDERS
========================================= */

function sendMoney() {
  window.location.href = "send-money.html";
}

function lipaMpesa() {
  alert("Lipa na M-PESA coming next.");
}

function withdrawMoney() {
  alert("Withdraw Money coming next.");
}

function pochiWallet() {
  alert("Pochi Wallet coming next.");
}

function buyBundles() {
  alert("Buy Bundles coming next.");
}

function airtimeTopUp() {
  alert("Airtime Top Up coming next.");
}

function tunukiwaBundles() {
  alert("Tunukiwa Bundles coming next.");
}

function homeInternet() {
  alert("Home Internet coming next.");
}

function viewStatements() {
  alert("Statements coming next.");
}

function viewAllActions() {
  alert("All actions coming next.");
}

function scanToPay() {
  alert("Scan to Pay coming next.");
}

function exploreApps() {
  alert("Apps coming next.");
}

function showNotification() {
  window.location.href = "messages.html";
}

function viewStatements() {
  window.location.href = "statements.html";
}

function showSearch() {
  window.location.href = "search.html";
}

function toggleFrequents() {
  const content = document.getElementById("frequentsContent");

  content.classList.toggle("hidden");
}

/* =========================================
   LOGOUT
========================================= */

function handleLogout() {
  Session.clearSession();

  window.location.href = "index.html";
}
