// ============================================================
// GLOBAL SEARCH
// Searches transactions, recipients, and requests.
// Live filtering as you type, grouped results, recent searches.
// ============================================================

const customerId = Session.getLoggedInCustomerId();
const customer = customerId ? DB.getCustomerById(customerId) : null;

if (!customer) {
  window.location.href = "login.html";
}

// ---------- Config ----------
const RECENT_KEY = "mpesa_recent_searches";
const RECENT_LIMIT = 6;
const RESULTS_PER_SECTION = 5;

// ---------- State ----------
let query = "";

// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  renderInitial();
});

// ============================================================
// INPUT
// ============================================================

function onSearchInput() {
  const input = document.getElementById("searchInput");
  query = input.value.trim();

  // Show/hide clear button
  document
    .getElementById("clearBtn")
    .classList.toggle("hidden", query.length === 0);

  if (query.length === 0) {
    renderInitial();
    return;
  }

  if (query.length < 2) {
    renderTooShort();
    return;
  }

  runSearch(query);
}

function onSearchKey(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    const q = document.getElementById("searchInput").value.trim();
    if (q.length >= 2) {
      pushRecent(q);
      runSearch(q);
    }
  }
}

function clearSearch() {
  const input = document.getElementById("searchInput");
  input.value = "";
  query = "";
  document.getElementById("clearBtn").classList.add("hidden");
  renderInitial();
  input.focus();
}

// ============================================================
// RENDER: INITIAL (recents)
// ============================================================

function renderInitial() {
  const main = document.getElementById("searchMain");
  const recents = getRecents();

  if (!recents.length) {
    main.innerHTML = `
      <div class="search-empty">
        Search across your <strong>transactions</strong>,<br />
        <strong>favourites</strong>, and <strong>requests</strong>.<br />
        Start typing to see results.
      </div>
    `;
    return;
  }

  main.innerHTML = `
    <section class="result-section">
      <div class="section-title">
        Recent searches
      </div>
      <div class="chips">
        ${recents
          .map(
            (r) => `
          <button type="button" class="chip" data-q="${escapeHtml(r)}">
            ${escapeHtml(r)}
          </button>
        `,
          )
          .join("")}
        <button type="button" class="chip-clear" id="clearRecents">
          Clear
        </button>
      </div>
    </section>
  `;

  // Wire chip clicks
  main.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const input = document.getElementById("searchInput");
      input.value = chip.dataset.q;
      input.focus();
      onSearchInput();
    });
  });

  document.getElementById("clearRecents").addEventListener("click", () => {
    localStorage.removeItem(RECENT_KEY);
    renderInitial();
  });
}

// ============================================================
// RENDER: TOO SHORT
// ============================================================

function renderTooShort() {
  document.getElementById("searchMain").innerHTML = `
    <div class="search-empty">
      Keep typing…
    </div>
  `;
}

// ============================================================
// SEARCH
// ============================================================

function runSearch(q) {
  const needle = q.toLowerCase();

  const txns = searchTransactions(needle);
  const recs = searchRecipients(needle);
  const reqs = searchRequests(needle);

  const main = document.getElementById("searchMain");

  const totalResults = txns.length + recs.length + reqs.length;

  if (totalResults === 0) {
    main.innerHTML = `
      <div class="search-empty">
        No results for "<strong>${escapeHtml(q)}</strong>"
      </div>
    `;
    return;
  }

  let html = "";

  if (txns.length) {
    html += renderSection(
      "Transactions",
      txns.length,
      txns.slice(0, RESULTS_PER_SECTION).map(renderTxRow).join(""),
    );
  }

  if (recs.length) {
    html += renderSection(
      "Favourites",
      recs.length,
      recs.slice(0, RESULTS_PER_SECTION).map(renderRecRow).join(""),
    );
  }

  if (reqs.length) {
    html += renderSection(
      "Requests",
      reqs.length,
      reqs.slice(0, RESULTS_PER_SECTION).map(renderReqRow).join(""),
    );
  }

  main.innerHTML = html;

  // Persist query as recent (on successful search)
  pushRecent(q);

  // Wire row clicks
  main.querySelectorAll(".result-row").forEach((row) => {
    row.addEventListener("click", () => {
      const kind = row.dataset.kind;
      const id = row.dataset.id;

      if (kind === "tx") {
        sessionStorage.setItem(
          "mpesa_view_tx",
          JSON.stringify({ id: Number(id) }),
        );
        window.location.href = `transaction.html?id=${id}`;
      } else if (kind === "recipient") {
        sessionStorage.setItem("mpesa_prefill_phone", row.dataset.phone);
        window.location.href = "send-money.html";
      } else if (kind === "request") {
        // Open request-money.html with the request ID so it can open the sheet
        sessionStorage.setItem(
          "mpesa_open_request",
          JSON.stringify({ id: Number(id) }),
        );
        window.location.href = "request-money.html";
      }
    });
  });
}

// ============================================================
// SEARCH IMPLEMENTATIONS
// ============================================================

function searchTransactions(needle) {
  const all = DB.getTransactionsBySender(customer.id);

  return all.filter((t) => {
    const haystack = [
      t.referenceId,
      t.recipientName,
      t.recipientIdentifier,
      String(t.amount),
      t.type,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

function searchRecipients(needle) {
  const all = DB.getAllRecipients();
  return all.filter((r) => {
    const haystack = [r.name, r.phone].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(needle);
  });
}

function searchRequests(needle) {
  const all = DB.getRequestsByRequester(customer.id);
  return all.filter((r) => {
    const haystack = [r.referenceId, r.targetPhone, r.reason, String(r.amount)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

// ============================================================
// SECTION RENDERERS
// ============================================================

function renderSection(title, count, rowsHtml) {
  return `
    <section class="result-section">
      <div class="section-title">
        ${title}
        <span class="count">${count}</span>
      </div>
      ${rowsHtml}
    </section>
  `;
}

function renderTxRow(t) {
  const isIn = t.direction === "IN";
  const isRev = t.type === "REVERSAL";

  const avatarClass = isRev ? "tx-rev" : isIn ? "tx-in" : "tx-out";
  const avatarChar = isRev ? "↺" : isIn ? "↓" : "↑";
  const amountClass = isRev ? "rev" : isIn ? "in" : "out";
  const sign = isIn ? "+" : "-";
  const time = formatShortTime(t.createdAt);

  return `
    <div class="result-row" data-kind="tx" data-id="${t.id}">
      <div class="result-avatar ${avatarClass}">${avatarChar}</div>
      <div class="result-mid">
        <div class="result-title">${highlight(t.recipientName || "—", query)}</div>
        <div class="result-sub">${highlight(t.referenceId || "", query)}</div>
      </div>
      <div class="result-right">
        <div class="result-amount ${amountClass}">${sign}${formatCurrency(t.amount)}</div>
        <div class="result-time">${time}</div>
      </div>
    </div>
  `;
}

function renderRecRow(r) {
  const initials = getInitials(r.name);
  return `
    <div class="result-row" data-kind="recipient" data-id="${r.id}" data-phone="${escapeHtml(r.phone)}">
      ${renderAvatar(
        {
          name: r.name,
          avatarUrl: r.avatarUrl,
          avatarColor: r.avatarColor,
        },
        { className: "result-avatar", fallbackClass: "recipient" },
      )}
      <div class="result-mid">
        <div class="result-title">${highlight(r.name, query)}</div>
        <div class="result-sub">${highlight(r.phone, query)}</div>
      </div>
    </div>
  `;
}

function renderReqRow(r) {
  const initials = getInitials(r.requesterName);
  const time = formatShortTime(r.createdAt);
  const subParts = [r.referenceId, r.targetPhone, r.reason].filter(Boolean);
  return `
    <div class="result-row" data-kind="request" data-id="${r.id}">
      <div class="result-avatar request">${initials}</div>
      <div class="result-mid">
        <div class="result-title">${highlight(r.targetPhone, query)}</div>
        <div class="result-sub">${highlight(subParts.join(" · "), query)}</div>
      </div>
      <div class="result-right">
        <div class="result-amount in">${formatCurrency(r.amount)}</div>
        <div class="result-time">${time}</div>
      </div>
    </div>
  `;
}

// ============================================================
// HIGHLIGHT MATCHES
// ============================================================

function highlight(text, q) {
  const safe = escapeHtml(text || "");
  if (!q) return safe;

  // Escape regex special chars in q
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    const re = new RegExp(`(${escaped})`, "ig");
    return safe.replace(re, "<mark>$1</mark>");
  } catch (_) {
    return safe;
  }
}

// ============================================================
// RECENT SEARCHES
// ============================================================

function getRecents() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function pushRecent(q) {
  const trimmed = q.trim();
  if (trimmed.length < 2) return;

  let list = getRecents();
  list = list.filter((x) => x.toLowerCase() !== trimmed.toLowerCase());
  list.unshift(trimmed);
  list = list.slice(0, RECENT_LIMIT);

  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

// ============================================================
// NAVIGATION
// ============================================================

function goBack() {
  if (document.referrer && history.length > 1) history.back();
  else window.location.href = "home.html";
}
