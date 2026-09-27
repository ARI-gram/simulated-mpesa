const KEYS = {
  customers: "mpesa_customers",
  recipients: "mpesa_recipients",
  merchants: "mpesa_merchants",
  transactions: "mpesa_transactions",
  messages: "mpesa_messages",
  requests: "mpesa_requests",
};

function getTable(key) {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}
function saveTable(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}
function nextId(table) {
  return table.length === 0 ? 1 : Math.max(...table.map((r) => r.id)) + 1;
}

const DB = {
  /* =========================================================
     CUSTOMERS
  ========================================================= */
  getAllCustomers() {
    return getTable(KEYS.customers);
  },
  getCustomerById(id) {
    return this.getAllCustomers().find((c) => c.id === id) || null;
  },
  getCustomerByPhone(phone) {
    return this.getAllCustomers().find((c) => c.phone === phone) || null;
  },
  insertCustomer(customer) {
    const table = this.getAllCustomers();
    const row = { ...customer, id: nextId(table) };
    table.push(row);
    saveTable(KEYS.customers, table);
    return row;
  },
  updateCustomerBalance(id, newBalance) {
    const table = this.getAllCustomers();
    const c = table.find((x) => x.id === id);
    if (c) c.balance = newBalance;
    saveTable(KEYS.customers, table);
  },
  updateCustomerStatus(id, status) {
    const table = this.getAllCustomers();
    const c = table.find((x) => x.id === id);
    if (c) c.status = status;
    saveTable(KEYS.customers, table);
  },
  deleteCustomer(id) {
    saveTable(
      KEYS.customers,
      this.getAllCustomers().filter((c) => c.id !== id),
    );
  },

  updateCustomer(id, patch) {
    const table = this.getAllCustomers();
    const c = table.find((x) => x.id === id);
    if (c) Object.assign(c, patch);
    saveTable(KEYS.customers, table);
    return c || null;
  },

  /* =========================================================
     CUSTOMERS — helper methods for two-sided transactions
  ========================================================= */

  /**
   * Find a customer by phone, or create a stub one if missing.
   * Used when money is sent to a phone number that isn't a
   * registered customer yet (mirrors real M-PESA behavior:
   * the recipient's wallet is auto-created on first receipt).
   */
  findOrCreateCustomerByPhone(phone, name = "Unknown") {
    const existing = this.getCustomerByPhone(phone);
    if (existing) return existing;

    return this.insertCustomer({
      name,
      phone,
      pinHash: "", // no PIN — they can't log in until set
      balance: 0,
      status: "ACTIVE",
      isStub: true, // flag so we know it was auto-created
      createdAt: Date.now(),
    });
  },

  /**
   * Add to a customer's balance.
   * Returns the new balance.
   */
  creditCustomer(id, amount) {
    const c = this.getCustomerById(id);
    if (!c) throw new Error("Customer not found for credit");
    const newBalance = c.balance + amount;
    this.updateCustomerBalance(id, newBalance);
    return newBalance;
  },

  /* =========================================================
     RECIPIENTS (favourites)
  ========================================================= */
  getAllRecipients() {
    return getTable(KEYS.recipients);
  },
  getRecipientByPhone(phone) {
    return this.getAllRecipients().find((r) => r.phone === phone) || null;
  },
  insertRecipient(recipient) {
    const table = this.getAllRecipients();
    const row = { ...recipient, id: nextId(table) };
    table.push(row);
    saveTable(KEYS.recipients, table);
    return row;
  },
  // 🔹 NEW in Phase 2 — patch an existing recipient (e.g. rename)
  updateRecipient(id, patch) {
    const table = this.getAllRecipients();
    const r = table.find((x) => x.id === id);
    if (r) Object.assign(r, patch);
    saveTable(KEYS.recipients, table);
    return r || null;
  },
  deleteRecipient(id) {
    saveTable(
      KEYS.recipients,
      this.getAllRecipients().filter((r) => r.id !== id),
    );
  },

  /* =========================================================
     MERCHANTS
  ========================================================= */
  getAllMerchants() {
    return getTable(KEYS.merchants);
  },
  getMerchantByTypeAndIdentifier(type, identifier) {
    return (
      this.getAllMerchants().find(
        (m) => m.type === type && m.identifier === identifier,
      ) || null
    );
  },
  insertMerchant(merchant) {
    const table = this.getAllMerchants();
    const row = { ...merchant, id: nextId(table) };
    table.push(row);
    saveTable(KEYS.merchants, table);
    return row;
  },
  incrementMerchantTotal(id, amount) {
    const table = this.getAllMerchants();
    const m = table.find((x) => x.id === id);
    if (m) m.totalReceived = (m.totalReceived || 0) + amount;
    saveTable(KEYS.merchants, table);
  },
  deleteMerchant(id) {
    saveTable(
      KEYS.merchants,
      this.getAllMerchants().filter((m) => m.id !== id),
    );
  },

  /* =========================================================
     TRANSACTIONS
  ========================================================= */
  getAllTransactions() {
    return getTable(KEYS.transactions).sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  },
  getTransactionsBySender(customerId) {
    return this.getAllTransactions().filter(
      (t) => t.senderCustomerId === customerId,
    );
  },
  referenceIdExists(refId) {
    return getTable(KEYS.transactions).some((t) => t.referenceId === refId);
  },
  insertTransaction(transaction) {
    const table = getTable(KEYS.transactions);
    const row = { ...transaction, id: nextId(table) };
    table.push(row);
    saveTable(KEYS.transactions, table);
    return row;
  },

  // 🔹 NEW in Phase 2 — lookup by reference ID (used by messages + reverse)
  getTransactionByRef(refId) {
    return (
      getTable(KEYS.transactions).find((t) => t.referenceId === refId) || null
    );
  },

  // 🔹 NEW in Phase 2 — patch an existing transaction (used by reverse flow)
  updateTransaction(id, patch) {
    const table = getTable(KEYS.transactions);
    const t = table.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
    saveTable(KEYS.transactions, table);
    return t || null;
  },

  // 🔹 NEW in Phase 2 — the full atomic reversal operation:
  //   1. Credit the sender's balance
  //   2. Insert a REVERSAL transaction (direction: IN)
  //   3. Mark the original as reversed: true
  //   4. Insert an M-PESA SMS for the reversal
  //   Returns the new reversal transaction row.
  insertReversal(originalTx) {
    const customer = this.getCustomerById(originalTx.senderCustomerId);
    if (!customer) throw new Error("Customer not found for reversal");

    // 1. Credit balance
    const newBalance = customer.balance + originalTx.amount;
    this.updateCustomerBalance(customer.id, newBalance);

    // 2. Fresh reference ID
    let referenceId;
    do {
      referenceId = generateReferenceId();
    } while (this.referenceIdExists(referenceId));

    // 3. Insert the REVERSAL transaction
    const now = Date.now();
    const reversal = this.insertTransaction({
      senderCustomerId: customer.id,
      type: "REVERSAL",
      direction: "IN",
      amount: originalTx.amount,
      recipientName: customer.name, // for IN, "recipient" is self
      recipientIdentifier: originalTx.referenceId, // keep link to original
      referenceId,
      balanceAfter: newBalance,
      status: "SUCCESS",
      createdAt: now,
      reversesTxId: originalTx.id,
    });

    // 4. Mark original as reversed
    this.updateTransaction(originalTx.id, { reversed: true });

    // 5. M-PESA SMS
    this.insertMessage({
      transactionId: reversal.id,
      threadName: "M-PESA",
      body:
        `${reversal.referenceId} Confirmed. ${formatCurrency(reversal.amount)} ` +
        `reversed from ${originalTx.recipientName.toUpperCase()}. ` +
        `New M-PESA balance is ${formatCurrency(newBalance)}. ` +
        `Transaction cost, Ksh0.00.`,
      createdAt: now,
    });

    return reversal;
  },

  /* =========================================================
     MESSAGES
  ========================================================= */
  getMessagesByThread(threadName = "M-PESA") {
    return getTable(KEYS.messages)
      .filter((m) => m.threadName === threadName)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
  insertMessage(message) {
    const table = getTable(KEYS.messages);
    const row = { ...message, id: nextId(table) };
    table.push(row);
    saveTable(KEYS.messages, table);
    return row;
  },

  deleteMessage(id) {
    saveTable(
      KEYS.messages,
      getTable(KEYS.messages).filter((m) => m.id !== id),
    );
  },

  /* =========================================================
     DANGER ZONE
  ========================================================= */
  clearAll() {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
  },

  /* =========================================================
     PAYMENT REQUESTS (outgoing requests we made to others)
  ========================================================= */
  getAllRequests() {
    return getTable(KEYS.requests).sort((a, b) => b.createdAt - a.createdAt);
  },
  getRequestsByRequester(customerId) {
    return this.getAllRequests().filter(
      (r) => r.requesterCustomerId === customerId,
    );
  },
  getRequestByRef(refId) {
    return getTable(KEYS.requests).find((r) => r.referenceId === refId) || null;
  },
  referenceIdExistsInRequests(refId) {
    return getTable(KEYS.requests).some((r) => r.referenceId === refId);
  },
  insertRequest(request) {
    const table = getTable(KEYS.requests);
    const row = { ...request, id: nextId(table) };
    table.push(row);
    saveTable(KEYS.requests, table);
    return row;
  },
  updateRequest(id, patch) {
    const table = getTable(KEYS.requests);
    const r = table.find((x) => x.id === id);
    if (r) Object.assign(r, patch);
    saveTable(KEYS.requests, table);
    return r || null;
  },
  deleteRequest(id) {
    saveTable(
      KEYS.requests,
      this.getAllRequests().filter((r) => r.id !== id),
    );
  },
};

/**
 * Build the HTML for a recipient avatar.
 * Priority: image URL > initials on colored background.
 */
function renderAvatarHtml(rec, sizeClass = "data-row-avatar") {
  const initials = getInitials(rec.name || "?");
  const color = rec.avatarColor || "purple";
  const url = rec.avatarUrl;

  if (url) {
    return `
      <div class="${sizeClass} avatar-img">
        <img src="${escapeHtml(url)}" alt="${escapeHtml(initials)}"
             onerror="this.parentElement.classList.remove('avatar-img'); this.remove();" />
      </div>
    `;
  }

  return `<div class="${sizeClass} ${color}">${initials}</div>`;
}

/**
 * Compress an uploaded File (image) to a small square data URL.
 * Returns a Promise<string> with the data URL.
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

        // Crop to square (center crop)
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;

        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);

        // JPEG at 0.75 quality → ~3–5 KB per image
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
