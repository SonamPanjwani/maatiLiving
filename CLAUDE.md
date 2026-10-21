# Maati Living

Premium e-commerce site for **Maati Living**, a small Indian brand selling handcrafted home products: **terracotta diyas** and **coconut shell products** (planters, dhoop stands, agarbatti stands, pen stands). Founded by three women (brochure: "About Maati Living.docx"; founders in `src/config/business.js`). Tagline: *Thoughtfully chosen. Naturally better.* Instagram: [@maatiliving](https://instagram.com/maatiliving).

Brand voice: warm, plain, unhurried. Short sentences. Natural materials, Indian artisans, less waste, things you'll actually use. No hard sell.

## Stack

- **Next.js 14** (App Router), **plain JavaScript** (no TypeScript), React 18
- **framer-motion** for animation (hero slideshow), **lucide-react** for icons
- **next-cloudinary** for images (`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`); falls back to CSS "textile" placeholders when unset or no `publicId`
- **Supabase** (`@supabase/ssr` + `supabase-js`) for auth, roles and the catalogue; schema in `supabase/migrations/`, setup steps in `docs/SETUP.md`
- Plain global CSS in `app/globals.css` — no Tailwind, no CSS modules
- Path alias: `@/*` → project root (`jsconfig.json`)

Commands: `npm run dev`, `npm run build`, `npm start`, `npm test`, `npm run check:launch`.

## Layout

```
app/
  page.js              home page — server component composing sections (revalidate 60s)
  globals.css          entire design system (16 = admin, 17 = shop/product pages)
  (store)/            inner storefront pages sharing layout.js (solid Navbar, Footer, WhatsApp):
                       shop/ (all), shop/[category]/ (incl. sub-categories), products/[slug]/,
                       cart/, checkout/ (+ actions.js), orders/[orderNumber]/ (?t=access token),
                       account/ (login, signup, forgot/reset-password, orders, addresses, profile; actions.js),
                       about/, contact/, privacy/, terms/, returns/, shipping-policy/ (policies read src/config/business.js)
  layout.js            root: next/font (Fraunces, Work Sans → --font-fraunces/--font-work-sans), metadata
                       (title template "%s — Maati Living", OG image), skip link, CartProvider
  sitemap.js, robots.js, not-found.js, error.js
  auth/callback        exchanges Supabase email-link codes for a session, then ?next= (sanitised)
  admin/               /admin — login/, (panel)/: dashboard (page.js), orders (+ export/route.js CSV),
                       products, categories, inventory, customers, settings (delivery); actions.js
                       books/: vendors, purchases (list, new, [id], [id]/edit, [id]/receive, [id]/print),
                       payments (list, new, [id] + allocation/void), payables,
                       expenses (month list, new, [id], [id]/edit, [id]/confirm, categories),
                       reports (index, pnl, margin, statement, ageing, valuation, movements, expenses;
                       csv/route.js, ca-export/route.js ZIP via fflate)
                       search/: global admin search (src/lib/admin-search.js)
  api/cloudinary/sign  signs admin photo uploads (admin-only); bills folder must be type "authenticated"
  api/books/bill       admin-only: 302 to a signed URL for a private bill file (thumb/view/original, PDF page)
  api/razorpay/webhook verifies Razorpay webhook signature, marks orders paid/failed
middleware.js          /admin, /account, /checkout: refresh session; signed-out → /admin/login or /account/login?next=
components/
  home/                one file per home-page section (Navbar, Hero, Intro, Collection,
                       ProductCard, Why, Beliefs, Story, Approach, FinalCta, Footer).
                       Navbar (`solid` prop off the hero), Footer and ProductCard are reused site-wide.
  shop/                ShopListing, CategoryNav, ProductGallery (client: swipe + thumbnails)
  cart/                CartProvider (context + localStorage, wraps app in root layout), CartButton,
                       AddToCart, CartView, CheckoutForm (opens Razorpay Checkout; saved-address picker)
  account/             AuthForms, AuthPage, AccountShell, ProfileForm, AddressForm, AddressFields (shared w/ checkout)
  orders/              OrderSummary (customer-facing order detail, used by token page + account),
                       UpiPaymentPanel (server: amount, UPI ID, intent link, QR via `qrcode`), UpiReferenceForm
  legal/               LegalPage (policy frame + draft notice), V (renders TODO values highlighted), BusinessAddress
scripts/check-launch.mjs  `npm run check:launch`: env, business TODOs, live DB (migrations, admin, products, delivery)
docs/                  SETUP.md (accounts/keys/migrations), DEPLOY.md (Netlify → production Supabase → Hostinger SMTP/DNS → go-live, rollback, backups),
                       email-templates/ (Supabase auth emails → /auth/confirm)
  common/              shared pieces: CloudImage (client wrapper for CldImage),
                       TextilePlaceholder, WhatsAppLink, FloatingWhatsApp
  admin/               AdminBar, LoginForm, ProductForm, CategoryForm, ImageManager (multi-photo
                       upload/reorder/cover), SubmitButton, ConfirmSubmit, SetupNotice,
                       RevenueChart (client; dataviz rules: single madder series, hover+focus, table view),
                       ShippingSettingsForm
supabase/
  migrations/          SQL schema + RLS policies (run in Supabase SQL editor)
  seed.sql             starter categories/products
src/
  config/site.js       brand + contact config (env-driven), getWhatsAppUrl()
  config/business.js   legal name, address, grievance officer, policy numbers, founders ("TODO…" until filled)
  config/seo.js        siteUrl (NEXT_PUBLIC_SITE_URL), ogImageUrl(publicId), jsonLd() safe serialiser
  config/cloudinary.js Cloudinary config, isCloudinaryConfigured
  config/shop.js       shippingFor(subtotal, state, settings), defaultShippingSettings, limits, Indian states
  data/categories.js   fallback categories, used when Supabase isn't configured
  data/products.js     fallback catalogue, used when Supabase isn't configured
  data/hero.js         hero slides (Cloudinary publicIds)
  lib/catalog.js       async storefront getters (Supabase or fallback) + row→shape mappers
  lib/admin-catalog.js admin reads through the user session (hidden products, order search/export,
                       customers grouped by email, dashboard aggregates in IST)
  lib/auth.js          getCurrentUser / getCurrentAdmin / requireAdminPage / assertAdmin /
                       requireCustomerPage / assertSignedIn / safeNextPath
  lib/supabase/        config, server (cookie) client, public (cookie-free) client, middleware helper
  lib/orders.js        server-only: quoteCart (re-prices from DB), validateCustomer, create/markPaid/lookup
  lib/razorpay.js      server-only: create order, verify payment + webhook signatures
  lib/email.js         server-only: order emails over SMTP via nodemailer (Hostinger; no-op without SMTP_* + MAIL_FROM), sendTestEmail
  lib/order-status.js  STATUS_LABELS, adminStatusLabel(order), ORDER_TABS (admin list + CSV export)
  lib/payment-mode.js  server-only getPaymentMode(): razorpay | upi | whatsapp
  lib/books/           data.js (admin reads), money.js (rupees⇄paise), vendors.js (validateVendor),
                       purchases.js (landed/weighted cost mirror of SQL, validatePurchase, vendorBalance, PO text),
                       payments.js (openItems, autoAllocate mirror of SQL, checkAllocation, validatePayment, statement),
                       expenses.js (validateExpense, nextDueDate mirror of SQL _next_due, monthRange, categoryTotals),
                       reports.js (P&L, margins, ageing, stock valuation, cash flow, statement range — pure),
                       report-data.js (server-only reads, paged past the 1000-row cap; dashboard figures; CA data),
                       report-csv.js (report CSVs + CA pack layouts), report-params.js, reorder.js
  lib/csv.js           toCsv / csvCell (formula-safe) / csvRupees
                       files.js (server-only: signed URLs for private bill files)
  config/payments.js   upiConfig (NEXT_PUBLIC_UPI_ID / _PAYEE_NAME), isUpiConfigured, upiPayUrl()
  lib/settings.js      getShippingSettings (public read of settings.shipping, falls back to defaults)
  lib/validation.js    clean, phone/email checks, validateAddress (shared by checkout + saved addresses)
  lib/supabase/admin.js server-only secret-key client (bypasses RLS) — checkout/payment/order lookup only
  lib/slugify.js
  lib/format.js        formatPrice (paise → "₹450")
```

## Conventions

- **Server components by default.** Add `"use client"` only for state/effects/handlers/framer-motion. Currently client: `Navbar`, `Hero`, `CloudImage`, and the interactive admin forms.
- `CldImage` has no `"use client"` directive — always import `@/components/common/CloudImage` from server components.
- Contact details come from env via `siteConfig` (see `.env.example`); never hard-code them in components.
- Read catalogue data only through `src/lib/catalog.js` (async). Never import `src/data/*` from components.
- **Admin security is three layers — keep all three for any new admin feature:** middleware (signed in) → `(panel)/layout.js` `requireAdminPage()` (role = admin) → `assertAdmin()` at the top of every server action / route handler. The database enforces the same through RLS (`public.is_admin()`).
- Roles change only via SQL (`update profiles set role = 'admin' …`); there is deliberately no UI or policy for it.
- Storefront reads use the cookie-free public client so pages stay static; admin mutations call `revalidatePath("/", "layout")`.
- Prices are integers in **paise**; display with `formatPrice` (whole rupees without decimals, otherwise exact paise, never rounded).
- **Deploy order:** run any new migration in Supabase *before* pushing code that uses it (docs/DEPLOY.md).
- Dates: `formatDate("2026-10-20")` → "20 Oct 2026" (hand-built; Intl prints "Sept"), `formatDateTime(ts)` in IST, `todayInIndia()` for date inputs.
- **Payments:** never trust browser prices. `quoteCart` re-reads price/stock; `startCheckout` refuses if anything changed; orders are paid only via `markOrderPaid` (SQL `mark_order_paid`, idempotent, decrements stock once) after a verified Razorpay signature (checkout handler or webhook). `mark_order_paid` is executable by `service_role` only.
- The secret-key client (`src/lib/supabase/admin.js`) is for guest checkout, payment confirmation, order lookups by access token and `claim_guest_orders` only; admin and account screens use the session client so RLS applies.
- **Customer data:** account pages filter by `user_id = user.id` explicitly in addition to RLS (admins' RLS would otherwise see every order). Customers can update only `profiles.full_name`/`phone` (column-level grant) — never `role`. Post-login redirects go through `safeNextPath`.
- Delivery is per state, edited in /admin → Delivery (`settings` row `shipping`: `{ defaultPaise, freeOverPaise, byStatePaise }`). Server components load it with `getShippingSettings()` and pass it to client components; `quoteCart` uses the same settings, so display and charge always agree.
- **Payment modes** (`getPaymentMode()` in `src/lib/payment-mode.js`, decided by config): `razorpay` (keys + secret key) → `upi` (`NEXT_PUBLIC_UPI_ID` + secret key: order saved as `payment_method = 'upi_manual'`, customer pays via UPI intent/QR on the order page and submits a UTR, admin confirms with SQL `admin_confirm_manual_payment` which marks paid + decrements stock once) → `whatsapp` (checkout opens a prefilled WhatsApp order; nothing saved). A customer-entered UTR is never proof of payment: only the admin confirms.
- Refunds: full only, via `refundPayment` (Razorpay API) in `refundOrder`; direct-UPI orders are refunded outside the site. Restocking goes through SQL `admin_restock_order` (admin-only, once per order via `orders.restocked`).
- CSV export neutralises cells starting with = + - @ (spreadsheet formula injection).
- **Cart ownership** (`CartProvider`): guests → localStorage `maati-cart-v1`; signed-in → `carts` row (`0006_carts.sql`, RLS own row) + local copy `maati-cart-v1:<userId>`. Owner is re-checked on every page change (browser Supabase client, `src/lib/supabase/browser.js`); on sign-in the guest cart merges in and is cleared; on sign-out the shown cart empties. Never trust cart prices (server re-quotes).
- **Books / stock ledger** (`0007_books_foundation.sql`): `products.stock` changes only inside approved SQL functions (`_stock_move`, called by `books_adjust_stock`, the order functions, later purchases); a trigger blocks any other stock UPDATE. Every stock/money function is one transaction and RAISEs on failure (never "return an error code" after writing). New product initial stock → `opening_stock` movement via trigger. `order_items.unit_cost_paise` snapshots cost when an order is paid. `audit_log` (trigger `audit_row`) records `auth.uid()` for admin writes, `actor_kind = 'system'` for service-role writes. Vendors are archived, never deleted. Books actions live in `app/admin/(panel)/books/actions.js` and `books/purchases/actions.js` (assertAdmin in every one); reads in `src/lib/books/data.js`; money parsing `src/lib/books/money.js` (no floats).
- **Purchases** (`0008_books_purchases.sql`): `purchases` (PO-1001… from `purchase_number_seq`) + `purchase_items` are read-only to the API; writes only via `books_save_purchase` (header + lines, totals computed in SQL; unit cost must be > 0 since 0009 — samples go through Adjust stock), `books_mark_purchase_ordered`, `books_cancel_purchase`, `books_receive_purchase` (stock in, landed cost = unit × (subtotal + shipping − discount) / subtotal, weighted average with null cost = incoming cost, vendor last cost upsert; over-receive only with `p_allow_over`, which bills the received qty). After any receipt: no cancel, no line/amount edits (bill fields, files, notes stay editable). The JS mirror in `src/lib/books/purchases.js` must stay identical (a DB test compares them). Vendor balance = opening + purchases that are received/partly received or have a bill number − active payments.
- **Payments** (`0010_books_payments.sql`, brief in `docs/BOOKS_BRIEF.md`): `vendor_payments` (PAY-1001…) + `vendor_payment_allocations` (`purchase_id` null = the vendor's opening balance) are read-only to the API; writes only via `books_record_payment`, `books_set_payment_allocations` (both: null = auto, opening first then bills by bill/order date, created_at — mirrored by `autoAllocate`/`openItems` in `src/lib/books/payments.js`, a DB test compares) and `books_void_payment`. Allocation never exceeds a bill's balance or the payment; the rest is an advance. Only active payments count; voided ones stay listed. Triggers block cancelling / un-billing / shrinking a purchase below what's paid and lowering an opening balance below what's paid. Payment proof files reuse the private bills folder.
- **Expenses** (`0011_books_expenses.sql`): `expense_categories` (seeded 10; admins write directly via RLS, archive not delete) and `expenses` (EXP-1001…, read-only to the API; writes via `books_save_expense` (create/edit while active), `books_void_expense`, `books_confirm_recurring(source, due_on, data)` (posts a child with `recurring_source_id`; due_on must equal the current `next_due_on`, so no double posts), `books_skip_recurring`, `books_stop_recurring`). Recurring dates step from the template's `spent_on` (`_next_due` = JS `nextDueDate`, compared in a DB test); reminders show 7 days ahead on the dashboard and Expenses page and are never auto-posted. `amount_paise` includes tax; `tax_paise` is the GST part.
- **Reports** (Phase 5, no SQL): sales = sale orders (`paid/shipped/delivered`) by IST paid date, subtotal + delivery; COGS from `order_items.unit_cost_paise`; expenses by `spent_on`. Stock valuation: qty from `stock_movements.stock_after`, cost from the audit log's `products.cost_price_paise` changes (exact, incl. hand-set costs). Lists read in pages of 1000 (`fetchAll`). Keep the CA pack's snake_case column names stable (future imports). Dashboard Books parts fail soft (null) if a Books migration isn't run.
- **Bill files** are private Cloudinary uploads (`type: "authenticated"`, folder `maati-living/bills`, enforced by `/api/cloudinary/sign`) stored as `{publicId, format, version, pages, name}` in `purchases.bill_attachments`. Pages link through admin-only `/api/books/bill` (302 to a freshly signed URL); never put signed URLs in HTML. Original PDFs need Cloudinary's "Allow delivery of PDF and ZIP files"; PDF pages render as JPG regardless.
- **Auth speed:** `getCurrentUser()` verifies the session JWT locally with `auth.getClaims()` (project uses ES256 signing keys) and is `cache()`d per request; the profile/role is still read from the DB every request. Use `{ verified: true }` (network `getUser`) only where Auth-record fields are needed (`email_confirmed_at`, `recovery_sent_at`). Middleware uses `getClaims` too. Supabase round trips are ~0.5–1 s from here, so run independent reads with `Promise.all`.
- **Never `next build` into `.next` while `npm run dev` runs** (corrupts dev: "Cannot find module './NNNN.js'"). Build alongside dev with `NEXT_DIST_DIR=.next-prod npm run build` (+ `NEXT_DIST_DIR=.next-prod npx next start -p 3100`).
- **Books schema guard:** `books/layout.js` and `inventory/layout.js` call `missingBooksMigrations()` (`src/lib/books/schema.js`) and show `MigrationNotice` instead of crashing when a Books table is missing. Add new Books migrations to `BOOKS_MIGRATIONS`.
- **Admin header** (`components/admin/AdminBar.jsx`, links in `src/config/admin-nav.js`): sticky; desktop nav · search · View store ↗ · account `<details>`; ≤ 1080px a `<details>` hamburger with Store / Books groups. Inventory lives under Books only. `ConfirmSubmit` / `SubmitButton` show "Saving…" while pending.
- **Storefront:** shop category chips (`.shop-chips`, pills, sticky under the navbar, counts); phones get an icon-only round WhatsApp button (the footer reserves room for it). "Admin panel" link shows only when `/api/admin-status` (server, cookies + DB role) says so.
- **Hosting:** Netlify (`netlify.toml`), production Supabase = a separate project built from `supabase/production/all-in-one.sql` (`npm run sql:production` regenerates it; a test fails if stale) and marked `settings.environment = production`. `npm run check:secrets` scans the built browser bundle for secret values/names. GitHub Actions: Supabase keep-alive (every 3 days) and an encrypted weekly backup.
- **Tests:** `npm test` (node:test). `tests/db/*` boot PGlite with migrations (`tests/db/harness.mjs`); `tests/db/order-functions-regression.test.mjs` proves rewritten order functions keep identical stock results. Helpers imported by unit tests use relative `.js` imports (Node can't resolve `@/`). Demo data lives in `supabase/demo/` (never migrations).
- Secrets/env: `.env.local` (git-ignored). Document every new var in `.env.example`.

## Catalogue data model

- **Category:** `slug, name, description, parentSlug (optional, for nesting), image {publicId, alt}, sortOrder`
- **Product:** `id, slug, name, categorySlug, price (paise), stock, shortDescription, sourcingNote, images[{publicId, alt}], materials[], artisan, region, care, available, featured, sku`
  - `images` holds any number of photos; `images[0]` is the cover. Cloudinary path: `maati-living/products/<slug>/<nn>`.
  - `featured` products appear in "The Maati Edit" on the home page.

Supabase tables (`supabase/migrations/0001_auth_and_catalogue.sql`): `profiles (id, email, full_name, role)`, `categories (id, slug, name, description, parent_id, image_public_id, image_alt, sort_order)`, `products (id, slug, name, category_id, price_paise, stock, …, is_available, is_featured, sku)`, `product_images (id, product_id, public_id, alt, sort_order)`. `mapProduct`/`mapCategory` in `src/lib/catalog.js` convert rows to the shape above. Admin uploads land in Cloudinary under `maati-living/products/` and `maati-living/categories/` with auto-generated ids. New schema changes go in a new numbered migration file.

## Design system (`app/globals.css`)

Palette (CSS custom properties on `:root`):

| Token | Hex | Use |
|---|---|---|
| `--charcoal` | `#2A2622` | text, dark sections (Beliefs, CTA, footer) |
| `--ink` | `#2B3A4A` | deep indigo accent |
| `--madder` | `#A13D2E` | italic heading emphasis, links, hover, WhatsApp CTA |
| `--turmeric` | `#C68A2E` | eyebrows, numbering |
| `--moss` | `#6E7658` | "Why" section background |
| `--cotton` | `#EDE4D3` | page background, light text on dark |
| `--cotton-2` | `#E4D8C2` | alternate light background (collection) |
| `--line` | `rgba(42,38,34,.13)` | hairline dividers |
| `--chart-out` | `#2F65A8` | chart only, not text: "money out" beside madder (validated pair) |

Typography (self-hosted via next/font; CSS uses `var(--font-fraunces)` / `var(--font-work-sans)`, never the family names): **Fraunces** (serif, 400/500, real italics) for `h1–h3`, logo, large questions — tight negative letter-spacing, `<em>` italics in madder for emphasis. **Work Sans** (400/500/600) for body at 15px/1.6. Small uppercase labels use `.eyebrow` (10px, .19em tracking, turmeric).

Patterns: `.section` / `.section-grid` (two-column, 10vw padding), `.section-heading`, `.body-copy`, `.button` + `.button-dark` / `.button-light`, `.text-link` (underlined uppercase with `ArrowUpRight`), numbered lists (`01`, `02`…), square corners, no rounded cards, no drop shadows except the floating WhatsApp button and the solid navbar (owner asked for a shade so it never blends into the page). The home navbar starts transparent over the hero and turns solid on scroll (`Navbar` listens to scroll). One mobile breakpoint at **700px** (8vw gutters). Respect `prefers-reduced-motion`.

## Rule: keep the existing visual style

**Every new page must look like it belongs to the current home page.** Use the tokens, fonts and classes above; reuse components in `components/common/`; extend `globals.css` in its existing sections rather than inventing a parallel style. Run the `maati-style-reviewer` agent (`.claude/agents/`) after building new UI.

## Roadmap

- **Phase 0 — Foundation** ✅ git, CLAUDE.md, componentised home page, readable CSS, env-driven config, real product data.
- **Phase 1 — Supabase auth + RBAC** ✅ (code) — email/password login at `/admin/login`, `profiles.role` (`admin` | `customer`), RLS, middleware. Single admin (the owner); public sign-up off until Phase 4.
- **Phase 2b — Admin: product management** ✅ (code) — `/admin/products`, `/admin/categories`: add/edit/hide/delete, sub-categories, multi-photo upload with reorder + cover + alt text, price, stock, featured.
- **Phase 2 — Shop + product pages** ✅ — `/shop`, `/shop/[category]` (includes sub-categories), `/products/[slug]` with swipeable gallery, stock status, details, related products, per-product metadata/OG image. Static + revalidate 60s. Ordering is still "Enquire on WhatsApp" until Phase 3.
- **Phase 3 — Cart + Razorpay checkout** ✅ (code) — localStorage cart, guest checkout with address, Razorpay Checkout + signature verification, webhook backstop, `orders`/`order_items` (`0002_orders.sql`), confirmation page by access token, optional Resend emails, basic `/admin/orders` (list by status, detail, mark shipped/delivered/cancelled). Needs Razorpay test keys + `SUPABASE_SECRET_KEY` to run (docs/SETUP.md §8).
- **Phase 4 — Customer account** ✅ (code) — email/password sign-up with confirmation, password reset, `/account` order history (guest orders claimed by verified email), saved addresses (one default), profile; checkout pre-fills and can save addresses (`0003_customer_accounts.sql`, docs/SETUP.md §9).
- **Phase 5 — Admin panel** ✅ (code) — dashboard (KPIs + 30-day revenue chart, to-ship, low stock, best sellers), order search/date filter/CSV export, shipping with courier + tracking (+ optional email), cancel/refund (Razorpay) with restock, inventory page, customers list, per-state delivery settings (`0004_admin_operations.sql`, docs/SETUP.md §10).
- **Direct UPI / WhatsApp ordering** ✅ (code) — launch before Razorpay KYC: manual-confirm UPI payments or WhatsApp orders (`0005_manual_upi.sql`, docs/SETUP.md §11).
- **Books (admin accounting, brief `docs/BOOKS_BRIEF.md`)** — Phase 1 stock ledger + vendors ✅, Phase 2 purchases ✅, Phase 3 payments + payables ✅ (code, `0010`), Phase 4 expenses + recurring ✅ (code, `0011`), Phase 5 reports, dashboard widgets, reorder drafts, CA export, admin search ✅ (code).
- **Phase 6 — Launch** ✅ (code) — policy pages + contact + about (from `business.js`), sitemap/robots, canonical + OG per page, Product/Organization JSON-LD, branded 404/error, self-hosted fonts, security headers, skip link, `check:launch`, docs/DEPLOY.md. Remaining: fill `business.js`, real content, keys, deploy.

Do not add auth, DB or payments ahead of their phase.

## SEO rules

- Metadata is inherited: never put `alternates.canonical` or `openGraph.url` in a layout. Each indexable page sets its own canonical; private pages (`cart`, `checkout`, `account`, `orders`, `admin`) set `robots: { index: false }` and are disallowed in `robots.js`.
- Page titles are just the page name; the root template appends " — Maati Living" (use `title: { absolute }` to opt out).

## Known TODOs

- Real WhatsApp number and contact email (`NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_CONTACT_EMAIL`).
- Supabase project not created yet — follow `docs/SETUP.md`. Until then the storefront uses `src/data/*`, whose image paths 404 on Cloudinary (real photos get uploaded via /admin).
- Story section still uses a textile placeholder; "Meet the women behind Maati" links to `#contact` (needs an About page).
