# Task: Vendor, Purchases & Books module for Maati Living admin panel

You are working in the existing Maati Living Next.js codebase (storefront + admin panel, Postgres, server actions, Cloudinary uploads). Build a premium, one-stop **vendor and books module** inside the existing admin panel so the owner can run purchasing, stock, vendor payments, expenses and profit reports from one place.

Before writing code, read the existing code and follow its patterns: folder structure, DB access layer and migrations, server actions, admin auth guard, design system/components, Cloudinary upload widget, CSV export (`/admin/orders/export`), money format, and `npm run check:launch`. Reuse components; do not introduce a new UI library.

---

## 1. Hard constraints

- **Only the two existing roles: `admin` and `customer`.** Do not add new roles, permissions tables or staff accounts. Everything in this module is admin-only.
- **Every** new page, server action, route handler and export must check admin on the server (same guard as the current `/admin` pages). A customer must get the same `not-admin` redirect / 401 as today. Never rely on hiding UI.
- **Money is stored as integer paise** (same as `price: 54900` today). No floats anywhere in money math. Show ₹ with Indian grouping (₹1,23,456).
- **No Zoho / Tally / GST filing integration now.** But keep data clean for a future sync: stable UUIDs, created/updated timestamps, optional GSTIN and tax fields, and CSV exports with consistent columns.
- **No hard deletes** of vendors, purchases, payments or expenses that have history. Use archive / cancel / void with a reason. Show archived items behind a filter.
- Stock changes must be **atomic** (DB transaction) and must never make stock negative.
- Admin UI stays in English, matching the current admin look; must work well on a phone (owner will use it on mobile).
- Ask me before any migration that drops or rewrites existing columns or data.

---

## 2. Data model (create migrations)

Adapt names to the existing schema conventions.

**vendors**
- id, name (required), contact_person, phone (10-digit Indian, `[6-9]\d{9}`), whatsapp (default = phone), email, city, state, address
- gstin (optional, validate 15-char GSTIN format if filled), pan (optional)
- upi_id, bank_account_name, bank_account_number, bank_ifsc (all optional)
- supplies (free text tags, e.g. "diyas, coconut shell"), notes, rating (1–5, optional)
- payment_terms_days (default 0), opening_balance_paise (amount we owed them on day one, default 0)
- status: active | archived; created_at, updated_at

**vendor_products** — link vendors to products
- vendor_id, product_id, vendor_sku (optional), last_cost_paise, is_preferred (one preferred vendor per product)

**purchases** (purchase order + bill in one record)
- id, number (human readable `PO-1001`, sequential), vendor_id
- status: draft | ordered | partially_received | received | cancelled
- order_date, expected_date
- bill_number, bill_date, bill_attachments (Cloudinary public IDs, images/PDF)
- subtotal_paise, discount_paise, shipping_paise (freight we paid on this purchase), tax_paise (optional, for future GST), total_paise
- due_date (bill_date + vendor payment_terms_days, editable)
- notes, cancelled_reason, created_at, updated_at

**purchase_items**
- purchase_id, product_id, qty_ordered, qty_received, unit_cost_paise, tax_rate (optional), line_total_paise

**vendor_payments**
- id, number (`PAY-1001`), vendor_id, amount_paise, paid_on, method: upi | bank | cash | other, reference (UTR etc.), attachment, notes
- status: active | voided (+ void_reason)

**vendor_payment_allocations**
- payment_id, purchase_id, amount_paise (a payment can cover several bills; part of a payment can stay unallocated as advance)

**expense_categories** — seed: Packaging, Courier & shipping, Ads & marketing, Photography, Website & software, Travel, Rent, Utilities, Bank & payment charges, Miscellaneous. Admin can add/rename/archive.

**expenses**
- id, category_id, amount_paise, spent_on, paid_via (upi | bank | cash | card | other), vendor_id (optional), description, receipt attachments, tax_paise (optional)
- is_recurring, recurrence (monthly | yearly), next_due_on — recurring expenses create a "due" reminder on the dashboard; the admin confirms each occurrence (do not auto-post amounts).
- status: active | voided (+ void_reason)

**stock_movements** — single source of truth for every stock change
- id, product_id, qty_change (+/−), reason: purchase_receipt | order_paid | order_cancel_restock | manual_adjustment | opening_stock, ref_type + ref_id (purchase / order / adjustment), unit_cost_paise (for receipts), note, created_by, created_at
- Backfill: one `opening_stock` movement per product with current stock and current cost.
- Hook the **existing** flows into this table: order payment confirmed (stock −), order cancelled with restock (stock +). Do not change their behaviour, only record the movement in the same transaction.

**products** — add `cost_price_paise` (weighted average cost, nullable until first purchase or manual set).

**order_items** — add `unit_cost_paise` snapshot, filled when an order is marked paid, so margins stay correct even if cost changes later.

**audit_log** — who (admin user id), what entity, action, before/after JSON, when. Write an entry for every create/update/cancel/void in this module.

---

## 3. Business rules

1. **Receiving stock:** on a purchase, "Receive items" lets the admin enter qty received per line (pre-filled with remaining qty). In one transaction: increase product stock, write `purchase_receipt` movements, update `qty_received`, set status to `partially_received` / `received`, update `vendor_products.last_cost_paise`.
2. **Weighted average cost** on each receipt: `new_cost = (old_stock × old_cost + received_qty × unit_cost_landed) / (old_stock + received_qty)`, rounded to paise. `unit_cost_landed` spreads the purchase's shipping and discount across lines proportionally by value. Unit-test this.
3. Receiving more than ordered: allow, with a clear warning and confirmation.
4. A purchase that has any received qty cannot be cancelled or have lines edited; corrections go through **stock adjustment** (with mandatory reason) and a note on the purchase.
5. **Vendor balance** = opening_balance + sum of received/billed purchase totals − sum of active payments. Show per bill: total, paid, balance, due date, overdue days.
6. Payments: allocate automatically to oldest unpaid bills first, but let the admin change allocation. Block allocating more than a bill's balance. Unallocated amount shows as "Advance".
7. Voiding a payment or expense removes it from all totals but keeps it visible (struck through) with the reason.
8. Manual stock adjustment: + or −, reason required (damaged, lost, sample, recount, other), cannot go below zero.
9. Low stock threshold already exists on the dashboard ("more than 5") — keep it and add a per-product override.

---

## 4. Admin screens (premium UX)

Add an **"Books"** area to the admin nav: Vendors · Purchases · Payments · Expenses · Reports. Keep the existing Dashboard, Orders, Products, Categories, Inventory.

**Vendors**
- List: search (name, phone, city, supplies), filter active/archived, sort by balance due. Columns: name, city, supplies, balance due, overdue badge, last purchase.
- Vendor detail (one-stop page): header with contact, call / WhatsApp / copy UPI buttons; KPI tiles (total purchased, paid, balance due, overdue); tabs: Purchases, Payments, Products supplied (with last cost, preferred toggle), Statement, Notes & documents.
- Quick actions: New purchase, Record payment, Share statement on WhatsApp.

**Purchases**
- List with status tabs (Draft, Ordered, Partially received, Received, Cancelled) and filters (vendor, date range, unpaid/overdue).
- New/edit purchase: pick vendor → add products with search; unit cost pre-fills from vendor's last cost; live totals; add bill number/date and upload bill photo/PDF (Cloudinary).
- Detail: timeline (created → ordered → received → paid), lines with ordered/received, "Receive items", "Record payment", "Share PO on WhatsApp" (wa.me link with a clean text summary of items and qty, no prices unless chosen), printable PO/bill view (print CSS → PDF).

**Payments**
- Record payment: vendor, amount, date, method, UTR/reference, proof upload, allocation table showing open bills.
- List with filters, totals for the selected period.

**Expenses**
- Fast add form (mobile-first: amount, category, date, paid via, photo of receipt). Recurring toggle.
- List with category filter, month switcher, category totals.

**Inventory (extend existing)**
- Per product: current stock, cost price, selling price, margin %, stock value at cost and at selling price, preferred vendor.
- Stock movement history per product.
- "Adjust stock" dialog.
- Low-stock list with **"Create reorder draft"** → creates a draft purchase for the preferred vendor with suggested qty.

**Dashboard (add widgets, keep current ones)**
- This month: revenue, cost of goods sold, gross profit, expenses, net profit (with last month comparison).
- Payables: total due, overdue count, next 3 bills due.
- Recurring expenses due this week.
- Low stock with reorder button.
- Small cash-flow chart (money in from paid orders vs money out to vendors + expenses, last 6 months).

**Reports** (each with date range, on-screen table, CSV download; P&L and vendor statement also as print/PDF)
1. **Profit & Loss** (monthly): Sales (paid orders, net of cancellations) + delivery charges collected − COGS (from `order_items.unit_cost_paise`) = Gross profit − Expenses by category = Net profit.
2. **Product margin:** units sold, revenue, COGS, gross margin %, per product and per category.
3. **Vendor statement:** opening balance, bills, payments, running balance — share via WhatsApp text + PDF.
4. **Payables ageing:** 0–30, 31–60, 61–90, 90+ days per vendor.
5. **Stock valuation** as of a date (from stock_movements).
6. **Stock movement ledger.**
7. **Expenses by category.**
8. **CA export pack:** one button that downloads a ZIP of CSVs for the chosen month — sales (orders), purchases, purchase items, vendor payments, expenses, stock valuation — with stable column names (future Zoho/Tally import).

**UX quality bar**
- Consistent with the current admin design; polished empty states with a clear first action; skeleton loaders; success/error toasts; inline validation with helpful messages.
- Every destructive or money action (cancel, void, receive, over-receive, adjust) asks for confirmation with a short summary.
- Mobile: forms in one column, sticky save button, large tap targets (44px), tables become cards on small screens.
- Global admin search box (vendors, purchases by PO/bill number, products, orders).
- Accessible labels on every input; numbers right-aligned; dates as "20 Oct 2026".

---

## 5. Security & quality

- Server-side admin check in every new server action and route (write a shared `requireAdmin()` if not present and use it everywhere).
- Validate all inputs on the server (amounts > 0, integers in paise, quantities > 0, dates valid, IDs belong to the right parent).
- Bill/receipt uploads go to a separate Cloudinary folder, authenticated/private delivery if the current setup supports it.
- Use DB transactions for receive, payment allocation, adjustments, and the hooks on order paid/cancel.
- Tests: unit tests for weighted average cost, landed cost split, vendor balance, payment allocation, P&L numbers. Add a seed script with 2 demo vendors, 3 purchases and a few expenses (clearly marked demo, easy to remove).
- Extend `npm run check:launch` to verify the new migrations ran and admin guards exist on all `/admin/books` routes.

---

## 6. Out of scope (later "Level 2")

Zoho Books/Tally sync, GST return filing, e-invoicing, TDS, double-entry ledger/balance sheet, new roles or staff logins.

---

## 7. How to work

1. First reply with: what you found in the codebase that this builds on, the final table list, and the phase plan. Wait for my OK.
2. Build in phases, each one working end to end before the next:
   - Phase 1: migrations, stock_movements + hooks into existing order flows, cost price, vendors.
   - Phase 2: purchases + receiving + bill uploads.
   - Phase 3: payments + allocations + payables.
   - Phase 4: expenses + recurring.
   - Phase 5: inventory extensions, dashboard widgets, reports, CA export.
3. After each phase: list files changed, run tests/lint, and give me a short manual test checklist.
4. Do not change the storefront or customer flows except the stock_movements hooks and the `unit_cost_paise` snapshot.
