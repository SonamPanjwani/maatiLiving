# Going live: Netlify + Supabase + Cloudinary + Hostinger (free tiers)

Target: **https://www.maatiliving.co.in**. Do the parts in this order. Each step says where to click and what to
paste. Values in `<angle brackets>` are yours to fill in. **Never paste a secret into a chat, an email or GitHub.**
Secrets go only into Netlify, Supabase or your own `.env.production.local`.

| # | Part | Time |
|---|---|---|
| 1 | [Netlify site (first, to see its region)](#1-netlify-site) | 10 min |
| 2 | [Production Supabase project](#2-production-supabase) | 20 min |
| 3 | [Supabase login emails (Hostinger SMTP)](#3-supabase-auth-urls-smtp-and-email-templates) | 15 min |
| 4 | [Netlify environment variables + deploy](#4-netlify-environment-variables-and-deploy) | 15 min |
| 5 | [Your admin account](#5-your-admin-account) | 5 min |
| 6 | [Domain: Hostinger → Netlify](#6-domain-hostinger--netlify) | 10 min + DNS wait |
| 7 | [Email deliverability (SPF / DKIM / DMARC)](#7-email-deliverability-spf--dkim--dmarc) | 10 min |
| 8 | [Keep Supabase awake + weekly backups](#8-keep-supabase-awake-and-weekly-backups) | 10 min |
| 9 | [Go-live checklist](#9-go-live-checklist) | 30 min |
| 10 | [Rollback and restore](#10-rollback-and-restore) | when needed |

**Still needed before announcing:** fill `src/config/business.js` (legal name, address, grievance officer, policy
details). `npm run check:launch` blocks until it's done. Send the details to your developer, or edit the file.

---

## The one rule for every update: migration first, then code

When an update adds a file in `supabase/migrations/`, **run that SQL on the production Supabase project before the
code reaches Netlify** (before pushing to `main`). New code expects the new tables: if the code goes first, the
pages that use them break (this happened once with Inventory). Migrations are written so the *old* code keeps
working after them, so "SQL first, then push" is always safe. Books pages now show "Database update needed — run
migration 00XX" instead of crashing, but don't rely on that.

Before any migration on production: run a backup first (part 8, "Run workflow").

---

## 1. Netlify site

Free plan. Note that Netlify's free plan now counts usage in **credits**, and every production deploy uses some.
Push changes in batches, not one tiny change at a time. You can see usage under **Team → Usage & billing**.

1. Go to [app.netlify.com](https://app.netlify.com) → **Sign up / Log in with GitHub**.
2. **Add new project** → **Import an existing project** → **GitHub** → authorise → pick **SonamPanjwani/maatiLiving**.
3. Settings Netlify shows (they come from `netlify.toml`, just check them):
   - Branch to deploy: `main`
   - Build command: `npm run build`
   - Publish directory: `.next`
4. **Don't add environment variables yet.** Click **Deploy**. This first deploy runs without a database (the shop
   shows sample data). That's fine; it only creates the site and its `…netlify.app` address.
5. Note the site address, e.g. `maati-living-12ab.netlify.app` (**Project configuration → General → Project
   details**). Optionally click **Change project name** → `maatiliving` → `maatiliving.netlify.app`.
6. **Functions region** (this decides how fast admin pages are): **Project configuration → Build & deploy →
   Continuous deployment → Functions region** (or "Functions" in the sidebar). Note the region it shows, e.g.
   *US East (Ohio)* `us-east-2`. If your plan lets you change it, choose **Asia Pacific (Mumbai)** `ap-south-1`.

   Every admin page and every order talks to Supabase several times. Putting both in the **same region** makes
   each of those trips about 2 ms instead of about 250 ms. You'll pick Supabase's region to match in part 2.

> **Repository is public.** No secret is in the code (proved by `npm run check:secrets`), but customers' data
> must never be committed either, and the weekly backups are encrypted for this reason. Consider making it
> private: GitHub → the repo → **Settings → General → Danger zone → Change visibility → Private**. Netlify's
> free plan works with private repos.

---

## 2. Production Supabase

A **new, separate** project, so test vendors, POs, ML1001–ML1004 and EXP-100x never go live. The free plan allows
2 projects: keep the current one as **dev**.

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
   - Organization: yours. Name: `maati-living-prod`.
   - Database password: **Generate a password** → save it in your password manager (needed for backups, part 8).
   - Region: **the same as Netlify's Functions region** from 1.6 (*East US (Ohio)* for `us-east-2`, *South Asia
     (Mumbai)* for `ap-south-1`).
   - Plan: Free → **Create new project**. Wait about 2 minutes.
2. Create every table in one go: **SQL Editor → New query** → open `supabase/production/all-in-one.sql` in VS Code
   → **Ctrl+A, Ctrl+C** → paste → **Run**. It should end with "Success. No rows returned".
   - This is migrations 0001–0011 in order plus the **"Mark as production"** line. It has **no** sample products
     and **no** demo data. The demo seed refuses to run on this database.
   - Do **not** run `supabase/seed.sql` or anything in `supabase/demo/` here.
3. Check it worked: **Table Editor** shows `products`, `orders`, `vendors`, `purchases`, `vendor_payments`,
   `expenses` and so on. In SQL Editor, `select value from settings where key = 'environment';` returns
   `"production"`.
4. Keys for part 4: **Project Settings → API Keys** (and **Data API** for the URL):
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret keys → Create new secret key** (name it `netlify`) → **Reveal** → `SUPABASE_SECRET_KEY`.
     Server-only: never in anything starting with `NEXT_PUBLIC_`.
5. **Auth signing keys:** **Project Settings → JWT Keys**. New projects use asymmetric (ECC P-256) keys. Leave it
   that way: the site checks logins locally with them, which keeps admin pages fast.

**Free-plan pause:** a free project pauses after **7 days with no activity**, and the site then can't load
products or take orders until you press **Restore** in the dashboard (takes a few minutes; nothing is lost).
Part 8 adds a tiny automatic read every 3 days so it never pauses. A shop with daily visitors won't pause anyway.

---

## 3. Supabase auth: URLs, SMTP and email templates

In the **production** project:

**URL configuration**: **Authentication → URL Configuration**
- Site URL: `https://www.maatiliving.co.in`
- Redirect URLs → **Add URL**, one at a time:
  - `https://www.maatiliving.co.in/**`
  - `https://maatiliving.co.in/**`
  - `https://<your-site>.netlify.app/**` (for testing before the domain works)

  These cover the sign-up confirmation and password-reset links (`/auth/confirm`) and the older `/auth/callback`.

**Sign-up settings**: **Authentication → Sign In / Providers → Email**: **Enable email provider** on,
**Confirm email** on. "Allow new users to sign up" on.

**SMTP** (so login emails come from your mailbox and aren't capped by Supabase's built-in limit of a few per
hour): **Authentication → Emails → SMTP Settings → Enable custom SMTP**
- Sender email: `contact@maatiliving.co.in`
- Sender name: `Maati Living`
- Host: `smtp.hostinger.com`
- Port: `465`
- Username: `contact@maatiliving.co.in`
- Password: the mailbox password (Hostinger **hPanel → Emails → contact@maatiliving.co.in → … → Change password**
  if you don't know it)
- Minimum interval between emails: leave as is → **Save**.

Then **Authentication → Rate Limits → "Rate limit for sending emails"**: set **30** per hour → Save (only
possible with custom SMTP).

**Branded templates**: **Authentication → Emails → Templates**. For each one, set the subject, switch the body to
**Source**, delete what's there and paste the whole file (everything after the comment block):

| Template | Subject | File |
|---|---|---|
| Confirm signup | `Confirm your Maati Living account` | `docs/email-templates/confirm-signup.html` |
| Reset password | `Reset your Maati Living password` | `docs/email-templates/reset-password.html` |
| Change email address | `Confirm your new email for Maati Living` | `docs/email-templates/change-email.html` |

Save each. These links go to `/auth/confirm`, which works even when the email is opened on a different phone than
the one the form was filled in on.

---

## 4. Netlify environment variables and deploy

**Netlify → your project → Project configuration → Environment variables → Add a variable → Add a single
variable.** For each one: Key, Value, scopes **All scopes**, same value for all deploy contexts. Tick
**"Contains secret values"** for the ones marked 🔒.

| Key | Value / where to get it |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://www.maatiliving.co.in` (no trailing slash) |
| `NEXT_PUBLIC_SUPABASE_URL` | production Project URL (2.4) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | production publishable key (2.4) |
| 🔒 `SUPABASE_SECRET_KEY` | production secret key (2.4) |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary **Console → Settings → API Keys**: Cloud name (same account as now) |
| `NEXT_PUBLIC_CLOUDINARY_API_KEY` | same page: API Key |
| 🔒 `CLOUDINARY_API_SECRET` | same page: API Secret (click the eye) |
| `NEXT_PUBLIC_UPI_ID` | your business UPI ID, e.g. `maatiliving@ybl` |
| `NEXT_PUBLIC_UPI_PAYEE_NAME` | `Maati Living` (or the bank account holder's name) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | `91` + 10-digit mobile, e.g. `919876543210` |
| `NEXT_PUBLIC_CONTACT_EMAIL` | `contact@maatiliving.co.in` |
| `NEXT_PUBLIC_INSTAGRAM_URL` | `https://instagram.com/maatiliving` |
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `contact@maatiliving.co.in` |
| 🔒 `SMTP_PASS` | the mailbox password |
| `MAIL_FROM` | `Maati Living <contact@maatiliving.co.in>` |
| `ORDER_NOTIFY_EMAIL` | the inbox that should get new-order alerts (can be `contact@maatiliving.co.in`) |

Later, after Razorpay KYC: `NEXT_PUBLIC_RAZORPAY_KEY_ID` (`rzp_live_…`), 🔒 `RAZORPAY_KEY_SECRET`,
🔒 `RAZORPAY_WEBHOOK_SECRET`. Webhook URL: `https://www.maatiliving.co.in/api/razorpay/webhook` (events
`payment.captured`, `order.paid`, `payment.failed`).

**Deploy with the variables:** **Deploys → Trigger deploy → Clear cache and deploy site.** Variables only take
effect on a new deploy. Wait until it says **Published** (3–5 min).

**Check before the domain:** open `https://<your-site>.netlify.app`: the shop loads (empty: no products yet),
`/admin/login` loads.

**Cloudinary on the free plan:** product photos use public delivery, and bill photos, receipts and payment proofs
are **private** (folder `maati-living/bills`, upload type `authenticated`, enforced by the site). Original PDFs open
through Cloudinary's signed download API, so you **don't** need "Allow delivery of PDF and ZIP files".

**What runs where on Netlify (free):** pages, server actions (every save button) and `/api/*` routes run as Netlify
Functions (10-second limit, plenty: a save takes about 1–2 s). Middleware (the login gate for `/admin`, `/account`,
`/checkout`) runs as an Edge Function. `/api/books/bill` only redirects to a short-lived Cloudinary link, so file
size doesn't matter. The CA export ZIP for a month is small (kilobytes), well under the response limit.

**Optional pre-flight on your computer** (proves the production values are complete and no secret is in the
browser bundle): create `.env.production.local` in the project folder (it's git-ignored) with the same
variables as the table, then tell your developer. They'll run:
```
npm run check:launch -- --env .env.production.local
NEXT_DIST_DIR=.next-prod npm run build && npm run check:secrets -- --env .env.production.local --dir .next-prod
```

---

## 5. Your admin account

The admin password used in testing was shared, so production gets a **new** admin with a **new** password.

1. Supabase (production) → **Authentication → Users → Add user → Create new user**.
   - Email: your email. Password: a new, long one (save it in your password manager). Tick **Auto Confirm User** →
     **Create user**.
2. **SQL Editor → New query** → paste, with your email → **Run**:
   ```sql
   update public.profiles set role = 'admin' where email = '<your-email>';
   select email, role from public.profiles where role = 'admin';
   ```
   The second line should list exactly your email.
3. Sign in at `https://<your-site>.netlify.app/admin/login`.
4. Also change the **dev** project's admin password (it was shared): dev Supabase → **Authentication → Users** →
   your user → **…** → **Send password recovery**, or set a new one there.

Roles can only be changed with SQL like this; there's deliberately no button for it.

---

## 6. Domain: Hostinger → Netlify

**In Netlify:** **Domain management → Add a domain** → `www.maatiliving.co.in` → **Verify** → **Add domain**
(choose **external DNS**, not Netlify DNS, so your Hostinger email keeps working). Netlify also adds
`maatiliving.co.in` and sets **www as primary**: the bare domain redirects to www. Netlify then shows the DNS
records it wants. Use those exact values if they differ from below.

**In Hostinger:** **hPanel → Domains → maatiliving.co.in → DNS / Nameservers → DNS records.**

1. **Delete** only these if they exist (they point at Hostinger's parking page):
   - type **A**, name **@**, any value
   - type **AAAA**, name **@**
   - type **CNAME** (or A), name **www**
2. **Add**:

   | Type | Name | Points to / Target | TTL |
   |---|---|---|---|
   | A | `@` | `75.2.60.5` | 3600 |
   | CNAME | `www` | `<your-site>.netlify.app` | 3600 |

3. **Don't touch** anything else: MX records (`mx1.hostinger.com`, `mx2.hostinger.com`), TXT records (SPF, DKIM,
   DMARC) and CNAMEs like `autodiscover` / `autoconfig` / `hostingermail…` keep your mailbox working.

**HTTPS:** back in Netlify → **Domain management → HTTPS → Verify DNS configuration**. Once DNS is visible,
Netlify issues a free Let's Encrypt certificate automatically (usually within an hour; DNS itself can take up to
24 hours, rarely 48).

**How to check:**
- [dnschecker.org](https://dnschecker.org) → `www.maatiliving.co.in`, type CNAME → shows your `…netlify.app`;
  `maatiliving.co.in`, type A → `75.2.60.5`.
- Open `https://www.maatiliving.co.in`: padlock, the shop. `https://maatiliving.co.in` → redirects to www.
- Netlify **HTTPS** section says the certificate is active.

---

## 7. Email deliverability (SPF / DKIM / DMARC)

So order and login emails land in the inbox, not spam. All in **Hostinger hPanel → Emails →
maatiliving.co.in**. Hostinger usually adds these itself when email and DNS are both at Hostinger. Check they
exist under **Domains → DNS records**, and add any that are missing.

| Record | Type | Name | Value |
|---|---|---|---|
| SPF | TXT | `@` | `v=spf1 include:_spf.mail.hostinger.com ~all` |
| DKIM | CNAME (or TXT) | as shown by Hostinger, e.g. `hostingermail-a._domainkey` (and `-b`, `-c`) | as shown by Hostinger |
| DMARC | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:contact@maatiliving.co.in` |

- **SPF:** only **one** SPF record per domain. If one exists, make sure it includes `include:_spf.mail.hostinger.com`.
  Don't add a second.
- **DKIM:** the exact names and values are unique to your mailbox. Copy them from **hPanel → Emails → your domain →
  "DNS records" / "Email authentication" / "Connect domain"** (wording varies). If the panel shows DKIM as
  "Active / Verified", you're done.
- **DMARC:** start with `p=none` (reports only). After a few weeks of clean sending, change to `p=quarantine`.
- **Test:** **/admin → Delivery → Order emails → Send test email** to a Gmail address. In Gmail: **⋮ → Show
  original**. SPF, DKIM and DMARC should all say **PASS**.

---

## 8. Keep Supabase awake and weekly backups

Both run free on GitHub Actions (`.github/workflows/`).

**GitHub → the repository → Settings → Secrets and variables → Actions → New repository secret:**

| Name | Value |
|---|---|
| `SUPABASE_URL` | production Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | production publishable key |
| `SUPABASE_DB_URL` | production **Connect** (top bar) → **Session pooler** → URI, with `[YOUR-PASSWORD]` replaced by the database password from 2.1 (use the *Session pooler*: GitHub can't reach the direct connection) |
| `BACKUP_PASSPHRASE` | a long passphrase (20+ characters) you save in your password manager. Without it a backup can't be opened, by anyone, including you |

Then **Actions** tab → enable workflows if asked →
- **Supabase keep-alive** → **Run workflow** → should go green. It then runs by itself every 3 days.
- **Supabase weekly backup** → **Run workflow** → green → the run page has an artifact `maati-db-…` (an encrypted
  file). It then runs every Monday 03:00 IST and keeps each backup 30 days.

GitHub emails you if either fails. Run the backup by hand before any production migration.

---

## 9. Go-live checklist

On **https://www.maatiliving.co.in**, on a phone and a computer:

- [ ] `https://www.maatiliving.co.in/sitemap.xml` and `/robots.txt` show `https://www.maatiliving.co.in/…`
      addresses; a product page's source (`view-source:`) has `<link rel="canonical" href="https://www.maatiliving.co.in/…">`.
- [ ] Customer: **sign up** with a real email → confirmation email arrives (from contact@maatiliving.co.in, branded)
      → link signs you in. **Sign out → log in. Forgot password** → email → set a new password.
- [ ] Admin: log in at `/admin/login` with the **new** production admin (part 5).
- [ ] Add your real categories and products with photos (**/admin → Products**). Set **Delivery** charges.
      Add your vendors and opening stock.
- [ ] Place a **₹1 real UPI order**: make a temporary ₹1 product (or set one to ₹1, no delivery charge), buy it,
      pay by UPI, enter the UTR → **/admin → Orders → UPI to verify** → check your bank app → **Confirm** →
      payment-confirmed email arrives. Then mark shipped (with tracking) → shipped email. Put the price back and hide
      the test product.
- [ ] Admin pages are blocked for a customer: signed in as the customer, open `/admin` → sent to the admin login
      with "doesn't have admin access".
- [ ] Books: create a purchase, upload a bill photo **and** a PDF → both open; **Original PDF** opens.
- [ ] **/admin → Delivery → Send test email** arrives in the inbox (not spam); Gmail "Show original" = PASS ×3.
- [ ] Phone at 390 px: home, shop (category chips, WhatsApp button), product, cart, checkout, account, admin menu.
- [ ] `npm run check:launch -- --env .env.production.local` has no ✗ (needs business.js filled in).
- [ ] Change the dev admin password (5.4) and delete `.env.production.local` from your computer if you made one.

---

## 10. Rollback and restore

**The site (code):** Netlify → **Deploys** → click an earlier deploy that says **Published** → **Publish deploy**.
The old version is live within seconds. Later pushes to `main` deploy again as normal. To stop auto-deploys while
fixing something: **Deploys → Stop auto publishing**.

**A migration went wrong:** migrations only add things, so the usual fix is a small follow-up SQL, not a restore.
Stop and ask your developer before running anything else.

**Restore from a backup** (database lost or badly damaged). Do it with your developer; outline:
1. Download the latest `maati-db-…` artifact from GitHub Actions → unzip → `maati-backup.tar.gz.gpg`.
2. Decrypt: `gpg -d maati-backup.tar.gz.gpg | tar -xz`. It asks for `BACKUP_PASSPHRASE` and gives
   `backup/public.sql` and `backup/auth-users.sql`.
3. New Supabase project (same region). Get its **Session pooler** URI.
4. Logins first, with triggers off so profiles aren't created twice:
   `psql "<uri>" -c "set session_replication_role = replica;" -f backup/auth-users.sql`
5. Then the shop: `psql "<uri>" -f backup/public.sql`
6. Point Netlify's three Supabase variables at the new project → **Clear cache and deploy**. Redo part 3
   (auth URLs, SMTP, templates) on the new project.

Free plan reality: Supabase keeps no downloadable backups on the free plan, so the weekly GitHub backup **is** your
backup. When the shop earns, Supabase Pro (daily backups + point-in-time restore) is the first upgrade worth paying
for.
