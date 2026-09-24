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

          <button type="button" class="action-item" onclick="sendMoney()">
            <span class="action-icon">
              <svg viewBox="0 0 24 24">
                <path class="g" d="M3 11L21 3l-8 18-2.5-7.5z" />
                <path class="r" d="M10.5 13.5L21 3" />
              </svg>
            </span>
            <span>Send<br />Money</span>
          </button>

          <button type="button" class="action-item" onclick="lipaMpesa()">
            <span class="action-icon">
              <svg viewBox="0 0 24 24">
                <path class="g" d="M4 9h16l-1.5 9a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7z" />
                <path class="r" d="M8 9l3-5M16 9l-3-5" />
                <path class="g" d="M10 13v3M14 13v3" />
              </svg>
            </span>
            <span>Lipa na<br />M-PESA</span>
          </button>

          <button type="button" class="action-item" onclick="withdrawMoney()">
            <span class="action-icon">
              <svg viewBox="0 0 24 24">
                <rect class="g" x="2" y="5" width="14" height="12" rx="2" />
                <circle class="g" cx="9" cy="11" r="2.5" />
                <path class="r" d="M20 11v8M17.5 16.5L20 19l2.5-2.5" />
              </svg>
            </span>
            <span>Withdraw<br />Money</span>
          </button>

          <button type="button" class="action-item" onclick="pochiWallet()">
            <span class="action-icon">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="11" fill="#22c55e" stroke="none" />
                <path class="r" d="M6 13.5L17.5 6.5l-3 11-2.5-4.5z" stroke-width="1.8" />
              </svg>
            </span>
            <span>Pochi<br />Wallet</span>
          </button>

          <button type="button" class="action-item" onclick="buyBundles()">
            <span class="action-icon">
              <svg viewBox="0 0 24 24">
                <path class="g" d="M8 20V5M4.5 8.5L8 5l3.5 3.5" />
                <path class="r" d="M16 4v15M12.5 15.5L16 19l3.5-3.5" />
              </svg>
            </span>
            <span>Buy<br />Bundles</span>
          </button>

          <button type="button" class="action-item" onclick="airtimeTopUp()">
            <span class="action-icon">
              <svg viewBox="0 0 24 24">
                <path class="g" d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
              </svg>
            </span>
            <span>Airtime<br />Top Up</span>
          </button>

          <button type="button" class="action-item" onclick="tunukiwaBundles()">
            <span class="action-icon">
              <svg viewBox="0 0 24 24">
                <path class="g" d="M4 11h16v9H4zM3 7h18v4H3z" />
                <path class="r" d="M12 7v13" />
                <path class="r" d="M12 7c-2-4-6-3-4.5-1S12 7 12 7zM12 7c2-4 6-3 4.5-1S12 7 12 7z" />
              </svg>
            </span>
            <span>Tunukiwa<br />Bundles</span>
          </button>

          <button type="button" class="action-item" onclick="homeInternet()">
            <span class="action-icon">
              <svg viewBox="0 0 24 24">
                <path class="g" d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
                <path class="r" d="M8.5 13.5a5 5 0 0 1 7 0M10.5 16a2 2 0 0 1 3 0M12 18.5v.01" />
              </svg>
            </span>
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

          <div class="frequency-tabs" id="frequencyTabs">
            <button type="button" class="frequency-tab" data-tab="apps">Apps</button>
            <button type="button" class="frequency-tab active" data-tab="send">Send</button>
            <button type="button" class="frequency-tab" data-tab="pay">Pay</button>
            <button type="button" class="frequency-tab" data-tab="bundles">Bundles</button>
          </div>

          <div id="frequentsList"></div>

        </div>

      </section>


      <!-- =====================================
           DISCOVER
      ====================================== -->

      <section class="discover-section">

        <h2>
          Explore &amp; Discover Deals 🔥
        </h2>

        <div class="promo-scroll" id="promoScroll">

          <article class="promo-card promo-orange">
            <h3>Watch Ads, Answer Simple Questions &amp; Unlock Rewards</h3>
          </article>

          <article class="promo-card promo-green">
            <h3>Send Money Free to Friends This Weekend</h3>
          </article>

          <article class="promo-card promo-blue">
            <h3>Buy Data Bundles &amp; Get Bonus Minutes</h3>
          </article>

        </div>

        <div class="promo-dots" id="promoDots">
          <span class="promo-dot active"></span>
          <span class="promo-dot"></span>
          <span class="promo-dot"></span>
        </div>

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

  // Start the Frequents section (Send tab is the default)
  initFrequentTabs();
  renderFrequents("send");
  initPromoDots();
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
   FREQUENTS
========================================= */

// Returns this customer's successful outgoing transactions.
function getOutgoingTransactions() {
  return DB.getTransactionsBySender(customer.id).filter(
    (t) =>
      t.direction === "OUT" &&
      (t.status || "SUCCESS").toUpperCase() === "SUCCESS",
  );
}

// Group by phone number, most used first.
function getFrequentRecipients(kind) {
  const wantedType = kind === "pay" ? "pochi" : "mobile";
  const groups = {};

  getOutgoingTransactions()
    .filter((t) => (t.type || "").toLowerCase() === wantedType)
    .forEach((t) => {
      const key = t.recipientIdentifier;
      if (!key) return;

      if (!groups[key]) {
        groups[key] = {
          phone: key,
          name: t.recipientName,
          avatarUrl: t.avatarUrl || "",
          avatarColor: t.avatarColor || "",
          count: 0,
          last: 0,
        };
      }

      groups[key].count++;
      groups[key].last = Math.max(groups[key].last, t.createdAt || 0);
    });

  return Object.values(groups)
    .sort((a, b) => b.count - a.count || b.last - a.last)
    .slice(0, 8);
}

function renderFrequents(tab) {
  const box = document.getElementById("frequentsList");

  if (tab === "send" || tab === "pay") {
    const people = getFrequentRecipients(tab);

    if (people.length) {
      const label = tab === "pay" ? "Pochi" : "Send Money";

      box.innerHTML = `
        <div class="frequents-list">
          ${people
            .map((p) => {
              const saved = DB.getRecipientByPhone(p.phone);
              const avatar = renderAvatar(
                {
                  name: p.name,
                  avatarUrl: p.avatarUrl || saved?.avatarUrl || "",
                  avatarColor: p.avatarColor || saved?.avatarColor || "",
                },
                {
                  className: "freq-avatar",
                  fallbackClass: tab === "pay" ? "blue" : "purple",
                },
              );

              return `
                <button
                  type="button"
                  class="freq-item"
                  data-phone="${escapeHtml(p.phone)}"
                  data-name="${escapeHtml(p.name || "")}"
                  data-type="${tab === "pay" ? "pochi" : "mobile"}"
                >
                  ${avatar}
                  <span class="freq-name">${escapeHtml(p.name || p.phone)}</span>
                  <span class="freq-label">${label}</span>
                </button>
              `;
            })
            .join("")}
        </div>
      `;
      return;
    }

    box.innerHTML = `
      <div class="empty-frequents">
        <div class="empty-icon">▦</div>
        <p>No frequent ${tab === "pay" ? "Pochi" : "Send Money"} contacts yet.
        They'll appear here after you send money.</p>
      </div>
    `;
    return;
  }

  // Apps + Bundles
  box.innerHTML = `
    <div class="empty-frequents">
      <div class="empty-icon">▦</div>
      <div>
        <p>It looks like you're starting here. See what's available.</p>
        <button type="button" onclick="exploreApps()">Explore Apps <span>›</span></button>
      </div>
    </div>
  `;
}

function initFrequentTabs() {
  document.getElementById("frequencyTabs").addEventListener("click", (e) => {
    const tabBtn = e.target.closest(".frequency-tab");
    if (!tabBtn) return;

    document
      .querySelectorAll(".frequency-tab")
      .forEach((b) => b.classList.remove("active"));
    tabBtn.classList.add("active");

    renderFrequents(tabBtn.dataset.tab);
  });

  document.getElementById("frequentsList").addEventListener("click", (e) => {
    const item = e.target.closest(".freq-item");
    if (!item) return;

    // Hand the pick to the send-money page
    sessionStorage.setItem(
      "mpesa_frequent_pick",
      JSON.stringify({
        phone: item.dataset.phone,
        name: item.dataset.name,
        type: item.dataset.type,
      }),
    );

    window.location.href = "send-money.html";
  });
}

/* =========================================
   PROMO BANNER
========================================= */

function initPromoDots() {
  const scroller = document.getElementById("promoScroll");
  const dots = document.querySelectorAll("#promoDots .promo-dot");
  if (!scroller || !dots.length) return;

  scroller.addEventListener("scroll", () => {
    const index = Math.round(scroller.scrollLeft / scroller.clientWidth);
    dots.forEach((d, i) => d.classList.toggle("active", i === index));
  });
}

/* =========================================
   LOGOUT
========================================= */

function handleLogout() {
  Session.clearSession();

  window.location.href = "index.html";
}
