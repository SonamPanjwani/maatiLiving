// Books Phase 4: expense validation, month ranges, recurring dates, category totals.
import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonths, categoryTotals, dueState, monthRange, nextDueDate, validateExpense } from "../../src/lib/books/expenses.js";

test("addMonths clamps to the month's last day like Postgres", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2028-01-31", 1), "2028-02-29");
  assert.equal(addMonths("2026-12-15", 1), "2027-01-15");
  assert.equal(addMonths("2026-03-31", -1), "2026-02-28");
  assert.equal(addMonths("2024-02-29", 12), "2025-02-28");
});

test("nextDueDate counts from the start, so month ends don't drift", () => {
  assert.equal(nextDueDate("2026-01-31", "2026-01-31", "monthly"), "2026-02-28");
  assert.equal(nextDueDate("2026-01-31", "2026-02-28", "monthly"), "2026-03-31");
  assert.equal(nextDueDate("2026-10-05", "2027-01-20", "monthly"), "2027-02-05");
  assert.equal(nextDueDate("2024-02-29", "2025-02-28", "yearly"), "2026-02-28");
});

test("monthRange", () => {
  assert.deepEqual(monthRange("2026-02"), { month: "2026-02", from: "2026-02-01", to: "2026-02-28", label: "Feb 2026", prev: "2026-01", next: "2026-03" });
  assert.equal(monthRange("2026-12").next, "2027-01");
  assert.equal(monthRange("2026-01").prev, "2025-12");
  assert.equal(monthRange("2026-13"), null);
  assert.equal(monthRange("x"), null);
});

test("dueState", () => {
  assert.equal(dueState("2026-10-20", "2026-10-21"), "overdue");
  assert.equal(dueState("2026-10-21", "2026-10-21"), "due");
  assert.equal(dueState("2026-10-28", "2026-10-21"), "due");
  assert.equal(dueState("2026-10-29", "2026-10-21"), "upcoming");
  assert.equal(dueState(null, "2026-10-21"), null);
});

test("categoryTotals: active only, biggest first", () => {
  const rows = categoryTotals([
    { category_id: "a", category: { name: "Packaging" }, amount_paise: 100, status: "active" },
    { category_id: "b", category: { name: "Rent" }, amount_paise: 500, status: "active" },
    { category_id: "a", category: { name: "Packaging" }, amount_paise: 50, status: "active" },
    { category_id: "b", category: { name: "Rent" }, amount_paise: 9999, status: "voided" },
  ]);
  assert.deepEqual(rows, [{ categoryId: "b", name: "Rent", totalPaise: 500, count: 1 }, { categoryId: "a", name: "Packaging", totalPaise: 150, count: 2 }]);
});

const base = { amount: "450.50", categoryId: "c", spentOn: "2026-10-20", paidVia: "upi", tax: "", description: " Tape ", attachments: "[]", vendorId: "" };

test("validateExpense: clean input → paise", () => {
  assert.deepEqual(validateExpense(base, { today: "2026-10-21" }).data, {
    category_id: "c", amount_paise: 45050, tax_paise: 0, spent_on: "2026-10-20", paid_via: "upi", vendor_id: null, description: "Tape", attachments: [],
    is_recurring: false, recurrence: null, next_due_on: null,
  });
  const recurring = validateExpense({ ...base, isRecurring: "on", recurrence: "monthly" }).data;
  assert.equal(recurring.next_due_on, "2026-11-20", "blank next date = one step later");
  assert.equal(validateExpense({ ...base, isRecurring: "on", recurrence: "yearly", nextDueOn: "2027-04-01" }).data.next_due_on, "2027-04-01");
  assert.equal("is_recurring" in validateExpense(base, { occurrence: true }).data, false, "occurrences carry no repeat fields");
});

test("validateExpense: helpful errors", () => {
  assert.match(validateExpense({ ...base, amount: "" }).error, /amount/);
  assert.match(validateExpense({ ...base, amount: "0" }).error, /more than ₹0/);
  assert.match(validateExpense({ ...base, categoryId: "" }).error, /category/);
  assert.match(validateExpense({ ...base, spentOn: "2026-02-30" }).error, /date/);
  assert.match(validateExpense({ ...base, spentOn: "2026-10-22" }, { today: "2026-10-21" }).error, /future/);
  assert.match(validateExpense({ ...base, paidVia: "cheque" }).error, /how it was paid/);
  assert.match(validateExpense({ ...base, tax: "500" }).error, /Tax can't be more/);
  assert.match(validateExpense({ ...base, tax: "1.234" }).error, /Tax must be/);
  assert.match(validateExpense({ ...base, isRecurring: "on", recurrence: "" }).error, /how often/);
  assert.match(validateExpense({ ...base, isRecurring: "on", recurrence: "monthly", nextDueOn: "2026-10-20" }).error, /after the date spent/);
  assert.match(validateExpense({ ...base, attachments: JSON.stringify([{ publicId: "evil" }]) }).error, /receipt files/);
});
