// Vendor payments: open items (opening balance + bills), auto-allocation (mirrors the SQL in
// 0010_books_payments.sql), form validation, vendor balance, statement and share text.
// Pure functions, no server imports — used by server code, client forms and unit tests.
// Relative imports on purpose so `node --test` can load this file directly.
import { rupeesToPaise } from "./money.js";
import { cleanAttachments, isPayable, vendorBalance } from "./purchases.js";

export const PAYMENT_METHODS = { upi: "UPI", bank: "Bank transfer", cash: "Cash", other: "Other" };
export const OPENING = "opening"; // allocation target key for the vendor's opening balance

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function validDate(value) {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Whole days from a to b ("YYYY-MM-DD"); positive when b is later.
export function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

const targetKey = (allocation) => allocation.purchase_id ?? OPENING;

// Paid per target from allocations of active payments: Map(purchaseId | "opening" → paise).
// allocations: [{ purchase_id, amount_paise, payment: { status } | payment_status, payment_id }]
export function paidByTarget(allocations = [], { exceptPaymentId = null } = {}) {
  const paid = new Map();
  for (const allocation of allocations) {
    const status = allocation.payment?.status ?? allocation.payment_status;
    if (status !== "active" || (exceptPaymentId && allocation.payment_id === exceptPaymentId)) continue;
    const key = targetKey(allocation);
    paid.set(key, (paid.get(key) ?? 0) + allocation.amount_paise);
  }
  return paid;
}

// Sort key shared with SQL: bill date (else order date), then created_at.
const billOrder = (a, b) => (a.bill_date ?? a.order_date).localeCompare(b.bill_date ?? b.order_date) || Date.parse(a.created_at) - Date.parse(b.created_at);

// Everything a vendor can be paid for, oldest first, with paid / balance / overdue.
// Returns [{ key, purchaseId, label, number, billNumber, date, dueDate, totalPaise, paidPaise, balancePaise, overdueDays }].
export function openItems({ openingBalancePaise = 0, purchases = [], allocations = [], today, exceptPaymentId = null, includeSettled = false }) {
  const paid = paidByTarget(allocations, { exceptPaymentId });
  const items = [];
  if (openingBalancePaise > 0) {
    const paidPaise = paid.get(OPENING) ?? 0;
    items.push({ key: OPENING, purchaseId: null, label: "Opening balance", number: null, billNumber: null, date: null, dueDate: null,
      totalPaise: openingBalancePaise, paidPaise, balancePaise: openingBalancePaise - paidPaise, overdueDays: 0 });
  }
  for (const purchase of [...purchases].filter(isPayable).sort(billOrder)) {
    const paidPaise = paid.get(purchase.id) ?? 0;
    const balancePaise = purchase.total_paise - paidPaise;
    const late = today && purchase.due_date && balancePaise > 0 ? daysBetween(purchase.due_date, today) : 0;
    items.push({ key: purchase.id, purchaseId: purchase.id, label: purchase.number, number: purchase.number, billNumber: purchase.bill_number ?? null,
      date: purchase.bill_date ?? purchase.order_date, dueDate: purchase.due_date ?? null,
      totalPaise: purchase.total_paise, paidPaise, balancePaise, overdueDays: Math.max(late, 0) });
  }
  return includeSettled ? items : items.filter((item) => item.balancePaise > 0);
}

// Oldest-first allocation of an amount over open items (same order and rule as SQL auto mode).
// Returns { allocations: [{ key, purchaseId, amountPaise }], advancePaise }.
export function autoAllocate(amountPaise, items) {
  let left = amountPaise;
  const allocations = [];
  for (const item of items) {
    if (left <= 0) break;
    if (item.balancePaise <= 0) continue;
    const take = Math.min(left, item.balancePaise);
    allocations.push({ key: item.key, purchaseId: item.purchaseId, amountPaise: take });
    left -= take;
  }
  return { allocations, advancePaise: Math.max(left, 0) };
}

// Checks an allocation against open items and the payment amount. allocations: [{ key, amountPaise }].
// Returns { error } or { allocatedPaise, advancePaise }.
export function checkAllocation(amountPaise, allocations, items, { formatPrice = (p) => `₹${p / 100}` } = {}) {
  const byKey = new Map(items.map((item) => [item.key, item]));
  const seen = new Set();
  let allocatedPaise = 0;
  for (const allocation of allocations) {
    if (!allocation.amountPaise) continue;
    if (!Number.isInteger(allocation.amountPaise) || allocation.amountPaise < 0) return { error: "Allocated amounts must be more than ₹0." };
    if (seen.has(allocation.key)) return { error: "A bill is listed twice in the allocation." };
    seen.add(allocation.key);
    const item = byKey.get(allocation.key);
    if (!item) return { error: "A bill in the allocation is no longer open. Please reload the page." };
    if (allocation.amountPaise > item.balancePaise) return { error: `Only ${formatPrice(item.balancePaise)} is still to pay on ${item.label}.` };
    allocatedPaise += allocation.amountPaise;
  }
  if (allocatedPaise > amountPaise) return { error: `The allocation adds up to more than the payment (${formatPrice(amountPaise)}).` };
  return { allocatedPaise, advancePaise: amountPaise - allocatedPaise };
}

// Allocation form fields (alloc_<key> = rupees text) → [{ key, purchase_id, amount_paise }] or { error }.
export function parseAllocationFields(entries) {
  const allocations = [];
  for (const [name, value] of entries) {
    if (!name.startsWith("alloc_")) continue;
    const paise = rupeesToPaise(value);
    if (paise == null || paise === 0) continue;
    if (Number.isNaN(paise)) return { error: "Allocated amounts must be in rupees, e.g. 500 or 500.50." };
    const key = name.slice(6);
    allocations.push({ key, purchase_id: key === OPENING ? null : key, amount_paise: paise });
  }
  return { allocations };
}

// Validates the payment form. Returns { vendorId, payment } (DB field names, paise) or { error }.
export function validatePayment(input, { today } = {}) {
  const text = (key) => String(input[key] ?? "").trim();
  const vendorId = text("vendorId");
  if (!vendorId) return { error: "Choose a vendor." };
  const amount = rupeesToPaise(text("amount"));
  if (amount == null || Number.isNaN(amount)) return { error: "Enter the amount paid in rupees, e.g. 2500 or 2500.50." };
  if (amount <= 0) return { error: "The amount must be more than ₹0." };
  if (amount > 1000000000) return { error: "That amount is too large for one payment." };
  const paidOn = text("paidOn");
  if (!validDate(paidOn)) return { error: "Enter the date it was paid." };
  if (today && paidOn > today) return { error: "The payment date can't be in the future." };
  const method = text("method");
  if (!PAYMENT_METHODS[method]) return { error: "Choose how it was paid." };
  const notes = text("notes");
  if (notes.length > 2000) return { error: "Notes are too long (2000 characters max)." };
  const attachments = cleanAttachments(input.attachments ?? "[]");
  if (!attachments || attachments.length > 10) return { error: "The proof files couldn't be read (up to 10). Please upload them again." };
  return {
    vendorId,
    payment: { amount_paise: amount, paid_on: paidOn, method, reference: text("reference").slice(0, 80) || null, notes: notes || null, attachments },
  };
}

const isActive = (payment) => payment.status === "active";

export { vendorBalance };

// Part of each active payment not allocated to anything: [{ payment, unallocatedPaise }] (> 0 only).
export function unallocatedPayments(payments = [], allocations = []) {
  const used = new Map();
  for (const allocation of allocations) used.set(allocation.payment_id, (used.get(allocation.payment_id) ?? 0) + allocation.amount_paise);
  return payments.filter(isActive)
    .map((payment) => ({ payment, unallocatedPaise: payment.amount_paise - (used.get(payment.id) ?? 0) }))
    .filter((row) => row.unallocatedPaise > 0);
}

// Payment state of one purchase: null (not a bill yet) | "paid" | "part_paid" | "unpaid", plus overdue days.
export function purchasePayState(purchase, paidPaise, today) {
  if (!isPayable(purchase)) return { state: null, paidPaise, balancePaise: 0, overdueDays: 0 };
  const balancePaise = purchase.total_paise - paidPaise;
  const overdueDays = today && purchase.due_date && balancePaise > 0 ? Math.max(daysBetween(purchase.due_date, today), 0) : 0;
  return { state: balancePaise <= 0 ? "paid" : paidPaise > 0 ? "part_paid" : "unpaid", paidPaise, balancePaise, overdueDays };
}

export const PAY_STATE = { paid: "Paid", part_paid: "Part paid", unpaid: "Unpaid" };

// Vendor statement: opening balance, bills and payments by date with a running balance.
// Voided payments are listed (marked) but don't change the balance.
export function vendorStatement({ vendor, purchases = [], payments = [] }) {
  const rows = [];
  for (const purchase of purchases.filter(isPayable)) {
    rows.push({ kind: "bill", date: purchase.bill_date ?? purchase.order_date, sort: String(purchase.created_at), id: purchase.id,
      label: purchase.number, detail: purchase.bill_number ? `Bill ${purchase.bill_number}` : "Goods received", debitPaise: purchase.total_paise, creditPaise: 0 });
  }
  for (const payment of payments) {
    rows.push({ kind: "payment", date: payment.paid_on, sort: String(payment.created_at), id: payment.id, voided: payment.status !== "active",
      label: payment.number, detail: [PAYMENT_METHODS[payment.method] ?? payment.method, payment.reference].filter(Boolean).join(" · "),
      debitPaise: 0, creditPaise: payment.amount_paise });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? a.sort.localeCompare(b.sort) : a.kind === "bill" ? -1 : 1));
  let balance = vendor.opening_balance_paise ?? 0;
  const lines = rows.map((row) => {
    if (!row.voided) balance += row.debitPaise - row.creditPaise;
    return { ...row, balancePaise: balance };
  });
  return { openingPaise: vendor.opening_balance_paise ?? 0, lines, closingPaise: balance };
}

// WhatsApp text of a vendor statement (no internal notes).
export function statementText(vendor, statement, { formatPrice, formatDate, businessName = "Maati Living", asOf }) {
  const out = [`*Statement — ${vendor.name}*`, `From ${businessName}${asOf ? `, as of ${formatDate(asOf)}` : ""}`, ""];
  if (statement.openingPaise) out.push(`Opening balance: ${formatPrice(statement.openingPaise)}`);
  for (const line of statement.lines.filter((l) => !l.voided)) {
    out.push(line.kind === "bill"
      ? `${formatDate(line.date)} · ${line.label}${line.detail.startsWith("Bill") ? ` (${line.detail})` : ""}: ${formatPrice(line.debitPaise)}`
      : `${formatDate(line.date)} · Paid ${line.label}${line.detail ? ` (${line.detail})` : ""}: −${formatPrice(line.creditPaise)}`);
  }
  out.push("", statement.closingPaise >= 0 ? `*Balance due: ${formatPrice(statement.closingPaise)}*` : `*Advance with you: ${formatPrice(-statement.closingPaise)}*`);
  out.push("", "Please let us know if anything doesn't match. Thank you!");
  return out.join("\n");
}
