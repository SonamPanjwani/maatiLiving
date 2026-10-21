// Expenses: form validation, recurring dates (mirrors _next_due in 0011_books_expenses.sql), month ranges and totals.
// Pure functions, no server imports — used by server code, client forms and unit tests.
// Relative imports on purpose so `node --test` can load this file directly.
import { rupeesToPaise } from "./money.js";
import { cleanAttachments } from "./purchases.js";

export const PAID_VIA = { upi: "UPI", cash: "Cash", card: "Card", bank: "Bank transfer", other: "Other" };
export const RECURRENCE = { monthly: "Every month", yearly: "Every year" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function validDate(value) {
  if (!DATE.test(String(value ?? ""))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const iso = (y, m, d) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

// Postgres date + n months: same day, or the month's last day if it's shorter (31 Jan + 1 month = 28 Feb).
export function addMonths(isoDate, months) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return iso(year, month, Math.min(d, daysIn(year, month)));
}

// First date after `after` in the series start + n steps (n ≥ 1), always counted from the start so month ends
// don't drift: 31 Jan → 28 Feb → 31 Mar.
export function nextDueDate(start, after, recurrence) {
  const step = recurrence === "yearly" ? 12 : 1;
  for (let n = 1; n < 100000; n += 1) {
    const date = addMonths(start, n * step);
    if (date > after) return date;
  }
  return null;
}

// "2026-10" → { from: "2026-10-01", to: "2026-10-31", label: "Oct 2026", prev: "2026-09", next: "2026-11" }.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthRange(month) {
  const match = String(month ?? "").match(/^(\d{4})-(\d{2})$/);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const shift = (n) => addMonths(iso(y, m, 1), n).slice(0, 7);
  return { month: `${match[1]}-${match[2]}`, from: iso(y, m, 1), to: iso(y, m, daysIn(y, m)), label: `${MONTHS[m - 1]} ${y}`, prev: shift(-1), next: shift(1) };
}

// Totals by category for active expenses, biggest first: [{ categoryId, name, totalPaise, count }].
export function categoryTotals(expenses) {
  const totals = new Map();
  for (const expense of expenses) {
    if (expense.status !== "active") continue;
    const key = expense.category_id;
    const row = totals.get(key) ?? { categoryId: key, name: expense.category?.name ?? "Uncategorised", totalPaise: 0, count: 0 };
    row.totalPaise += expense.amount_paise;
    row.count += 1;
    totals.set(key, row);
  }
  return [...totals.values()].sort((a, b) => b.totalPaise - a.totalPaise || a.name.localeCompare(b.name));
}

// Reminder state of a repeating expense: "overdue" (due date passed), "due" (today to 7 days ahead), "upcoming".
export function dueState(nextDueOn, today) {
  if (!nextDueOn) return null;
  if (nextDueOn < today) return "overdue";
  return nextDueOn <= addDays(today, 7) ? "due" : "upcoming";
}

export function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Validates the expense form. Returns { data } (DB field names, paise) or { error }.
// { occurrence: true } = confirming a repeating expense (no repeat fields).
export function validateExpense(input, { today, occurrence = false } = {}) {
  const text = (key) => String(input[key] ?? "").trim();
  const amount = rupeesToPaise(text("amount"));
  if (amount == null || Number.isNaN(amount)) return { error: "Enter the amount in rupees, e.g. 450 or 450.50." };
  if (amount <= 0) return { error: "The amount must be more than ₹0." };
  if (amount > 1000000000) return { error: "That amount is too large for one expense." };
  const categoryId = text("categoryId");
  if (!categoryId) return { error: "Choose a category." };
  const spentOn = text("spentOn");
  if (!validDate(spentOn)) return { error: "Enter the date it was spent." };
  if (today && spentOn > today) return { error: "The date can't be in the future." };
  const paidVia = text("paidVia");
  if (!PAID_VIA[paidVia]) return { error: "Choose how it was paid." };
  const tax = rupeesToPaise(text("tax"));
  if (Number.isNaN(tax)) return { error: "Tax must be an amount in rupees, e.g. 81 or 81.50." };
  if ((tax ?? 0) > amount) return { error: "Tax can't be more than the amount." };
  const description = text("description");
  if (description.length > 300) return { error: "The description is too long (300 characters max)." };
  const attachments = cleanAttachments(input.attachments ?? "[]");
  if (!attachments || attachments.length > 10) return { error: "The receipt files couldn't be read (up to 10). Please upload them again." };

  const data = {
    category_id: categoryId, amount_paise: amount, tax_paise: tax ?? 0, spent_on: spentOn, paid_via: paidVia,
    vendor_id: text("vendorId") || null, description: description || null, attachments,
  };
  if (occurrence) return { data };

  const isRecurring = input.isRecurring === "on" || input.isRecurring === true;
  data.is_recurring = isRecurring;
  data.recurrence = null;
  data.next_due_on = null;
  if (isRecurring) {
    const recurrence = text("recurrence");
    if (!RECURRENCE[recurrence]) return { error: "Choose how often it repeats." };
    const next = text("nextDueOn");
    if (next && !validDate(next)) return { error: "Enter a valid next due date." };
    if (next && next <= spentOn) return { error: "The next due date must be after the date spent." };
    data.recurrence = recurrence;
    data.next_due_on = next || nextDueDate(spentOn, spentOn, recurrence);
  }
  return { data };
}
