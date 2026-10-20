// Purchases: costing maths (mirrors the SQL in 0008_books_purchases.sql), form validation, balances and
// share text. Pure functions, no server imports — used by server actions, client forms and unit tests.
// Relative imports on purpose so `node --test` can load this file directly.
import { rupeesToPaise } from "./money.js";

export const PURCHASE_STATUS = {
  draft: "Draft",
  ordered: "Ordered",
  partially_received: "Partially received",
  received: "Received",
  cancelled: "Cancelled",
};

// Integer division rounded half away from zero (same as Postgres round(numeric) for these positive values).
function divRound(numerator, denominator) {
  const n = BigInt(numerator);
  const d = BigInt(denominator);
  const sign = (n < 0n) !== (d < 0n) ? -1n : 1n;
  const a = n < 0n ? -n : n;
  const b = d < 0n ? -d : d;
  return Number(sign * ((2n * a + b) / (2n * b)));
}

// Landed unit cost: shipping minus discount spread across lines by value (every rupee of goods carries the same
// share). A purchase worth ₹0 spreads it per piece instead.
export function landedUnitCost(unitCostPaise, { subtotalPaise, shippingPaise = 0, discountPaise = 0, totalQty = 0 }) {
  if (subtotalPaise > 0) return divRound(unitCostPaise * (subtotalPaise + shippingPaise - discountPaise), subtotalPaise);
  if (totalQty > 0) return Math.max(unitCostPaise + divRound(shippingPaise - discountPaise, totalQty), 0);
  return unitCostPaise;
}

// Weighted average cost after a receipt. An unknown (null) cost counts as the incoming landed cost,
// so the first receipt sets it.
export function weightedAverageCost(oldStock, oldCostPaise, qty, landedPaise) {
  if (oldCostPaise == null || oldStock <= 0) return landedPaise;
  return divRound(oldStock * oldCostPaise + qty * landedPaise, oldStock + qty);
}

// Live totals for the purchase form: lines [{ qty, unitCostPaise }] (invalid lines count as 0).
export function purchaseTotals(lines, { discountPaise = 0, shippingPaise = 0, taxPaise = 0 } = {}) {
  const subtotalPaise = lines.reduce((sum, line) => sum + (Number.isInteger(line.qty) && Number.isInteger(line.unitCostPaise) ? line.qty * line.unitCostPaise : 0), 0);
  return { subtotalPaise, totalPaise: subtotalPaise - discountPaise + shippingPaise + taxPaise };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function validDate(value) {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const BILL_FILE = /^maati-living\/bills\/[A-Za-z0-9_/-]+$/;

// Cleans uploaded bill file records ({ publicId, format, version, pages, name }) and drops anything unexpected.
export function cleanAttachments(value) {
  let list;
  try { list = typeof value === "string" ? JSON.parse(value || "[]") : value; } catch { return null; }
  if (!Array.isArray(list) || list.length > 20) return null;
  const clean = [];
  for (const file of list) {
    if (!file || !BILL_FILE.test(String(file.publicId ?? ""))) return null;
    clean.push({
      publicId: String(file.publicId),
      format: String(file.format ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8),
      version: String(file.version ?? "").replace(/\D/g, "").slice(0, 16),
      pages: Number.isInteger(file.pages) && file.pages > 0 ? Math.min(file.pages, 200) : 1,
      name: String(file.name ?? "").slice(0, 120),
    });
  }
  return clean;
}

// Validates the purchase form. input: plain object of form fields; items: JSON string
// [{ productId, qty, unitCost (rupees text) }]. Returns { vendorId, header, items } or { error }.
// { locked: true } validates only the bill / notes fields (stock already received).
export function validatePurchase(input, { locked = false } = {}) {
  const text = (key) => String(input[key] ?? "").trim();
  const vendorId = text("vendorId");
  if (!vendorId) return { error: "Choose a vendor." };

  const header = {};
  for (const key of ["orderDate", "expectedDate", "billDate", "dueDate"]) {
    const value = text(key);
    if (value && !validDate(value)) return { error: "Please enter valid dates." };
    header[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = value || null;
  }
  if (header.expected_date && header.order_date && header.expected_date < header.order_date) return { error: "The expected date is before the order date." };
  if (header.due_date && header.bill_date && header.due_date < header.bill_date) return { error: "The due date is before the bill date." };

  header.bill_number = text("billNumber").slice(0, 60) || null;
  const notes = text("notes");
  if (notes.length > 2000) return { error: "Notes are too long (2000 characters max)." };
  header.notes = notes || null;
  const attachments = cleanAttachments(input.attachments ?? "[]");
  if (!attachments) return { error: "The bill files couldn't be read. Please upload them again." };
  header.bill_attachments = attachments;

  if (locked) return { vendorId, header, items: null };

  for (const [field, key, label] of [["discount", "discount_paise", "Discount"], ["shipping", "shipping_paise", "Shipping"], ["tax", "tax_paise", "Tax"]]) {
    const paise = rupeesToPaise(text(field));
    if (Number.isNaN(paise)) return { error: `${label} must be an amount in rupees, e.g. 150 or 150.50.` };
    header[key] = paise ?? 0;
  }
  header.mark_ordered = input.intent === "ordered";

  let raw;
  try { raw = JSON.parse(String(input.items ?? "[]")); } catch { return { error: "The item list couldn't be read. Please try again." }; }
  if (!Array.isArray(raw) || raw.length === 0) return { error: "Add at least one item." };
  if (raw.length > 200) return { error: "Up to 200 items per purchase." };
  const seen = new Set();
  const items = [];
  for (const line of raw) {
    const productId = String(line?.productId ?? "");
    const name = String(line?.name ?? "an item");
    if (!productId) return { error: "Choose a product for every line." };
    if (seen.has(productId)) return { error: `${name} is in the list twice — combine them into one line.` };
    seen.add(productId);
    const qty = Number(line.qty);
    if (!Number.isInteger(qty) || qty <= 0 || qty > 100000) return { error: `Quantity for ${name} must be a whole number above 0.` };
    const unitCost = rupeesToPaise(line.unitCost);
    if (unitCost == null || Number.isNaN(unitCost)) return { error: `Enter the cost per piece for ${name}, e.g. 120 or 120.50.` };
    items.push({ product_id: productId, qty, unit_cost_paise: unitCost });
  }
  const { subtotalPaise } = purchaseTotals(items.map((item) => ({ qty: item.qty, unitCostPaise: item.unit_cost_paise })));
  if (header.discount_paise > subtotalPaise) return { error: "The discount can't be more than the items total." };
  return { vendorId, header, items };
}

// A purchase counts towards what we owe the vendor once goods arrived or the bill is in (and it isn't cancelled).
export const isPayable = (purchase) => purchase.status !== "cancelled"
  && (purchase.status === "partially_received" || purchase.status === "received" || Boolean(purchase.bill_number));

// Balance due = opening balance + payable purchase totals (payments subtract from Phase 3).
export function vendorBalance(openingBalancePaise, purchases = []) {
  return purchases.filter(isPayable).reduce((sum, purchase) => sum + purchase.total_paise, openingBalancePaise ?? 0);
}

// WhatsApp text for a purchase order. Prices only when asked for; internal notes are never included.
export function purchaseOrderText(purchase, { withPrices = false, formatPrice, formatDate, businessName = "Maati Living" }) {
  const lines = [`*Purchase order ${purchase.number}* — ${businessName}`, `Date: ${formatDate(purchase.order_date)}`];
  if (purchase.expected_date) lines.push(`Needed by: ${formatDate(purchase.expected_date)}`);
  lines.push("");
  purchase.items.forEach((item, index) => {
    const qty = Math.max(item.qty_ordered, item.qty_received);
    lines.push(`${index + 1}. ${item.product?.name ?? "Item"} — ${qty} pcs${withPrices ? ` × ${formatPrice(item.unit_cost_paise)} = ${formatPrice(item.line_total_paise)}` : ""}`);
  });
  if (withPrices) {
    lines.push("");
    if (purchase.discount_paise) lines.push(`Discount: −${formatPrice(purchase.discount_paise)}`);
    if (purchase.shipping_paise) lines.push(`Shipping: ${formatPrice(purchase.shipping_paise)}`);
    if (purchase.tax_paise) lines.push(`Tax: ${formatPrice(purchase.tax_paise)}`);
    lines.push(`*Total: ${formatPrice(purchase.total_paise)}*`);
  }
  lines.push("", "Please confirm. Thank you!");
  return lines.join("\n");
}

// Link to a private bill file through the admin-only route (which signs a fresh Cloudinary URL).
export function billFileUrl(file, { size = "view", page } = {}) {
  const params = new URLSearchParams({ id: file.publicId, f: file.format || "jpg", v: file.version || "", size });
  if (page) params.set("page", String(page));
  return `/api/books/bill?${params}`;
}
