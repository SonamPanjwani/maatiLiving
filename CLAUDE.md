# Maati Living

Premium e-commerce site for **Maati Living**, a small Indian brand selling handcrafted home products: **terracotta diyas** and **coconut shell products** (planters, dhoop stands, agarbatti stands, pen stands). Founded by two sisters-in-law. Tagline: *Thoughtfully chosen. Naturally better.* Instagram: [@maatiliving](https://instagram.com/maatiliving).

Brand voice: warm, plain, unhurried. Short sentences. Natural materials, Indian artisans, less waste, things you'll actually use. No hard sell.

## Stack

- **Next.js 14** (App Router), **plain JavaScript** (no TypeScript), React 18
- **framer-motion** for animation (hero slideshow), **lucide-react** for icons
- **next-cloudinary** for images (`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`); falls back to CSS "textile" placeholders when unset or no `publicId`
- Plain global CSS in `app/globals.css` — no Tailwind, no CSS modules
- Path alias: `@/*` → project root (`jsconfig.json`)

Commands: `npm run dev`, `npm run build`, `npm start`. No tests or linter config yet.

## Layout

```
app/
  layout.js            root layout + metadata
  page.js              home page — server component composing sections
  globals.css          entire design system
components/
  home/                one file per home-page section (Navbar, Hero, Intro, Collection,
                       ProductCard, Why, Beliefs, Story, Approach, FinalCta, Footer)
  common/              shared pieces: CloudImage (client wrapper for CldImage),
                       TextilePlaceholder, WhatsAppLink, FloatingWhatsApp
src/
  config/site.js       brand + contact config (env-driven), getWhatsAppUrl()
  config/cloudinary.js Cloudinary config, isCloudinaryConfigured
  data/categories.js   placeholder categories (until Phase 2 DB)
  data/products.js     placeholder catalogue (until Phase 2 DB)
  data/hero.js         hero slides (Cloudinary publicIds)
  lib/catalog.js       async getters for categories/products — the only way pages read the catalogue
  lib/format.js        formatPrice (paise → "₹450")
```

## Conventions

- **Server components by default.** Add `"use client"` only for state/effects/handlers/framer-motion. Currently client: `Navbar`, `Hero`, `CloudImage`.
- `CldImage` has no `"use client"` directive — always import `@/components/common/CloudImage` from server components.
- Contact details come from env via `siteConfig` (see `.env.example`); never hard-code them in components.
- Read catalogue data only through `src/lib/catalog.js` (async). Never import `src/data/*` from components — in Phase 2 the getters switch to Supabase.
- Prices are integers in **paise**; display with `formatPrice`.
- Secrets/env: `.env.local` (git-ignored). Document every new var in `.env.example`.

## Catalogue data model

- **Category:** `slug, name, description, parentSlug (optional, for nesting), image {publicId, alt}, sortOrder`
- **Product:** `id, slug, name, categorySlug, price (paise), stock, shortDescription, sourcingNote, images[{publicId, alt}], materials[], artisan, region, care, available, featured, sku`
  - `images` holds any number of photos; `images[0]` is the cover. Cloudinary path: `maati-living/products/<slug>/<nn>`.
  - `featured` products appear in "The Maati Edit" on the home page.

Planned Supabase tables (Phase 2): `categories (id, slug, name, description, parent_id, image_public_id, sort_order)`, `products (id, slug, name, category_id, price_paise, stock, …, is_available, is_featured, sku)`, `product_images (id, product_id, public_id, alt, sort_order)`. The getters in `src/lib/catalog.js` must keep returning the shape above.

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
- **Phase 1 — Supabase auth + RBAC** — Supabase Auth, `profiles` table with `role` (`admin` | `customer`), middleware route protection, admin vs customer access.
- **Phase 2 — Shop + product pages** — `/shop`, `/shop/[category]`, `/products/[slug]` with a multi-image gallery; categories + products + product_images move from `src/data` to Supabase. Until 2b ships, products are entered via the Supabase Table Editor / CSV import.
- **Phase 2b — Admin: product management** — admin-only `/admin/products` and `/admin/categories`: add/edit/hide products, multi-image upload to Cloudinary (`CldUploadWidget`) with reorder + choose cover, price, stock, featured flag.
- **Phase 3 — Cart + Razorpay checkout** — cart, address, Razorpay payment, order records, confirmation emails.
- **Phase 4 — Customer account** — order history, addresses, profile.
- **Phase 5 — Admin panel (rest)** — orders, inventory adjustments, customers, dashboard.
- **Phase 6 — Launch** — SEO/metadata, sitemap, analytics, legal pages (privacy, terms, shipping/returns), performance and accessibility pass, deploy.

Do not add auth, DB or payments ahead of their phase.

## Known TODOs

- Real WhatsApp number and contact email (`NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_CONTACT_EMAIL`).
- Product photos are not yet uploaded to Cloudinary — paths `maati-living/products/<slug>/<nn>` currently 404 when Cloudinary is configured.
- Story section still uses a textile placeholder; "Meet the women behind Maati" links to `#contact` (needs an About page).
