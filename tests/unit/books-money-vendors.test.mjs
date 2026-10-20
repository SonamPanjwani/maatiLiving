import { test } from "node:test";
import assert from "node:assert/strict";
import { paiseToRupeeInput, rupeesToPaise } from "../../src/lib/books/money.js";

test("rupeesToPaise: exact integer paise, no float drift", () => {
  assert.equal(rupeesToPaise("450"), 45000);
  assert.equal(rupeesToPaise("0.1"), 10);
  assert.equal(rupeesToPaise("0.29"), 29);          // 0.29 * 100 = 28.999… in floats
  assert.equal(rupeesToPaise("1,23,456.5"), 12345650);
  assert.equal(rupeesToPaise("₹ 99"), 9900);
  assert.equal(rupeesToPaise(""), null);
  assert.ok(Number.isNaN(rupeesToPaise("12.345")));
  assert.ok(Number.isNaN(rupeesToPaise("abc")));
  assert.ok(Number.isNaN(rupeesToPaise("-10")), "negative refused by default");
  assert.equal(rupeesToPaise("-10", { allowNegative: true }), -1000);
});

test("paiseToRupeeInput round-trips", () => {
  for (const paise of [0, 5, 10, 45000, 12345650, -1000]) {
    assert.equal(rupeesToPaise(paiseToRupeeInput(paise), { allowNegative: true }), paise);
  }
  assert.equal(paiseToRupeeInput(null), "");
});

import { validateVendor } from "../../src/lib/books/vendors.js";

test("validateVendor: normalises and validates like the database", () => {
  const { row, error } = validateVendor({ name: "  Molela  Potters ", phone: "+91 98765 43210", gstin: "22aaaaa0000a1z5", bankIfsc: "hdfc0001234", openingBalance: "2,500.50", paymentTermsDays: "15" });
  assert.equal(error, undefined);
  assert.equal(row.name, "Molela Potters");
  assert.equal(row.phone, "9876543210");
  assert.equal(row.whatsapp, "9876543210", "WhatsApp defaults to phone");
  assert.equal(row.gstin, "22AAAAA0000A1Z5");
  assert.equal(row.bank_ifsc, "HDFC0001234");
  assert.equal(row.opening_balance_paise, 250050);
  assert.equal(row.payment_terms_days, 15);
  assert.match(validateVendor({ name: "" }).error, /name/);
  assert.match(validateVendor({ name: "X Y", phone: "12345" }).error, /10-digit/);
  assert.match(validateVendor({ name: "X Y", gstin: "22AAAAA" }).error, /GSTIN/);
  assert.match(validateVendor({ name: "X Y", rating: "6" }).error, /Rating/);
  assert.match(validateVendor({ name: "X Y", openingBalance: "12.345" }).error, /Opening balance/);
  assert.equal(validateVendor({ name: "X Y", openingBalance: "-500" }).row.opening_balance_paise, -50000, "advance allowed");
});
