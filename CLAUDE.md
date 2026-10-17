# Maati Living

Premium e-commerce site for **Maati Living**, a small Indian brand selling handcrafted home products: **terracotta diyas** and **coconut shell products** (planters, dhoop stands, agarbatti stands, pen stands). Founded by two sisters-in-law. Tagline: *Thoughtfully chosen. Naturally better.* Instagram: [@maatiliving](https://instagram.com/maatiliving).

Brand voice: warm, plain, unhurried. Short sentences. Natural materials, Indian artisans, less waste, things you'll actually use. No hard sell.

## Stack

- **Next.js 14** (App Router), **plain JavaScript** (no TypeScript), React 18
- **framer-motion** for animation (hero slideshow), **lucide-react** for icons
- **next-cloudinary** for images (`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`); falls back to CSS "textile" placeholders when unset or no `publicId`
- **Supabase** (`@supabase/ssr` + `supabase-js`) for auth, roles and the catalogue; schema in `supabase/migrations/`, setup steps in `docs/SETUP.md`
- Plain global CSS in `app/globals.css` — no Tailwind, no CSS modules
- Path alias: `@/*` → project root (`jsconfig.json`)

Commands: `npm run dev`, `npm run build`, `npm start`. No tests or linter config yet.

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
  api/cloudinary/sign  signs admin photo uploads (admin-only)
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
  orders/              OrderSummary (customer-facing order detail, used by token page + account)
  legal/               LegalPage (policy frame + draft notice), V (renders TODO values highlighted), BusinessAddress
scripts/check-launch.mjs  `npm run check:launch`: env, business TODOs, live DB (migrations, admin, products, delivery)
docs/                  SETUP.md (accounts/keys/migrations), DEPLOY.md (GitHub → Vercel → domain → live checklist)
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
  lib/email.js         server-only: optional Resend order emails (no-op without RESEND_API_KEY)
  lib/order-status.js  STATUS_LABELS, ORDER_TABS (admin list + CSV export)
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
- Prices are integers in **paise**; display with `formatPrice`.
- **Payments:** never trust browser prices. `quoteCart` re-reads price/stock; `startCheckout` refuses if anything changed; orders are paid only via `markOrderPaid` (SQL `mark_order_paid`, idempotent, decrements stock once) after a verified Razorpay signature (checkout handler or webhook). `mark_order_paid` is executable by `service_role` only.
- The secret-key client (`src/lib/supabase/admin.js`) is for guest checkout, payment confirmation, order lookups by access token and `claim_guest_orders` only; admin and account screens use the session client so RLS applies.
- **Customer data:** account pages filter by `user_id = user.id` explicitly in addition to RLS (admins' RLS would otherwise see every order). Customers can update only `profiles.full_name`/`phone` (column-level grant) — never `role`. Post-login redirects go through `safeNextPath`.
- Delivery is per state, edited in /admin → Delivery (`settings` row `shipping`: `{ defaultPaise, freeOverPaise, byStatePaise }`). Server components load it with `getShippingSettings()` and pass it to client components; `quoteCart` uses the same settings, so display and charge always agree.
- Refunds: full only, via `refundPayment` (Razorpay API) in `refundOrder`. Restocking goes through SQL `admin_restock_order` (admin-only, once per order via `orders.restocked`).
- CSV export neutralises cells starting with = + - @ (spreadsheet formula injection).
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

Typography (self-hosted via next/font; CSS uses `var(--font-fraunces)` / `var(--font-work-sans)`, never the family names): **Fraunces** (serif, 400/500, real italics) for `h1–h3`, logo, large questions — tight negative letter-spacing, `<em>` italics in madder for emphasis. **Work Sans** (400/500/600) for body at 15px/1.6. Small uppercase labels use `.eyebrow` (10px, .19em tracking, turmeric).

Patterns: `.section` / `.section-grid` (two-column, 10vw padding), `.section-heading`, `.body-copy`, `.button` + `.button-dark` / `.button-light`, `.text-link` (underlined uppercase with `ArrowUpRight`), numbered lists (`01`, `02`…), square corners, no rounded cards, no drop shadows except the floating WhatsApp button. One mobile breakpoint at **700px** (8vw gutters). Respect `prefers-reduced-motion`.

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
- **Phase 6 — Launch** ✅ (code) — policy pages + contact + about (from `business.js`), sitemap/robots, canonical + OG per page, Product/Organization JSON-LD, branded 404/error, self-hosted fonts, security headers, skip link, `check:launch`, docs/DEPLOY.md. Remaining: fill `business.js`, real content, keys, deploy.

Do not add auth, DB or payments ahead of their phase.

## SEO rules

- Metadata is inherited: never put `alternates.canonical` or `openGraph.url` in a layout. Each indexable page sets its own canonical; private pages (`cart`, `checkout`, `account`, `orders`, `admin`) set `robots: { index: false }` and are disallowed in `robots.js`.
- Page titles are just the page name; the root template appends " — Maati Living" (use `title: { absolute }` to opt out).

## Known TODOs

- Real WhatsApp number and contact email (`NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_CONTACT_EMAIL`).
- Supabase project not created yet — follow `docs/SETUP.md`. Until then the storefront uses `src/data/*`, whose image paths 404 on Cloudinary (real photos get uploaded via /admin).
- Story section still uses a textile placeholder; "Meet the women behind Maati" links to `#contact` (needs an About page).
