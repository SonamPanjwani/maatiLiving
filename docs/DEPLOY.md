# Going live

The order to do things in. Allow an afternoon, plus Razorpay KYC time, which can take a few days. Start KYC early.

## 0. Before deploying (local)

1. Everything in [SETUP.md](SETUP.md) is done: migrations 0001–0005, an admin account, and the keys in `.env.local`. You can launch **before Razorpay**: with a UPI ID (SETUP §11) customers pay by UPI and you confirm payments in admin, or with neither, orders arrive on WhatsApp.
2. Fill in **`src/config/business.js`**: legal name, address, grievance officer, policy dates and details, and the founders' names and bios. Read the four policy pages (`/shipping-policy`, `/returns`, `/terms`, `/privacy`). They are sensible drafts, **not legal advice**. Have a CA or lawyer look over them, especially the GST position and the returns rules.
3. Add your real categories and products with photos in `/admin`, and delete the sample ones.
4. Set delivery charges in **/admin → Delivery**.
5. `npm run build` must succeed.

## Rule for every update: migration first, then code

When an update includes a new file in `supabase/migrations/`, **run that SQL in Supabase before deploying (pushing) the code**. New code expects the new tables/columns: if the code goes live first, pages that use them (e.g. admin Inventory before 0007) error until the migration is run. Migrations are written so the *old* code keeps working after them, so "SQL first, then push" is always safe.

## 1. Put the code on GitHub

1. Create a **private** repository on [github.com](https://github.com/new), e.g. `maati-living`.
2. In the project folder:
   ```
   git remote add origin https://github.com/<you>/maati-living.git
   git push -u origin main
   ```
   `.env.local` is git-ignored, so your keys are **not** uploaded.

## 2. Deploy on Vercel

1. Sign in to [vercel.com](https://vercel.com) with GitHub → **Add New → Project** → import the repository. Vercel detects Next.js automatically.
2. Before the first deploy, open **Environment Variables** and add every variable from your `.env.local` (names in `.env.example`). Use the **live** values:
   - `NEXT_PUBLIC_SITE_URL` = `https://<your-domain>` (no trailing slash)
   - Razorpay **live** keys (`rzp_live_…`) once KYC is approved
   - Never prefix a secret with `NEXT_PUBLIC_`
3. **Deploy.** You get a `…vercel.app` address to test on.
4. Region: **Project → Settings → Functions → Region**. Pick **Mumbai (bom1)** to sit next to your Supabase project.

Every `git push` to `main` redeploys automatically.

## 3. Connect your domain

1. Vercel → **Project → Settings → Domains** → add `maatiliving.com` (or yours) and `www.maatiliving.com`.
2. At your domain registrar (GoDaddy, Hostinger, …) add the DNS records Vercel shows: usually an `A` record for the root and a `CNAME` for `www`.
3. Wait for the green tick (minutes to a few hours). HTTPS is automatic.
4. Update `NEXT_PUBLIC_SITE_URL` to the final domain if it changed, then **Redeploy**.

## 4. Point the services at the live site

**Supabase → Authentication → URL Configuration**
- Site URL: `https://<your-domain>`
- Redirect URLs: add `https://<your-domain>/auth/callback` (keep the localhost one for development)
- **Authentication → Emails → SMTP Settings:** custom SMTP turned on (SETUP.md §9.4)

**Razorpay (Live Mode)**, once KYC and bank details are done. Skip this until then.
- **Account & Settings → Webhooks → Add:** URL `https://<your-domain>/api/razorpay/webhook`, events `payment.captured`, `order.paid`, `payment.failed`, secret = your `RAZORPAY_WEBHOOK_SECRET`
- Business website in your Razorpay profile = `https://<your-domain>`. The policy and contact pages are what KYC reviewers look for.

**Resend** (if using order emails): your domain is verified, `EMAIL_FROM` uses it, and `NEXT_PUBLIC_SITE_URL` is the live URL so email links work.

**Cloudinary → Settings → Security:** optionally restrict "Allowed fetch domains" to your domain.

## 5. Run the launch check

With the live values in `.env.local` (or exported in your shell):

```
npm run check:launch
```

It checks keys and their formats, business details, migrations, the admin account, products and photos, and delivery settings. Fix every ✗. The ! lines are warnings to decide on.

## 6. Before you announce

Do these on the live site, on your phone as well as a laptop:

- [ ] Place a **real order** with a small amount using UPI. It appears in /admin → Orders, you get the email, and stock goes down.
- [ ] **Refund it** from /admin and check the money comes back.
- [ ] Sign up as a customer → confirm email → the order shows under My account (same email).
- [ ] Forgot password email arrives, and the link works.
- [ ] Mark an order Shipped with a tracking number → customer email and order page show it.
- [ ] `/sitemap.xml` and `/robots.txt` load. Paste a product link into WhatsApp and check the preview image and title appear.
- [ ] Google Search Console: add the domain and submit `https://<your-domain>/sitemap.xml`.
- [ ] Footer links all work; policy pages show no highlighted "draft" details.

## After launch

- **Backups:** Supabase's free plan doesn't include downloadable backups. Upgrade to Pro when orders start coming in, or export the orders CSV from /admin regularly.
- **Errors:** Vercel → Project → **Logs** shows server errors (e.g. failed payments or emails).
- **Analytics (optional):** Vercel → **Analytics** → Enable. It's privacy-friendly and needs no cookie banner.
