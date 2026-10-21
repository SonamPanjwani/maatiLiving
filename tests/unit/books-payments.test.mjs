// Books Phase 3: open items, auto-allocation, allocation checks, payment validation, balance, statement.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  autoAllocate, checkAllocation, daysBetween, openItems, parseAllocationFields, purchasePayState,
  statementText, unallocatedPayments, validatePayment, vendorBalance, vendorStatement,
} from "../../src/lib/books/payments.js";
import { formatDate, formatPrice } from "../../src/lib/format.js";

const bill = (id, { total, billDate = null, orderDate = "2026-10-01", due = null, status = "ordered", billNumber = "B", created = "2026-10-01T10:00:00Z" }) =>
  ({ id, number: `PO-${id}`, status, total_paise: total, bill_date: billDate, order_date: orderDate, due_date: due, bill_number: billNumber, created_at: created });
const alloc = (paymentId, purchaseId, amount, status = "active") => ({ payment_id: paymentId, purchase_id: purchaseId, amount_paise: amount, payment: { status } });

test("daysBetween", () => {
  assert.equal(daysBetween("2026-10-01", "2026-10-21"), 20);
  assert.equal(daysBetween("2026-10-21", "2026-10-01"), -20);
  assert.equal(daysBetween("2026-02-28", "2026-03-01"), 1);
});

test("openItems: opening first, bills by bill date (else order date), paid and overdue; only payable bills", () => {
  const purchases = [
    bill("2", { total: 30000, billDate: "2026-10-05", due: "2026-10-20" }),
    bill("1", { total: 20000, orderDate: "2026-09-20", billNumber: null, status: "received", due: null }),
    bill("3", { total: 5000, billNumber: null, status: "ordered" }),              // not a bill yet
    bill("4", { total: 9000, status: "cancelled", billNumber: "X" }),              // cancelled
  ];
  const allocations = [alloc("p1", "2", 10000), alloc("p2", "2", 99999, "voided"), alloc("p1", null, 1000)];
  const items = openItems({ openingBalancePaise: 5000, purchases, allocations, today: "2026-10-21" });
  assert.deepEqual(items.map((i) => [i.key, i.balancePaise, i.overdueDays]), [["opening", 4000, 0], ["1", 20000, 0], ["2", 20000, 1]]);
  assert.equal(items[2].paidPaise, 10000, "voided payment ignored");
  assert.equal(openItems({ openingBalancePaise: -500, purchases: [] }).length, 0, "negative opening = advance, not an item");
  assert.equal(openItems({ purchases, allocations: [alloc("p", "2", 30000)], includeSettled: true }).find((i) => i.key === "2").balancePaise, 0);
  // Leaving one payment out (editing its allocation) puts its amounts back.
  assert.equal(openItems({ purchases, allocations, exceptPaymentId: "p1" }).find((i) => i.key === "2").balancePaise, 30000);
});

test("autoAllocate: oldest first, leftover is advance", () => {
  const items = [{ key: "opening", purchaseId: null, balancePaise: 4000 }, { key: "a", purchaseId: "a", balancePaise: 20000 }, { key: "b", purchaseId: "b", balancePaise: 20000 }];
  assert.deepEqual(autoAllocate(30000, items), {
    allocations: [{ key: "opening", purchaseId: null, amountPaise: 4000 }, { key: "a", purchaseId: "a", amountPaise: 20000 }, { key: "b", purchaseId: "b", amountPaise: 6000 }],
    advancePaise: 0,
  });
  assert.equal(autoAllocate(50000, items).advancePaise, 6000);
  assert.deepEqual(autoAllocate(100, []), { allocations: [], advancePaise: 100 });
});

test("checkAllocation blocks over-balance and over-payment", () => {
  const items = [{ key: "a", label: "PO-1", balancePaise: 20000 }, { key: "opening", label: "Opening balance", balancePaise: 500 }];
  assert.deepEqual(checkAllocation(30000, [{ key: "a", amountPaise: 20000 }], items), { allocatedPaise: 20000, advancePaise: 10000 });
  assert.match(checkAllocation(30000, [{ key: "a", amountPaise: 20001 }], items, { formatPrice }).error, /Only ₹200 is still to pay on PO-1/);
  assert.match(checkAllocation(10000, [{ key: "a", amountPaise: 15000 }], items, { formatPrice }).error, /more than the payment \(₹100\)/);
  assert.match(checkAllocation(10000, [{ key: "zzz", amountPaise: 1 }], items).error, /no longer open/);
  assert.match(checkAllocation(10000, [{ key: "a", amountPaise: 1 }, { key: "a", amountPaise: 1 }], items).error, /twice/);
});

test("parseAllocationFields reads alloc_<key> rupee fields", () => {
  assert.deepEqual(parseAllocationFields([["alloc_opening", "50"], ["alloc_abc", "120.50"], ["alloc_x", ""], ["alloc_y", "0"], ["amount", "9"]]).allocations,
    [{ key: "opening", purchase_id: null, amount_paise: 5000 }, { key: "abc", purchase_id: "abc", amount_paise: 12050 }]);
  assert.match(parseAllocationFields([["alloc_a", "1.234"]]).error, /in rupees/);
});

test("validatePayment", () => {
  const base = { vendorId: "v", amount: "2,500.50", paidOn: "2026-10-20", method: "upi", reference: " UTR123 ", notes: "", attachments: "[]" };
  const ok = validatePayment(base, { today: "2026-10-21" });
  assert.deepEqual(ok, { vendorId: "v", payment: { amount_paise: 250050, paid_on: "2026-10-20", method: "upi", reference: "UTR123", notes: null, attachments: [] } });
  assert.match(validatePayment({ ...base, vendorId: "" }).error, /vendor/);
  assert.match(validatePayment({ ...base, amount: "0" }).error, /more than ₹0/);
  assert.match(validatePayment({ ...base, amount: "abc" }).error, /in rupees/);
  assert.match(validatePayment({ ...base, paidOn: "2026-02-30" }).error, /date/);
  assert.match(validatePayment({ ...base, paidOn: "2026-10-22" }, { today: "2026-10-21" }).error, /future/);
  assert.match(validatePayment({ ...base, method: "cheque" }).error, /how it was paid/);
  assert.match(validatePayment({ ...base, attachments: JSON.stringify([{ publicId: "evil/x" }]) }).error, /proof files/);
});

test("vendorBalance subtracts active payments only; unallocated advances", () => {
  const purchases = [bill("1", { total: 20000 }), bill("2", { total: 5000, billNumber: null })];
  const payments = [{ id: "p1", status: "active", amount_paise: 15000 }, { id: "p2", status: "voided", amount_paise: 99999 }, { id: "p3", status: "active", amount_paise: 1000 }];
  assert.equal(vendorBalance(3000, purchases, payments), 3000 + 20000 - 16000);
  assert.deepEqual(unallocatedPayments(payments, [{ payment_id: "p1", amount_paise: 12000 }, { payment_id: "p3", amount_paise: 1000 }]).map((r) => [r.payment.id, r.unallocatedPaise]), [["p1", 3000]]);
});

test("purchasePayState", () => {
  assert.equal(purchasePayState(bill("1", { total: 100, billNumber: null }), 0).state, null, "not a bill yet");
  assert.deepEqual(purchasePayState(bill("1", { total: 100, due: "2026-10-01" }), 40, "2026-10-11"), { state: "part_paid", paidPaise: 40, balancePaise: 60, overdueDays: 10 });
  assert.equal(purchasePayState(bill("1", { total: 100, due: "2026-10-01" }), 100, "2026-10-11").overdueDays, 0, "paid isn't overdue");
  assert.equal(purchasePayState(bill("1", { total: 100 }), 0).state, "unpaid");
});

test("vendor statement: running balance, voided listed but not counted; WhatsApp text", () => {
  const vendor = { name: "Molela Potters", opening_balance_paise: 5000 };
  const purchases = [bill("1", { total: 20000, billDate: "2026-10-05", billNumber: "INV-7" }), bill("2", { total: 1, status: "cancelled" })];
  const payments = [
    { id: "a", number: "PAY-1001", status: "active", amount_paise: 15000, paid_on: "2026-10-06", method: "upi", reference: "UTR9", created_at: "2026-10-06T10:00:00Z" },
    { id: "b", number: "PAY-1002", status: "voided", amount_paise: 7000, paid_on: "2026-10-07", method: "cash", reference: null, created_at: "2026-10-07T10:00:00Z" },
  ];
  const s = vendorStatement({ vendor, purchases, payments });
  assert.deepEqual(s.lines.map((l) => [l.label, l.balancePaise, Boolean(l.voided)]), [["PO-1", 25000, false], ["PAY-1001", 10000, false], ["PAY-1002", 10000, true]]);
  assert.equal(s.closingPaise, 10000);
  const text = statementText(vendor, s, { formatPrice, formatDate, asOf: "2026-10-21" });
  assert.match(text, /Opening balance: ₹50/);
  assert.match(text, /5 Oct 2026 · PO-1 \(Bill INV-7\): ₹200/);
  assert.match(text, /Paid PAY-1001 \(UPI · UTR9\): −₹150/);
  assert.doesNotMatch(text, /PAY-1002/, "voided payments aren't shared");
  assert.match(text, /\*Balance due: ₹100\*/);
});
