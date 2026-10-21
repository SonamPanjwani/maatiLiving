// Books Phase 2: purchase form validation, landed/weighted cost, vendor balance, PO share text, dates.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanAttachments, isPayable, landedUnitCost, purchaseOrderText, purchaseTotals, validatePurchase, vendorBalance, weightedAverageCost } from "../../src/lib/books/purchases.js";
import { formatDate, formatPrice } from "../../src/lib/format.js";

test("landed unit cost spreads shipping minus discount by line value", () => {
  // ₹1,000 + ₹1,002 of goods, ₹50 shipping, ₹20 discount → every rupee carries 30/2002 extra.
  const opts = { subtotalPaise: 200200, shippingPaise: 5000, discountPaise: 2000 };
  assert.equal(landedUnitCost(10000, opts), 10150);
  assert.equal(landedUnitCost(25050, opts), 25425);
  assert.equal(landedUnitCost(10000, { subtotalPaise: 100000 }), 10000, "no extras → unit cost");
  assert.equal(landedUnitCost(10000, { subtotalPaise: 100000, discountPaise: 100000 }), 0, "fully discounted");
  assert.equal(landedUnitCost(0, { subtotalPaise: 0, shippingPaise: 1000, totalQty: 4 }), 250, "free goods: shipping per piece");
  // Spread across a whole purchase adds back to (about) the extras: 10 × 101.50 + 4 × 254.25 = 2032 ≈ 2002 + 30.
  assert.equal(10 * 10150 + 4 * 25425, 203200);
});

test("weighted average cost; unknown cost takes the incoming cost", () => {
  assert.equal(weightedAverageCost(10, null, 5, 12000), 12000);
  assert.equal(weightedAverageCost(0, 9000, 5, 12000), 12000, "no stock left → new cost");
  assert.equal(weightedAverageCost(10, 10000, 10, 12000), 11000);
  assert.equal(weightedAverageCost(3, 333, 1, 334), 333, "333.25 rounds to 333");
  assert.equal(weightedAverageCost(1, 100, 1, 101), 101, "100.5 rounds half up");
});

test("purchase totals", () => {
  assert.deepEqual(purchaseTotals([{ qty: 2, unitCostPaise: 15050 }, { qty: 1, unitCostPaise: 100 }, { qty: NaN, unitCostPaise: 5 }], { discountPaise: 100, shippingPaise: 5000, taxPaise: 1 }),
    { subtotalPaise: 30200, totalPaise: 35101 });
});

const base = {
  vendorId: "v1", orderDate: "2026-10-20", expectedDate: "", billNumber: " INV-1 ", billDate: "", dueDate: "",
  discount: "", shipping: "50", tax: "", notes: "", attachments: "[]", intent: "ordered",
  items: JSON.stringify([{ productId: "p1", name: "Diya", qty: 10, unitCost: "120.50" }]),
};

test("validatePurchase: clean input → paise, snake_case header", () => {
  const r = validatePurchase(base);
  assert.equal(r.error, undefined);
  assert.equal(r.vendorId, "v1");
  assert.deepEqual(r.items, [{ product_id: "p1", qty: 10, unit_cost_paise: 12050 }]);
  assert.equal(r.header.order_date, "2026-10-20");
  assert.equal(r.header.expected_date, null);
  assert.equal(r.header.bill_number, "INV-1");
  assert.equal(r.header.shipping_paise, 5000);
  assert.equal(r.header.discount_paise, 0);
  assert.equal(r.header.mark_ordered, true);
});

test("validatePurchase: helpful errors", () => {
  const items = (list) => ({ ...base, items: JSON.stringify(list) });
  assert.match(validatePurchase({ ...base, vendorId: "" }).error, /Choose a vendor/);
  assert.match(validatePurchase(items([])).error, /at least one item/);
  assert.match(validatePurchase(items([{ productId: "p1", name: "Diya", qty: 1.5, unitCost: "1" }])).error, /Quantity for Diya/);
  assert.match(validatePurchase(items([{ productId: "p1", name: "Diya", qty: 1, unitCost: "" }])).error, /cost per piece for Diya/);
  assert.match(validatePurchase(items([{ productId: "p1", name: "Diya", qty: 1, unitCost: "1.234" }])).error, /cost per piece/);
  assert.match(validatePurchase(items([{ productId: "p1", name: "Diya", qty: 1, unitCost: "0" }])).error, /Diya must be more than ₹0/);
  assert.match(validatePurchase(items([{ productId: "p1", name: "Diya", qty: 1, unitCost: "0.00" }])).error, /more than ₹0/);
  assert.match(validatePurchase(items([{ productId: "p1", name: "Diya", qty: 1, unitCost: "1" }, { productId: "p1", name: "Diya", qty: 1, unitCost: "1" }])).error, /twice/);
  assert.match(validatePurchase({ ...base, discount: "5000" }).error, /discount can't be more/);
  assert.match(validatePurchase({ ...base, shipping: "abc" }).error, /Shipping must be an amount/);
  assert.match(validatePurchase({ ...base, orderDate: "2026-02-30" }).error, /valid dates/);
  assert.match(validatePurchase({ ...base, expectedDate: "2026-10-01" }).error, /expected date is before/);
  assert.match(validatePurchase({ ...base, billDate: "2026-10-10", dueDate: "2026-10-01" }).error, /due date is before/);
  assert.match(validatePurchase({ ...base, attachments: '[{"publicId":"other/x"}]' }).error, /bill files/);
  assert.match(validatePurchase({ ...base, items: "{oops" }).error, /couldn't be read/);
});

test("validatePurchase: locked (already received) validates bill fields only", () => {
  const r = validatePurchase({ ...base, items: "garbage", discount: "garbage" }, { locked: true });
  assert.equal(r.error, undefined);
  assert.equal(r.items, null);
  assert.equal("discount_paise" in r.header, false);
  assert.equal("mark_ordered" in r.header, false);
});

test("cleanAttachments keeps only bill-folder files and known fields", () => {
  assert.deepEqual(cleanAttachments('[{"publicId":"maati-living/bills/abc_1","format":"PDF","version":1792496417,"pages":3,"name":"bill.pdf","extra":"x"}]'),
    [{ publicId: "maati-living/bills/abc_1", format: "pdf", version: "1792496417", pages: 3, name: "bill.pdf" }]);
  assert.equal(cleanAttachments('[{"publicId":"maati-living/bills/../x"}]'), null);
  assert.equal(cleanAttachments("not json"), null);
  assert.deepEqual(cleanAttachments(""), []);
});

test("vendor balance counts received or billed purchases, never cancelled or bare orders", () => {
  const purchases = [
    { status: "received", bill_number: null, total_paise: 10000 },
    { status: "partially_received", bill_number: null, total_paise: 5000 },
    { status: "ordered", bill_number: "INV-1", total_paise: 2000 },
    { status: "ordered", bill_number: null, total_paise: 99999 },
    { status: "draft", bill_number: null, total_paise: 99999 },
    { status: "cancelled", bill_number: "INV-2", total_paise: 99999 },
  ];
  assert.equal(vendorBalance(250000, purchases), 250000 + 17000);
  assert.equal(vendorBalance(-1000, []), -1000);
  assert.equal(isPayable({ status: "cancelled", bill_number: "X" }), false);
});

test("PO WhatsApp text: quantities only unless prices are asked for; never internal notes", () => {
  const purchase = {
    number: "PO-1001", order_date: "2026-10-20", expected_date: "2026-10-25", notes: "they overcharged last time",
    discount_paise: 0, shipping_paise: 5000, tax_paise: 0, total_paise: 125500,
    items: [{ product: { name: "Diya set" }, qty_ordered: 10, qty_received: 0, unit_cost_paise: 12050, line_total_paise: 120500 }],
  };
  const plain = purchaseOrderText(purchase, { formatPrice, formatDate });
  assert.match(plain, /\*Purchase order PO-1001\*/);
  assert.match(plain, /Date: 20 Oct 2026/);
  assert.match(plain, /Needed by: 25 Oct 2026/);
  assert.match(plain, /1\. Diya set — 10 pcs\n/);
  assert.doesNotMatch(plain, /₹/);
  assert.doesNotMatch(plain, /overcharged/);
  const priced = purchaseOrderText(purchase, { withPrices: true, formatPrice, formatDate });
  assert.match(priced, /10 pcs × ₹120\.50 = ₹1,205/);
  assert.match(priced, /Shipping: ₹50/);
  assert.match(priced, /\*Total: ₹1,255\*/);
});

test("formatDate: '20 Oct 2026', never 'Sept'", () => {
  assert.equal(formatDate("2026-10-20"), "20 Oct 2026");
  assert.equal(formatDate("2026-09-05"), "5 Sep 2026");
  assert.equal(formatDate("2026-09-05T18:30:00Z"), "5 Sep 2026");
  assert.equal(formatDate(null), "");
  assert.equal(formatDate("nope"), "");
});
