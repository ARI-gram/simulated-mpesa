async function seedDefaults() {
  DB.clearAll();
  const now = Date.now();

  DB.insertCustomer({
    name: "Samson Kipruto",
    phone: "0712345678",
    pinHash: await hashPin("1234"),
    balance: 5000,
    status: "ACTIVE",
    createdAt: now,
  });
  DB.insertCustomer({
    name: "Jane Wanjiku",
    phone: "0723456789",
    pinHash: await hashPin("1234"),
    balance: 2500,
    status: "ACTIVE",
    createdAt: now,
  });

  DB.insertRecipient({
    name: "Peter Otieno",
    phone: "0734567890",
    createdAt: now,
  });

  DB.insertMerchant({
    type: "TILL",
    identifier: "123456",
    businessName: "Mama Mboga Grocery",
    totalReceived: 0,
    createdAt: now,
  });
  DB.insertMerchant({
    type: "PAYBILL",
    identifier: "247247",
    businessName: "KCB Bank",
    accountNumberRequired: true,
    totalReceived: 0,
    createdAt: now,
  });
  DB.insertMerchant({
    type: "POCHI",
    identifier: "0711111111",
    businessName: "Mama Mboga Pochi",
    totalReceived: 0,
    createdAt: now,
  });
}

async function seedIfEmpty() {
  if (DB.getAllCustomers().length === 0) await seedDefaults();
}
