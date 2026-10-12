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
  layout.js            root layout + metadata
  page.js              home page — server component composing sections (revalidate 60s)
  globals.css          entire design system (section 16 = admin)
  admin/               /admin — login/, (panel)/ products + categories, actions.js (server actions)
  api/cloudinary/sign  signs admin photo uploads (admin-only)
middleware.js          /admin only: refresh session, redirect signed-out users to /admin/login
components/
  home/                one file per home-page section (Navbar, Hero, Intro, Collection,
                       ProductCard, Why, Beliefs, Story, Approach, FinalCta, Footer)
  common/              shared pieces: CloudImage (client wrapper for CldImage),
                       TextilePlaceholder, WhatsAppLink, FloatingWhatsApp
  admin/               AdminBar, LoginForm, ProductForm, CategoryForm, ImageManager (multi-photo
                       upload/reorder/cover), SubmitButton, ConfirmSubmit, SetupNotice
supabase/
  migrations/          SQL schema + RLS policies (run in Supabase SQL editor)
  seed.sql             starter categories/products
src/
  config/site.js       brand + contact config (env-driven), getWhatsAppUrl()
  config/cloudinary.js Cloudinary config, isCloudinaryConfigured
  data/categories.js   fallback categories, used when Supabase isn't configured
  data/products.js     fallback catalogue, used when Supabase isn't configured
  data/hero.js         hero slides (Cloudinary publicIds)
  lib/catalog.js       async storefront getters (Supabase or fallback) + row→shape mappers
  lib/admin-catalog.js admin reads through the user session (includes hidden products)
  lib/auth.js          getCurrentUser / getCurrentAdmin / requireAdminPage / assertAdmin
  lib/supabase/        config, server (cookie) client, public (cookie-free) client, middleware helper
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

Typography: **Fraunces** (serif, 400/500) for `h1–h3`, logo, large questions — tight negative letter-spacing, `<em>` italics in madder for emphasis. **Work Sans** (400/500/600) for body at 15px/1.6. Small uppercase labels use `.eyebrow` (10px, .19em tracking, turmeric).

Patterns: `.section` / `.section-grid` (two-column, 10vw padding), `.section-heading`, `.body-copy`, `.button` + `.button-dark` / `.button-light`, `.text-link` (underlined uppercase with `ArrowUpRight`), numbered lists (`01`, `02`…), square corners, no rounded cards, no drop shadows except the floating WhatsApp button. One mobile breakpoint at **700px** (8vw gutters). Respect `prefers-reduced-motion`.

## Rule: keep the existing visual style

**Every new page must look like it belongs to the current home page.** Use the tokens, fonts and classes above; reuse components in `components/common/`; extend `globals.css` in its existing sections rather than inventing a parallel style. Run the `maati-style-reviewer` agent (`.claude/agents/`) after building new UI.

## Roadmap

- **Phase 0 — Foundation** ✅ git, CLAUDE.md, componentised home page, readable CSS, env-driven config, real product data.
- **Phase 1 — Supabase auth + RBAC** ✅ (code) — email/password login at `/admin/login`, `profiles.role` (`admin` | `customer`), RLS, middleware. Single admin (the owner); public sign-up off until Phase 4.
- **Phase 2b — Admin: product management** ✅ (code) — `/admin/products`, `/admin/categories`: add/edit/hide/delete, sub-categories, multi-photo upload with reorder + cover + alt text, price, stock, featured.
- **Phase 2 — Shop + product pages** — `/shop`, `/shop/[category]`, `/products/[slug]` with a multi-image gallery, reading via `src/lib/catalog.js`.
- **Phase 3 — Cart + Razorpay checkout** — cart, address, Razorpay payment, order records, confirmation emails.
- **Phase 4 — Customer account** — order history, addresses, profile.
- **Phase 5 — Admin panel (rest)** — orders, inventory adjustments, customers, dashboard.
- **Phase 6 — Launch** — SEO/metadata, sitemap, analytics, legal pages (privacy, terms, shipping/returns), performance and accessibility pass, deploy.

Do not add auth, DB or payments ahead of their phase.

## Known TODOs

- Real WhatsApp number and contact email (`NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_CONTACT_EMAIL`).
- Supabase project not created yet — follow `docs/SETUP.md`. Until then the storefront uses `src/data/*`, whose image paths 404 on Cloudinary (real photos get uploaded via /admin).
- Story section still uses a textile placeholder; "Meet the women behind Maati" links to `#contact` (needs an About page).
