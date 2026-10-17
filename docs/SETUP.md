# Setting up the Maati Living admin

About 15 minutes, one time. You'll end up able to sign in at `/admin` and add products with photos.

## 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) (free plan is fine) → **New project**.
   - Name: `maati-living` · Region: **Mumbai (ap-south-1)** · set a database password and save it somewhere safe.
2. Wait for it to finish provisioning (~2 min).

## 2. Create the database tables

1. In the project, open **SQL Editor** → **New query**.
2. Paste the whole of `supabase/migrations/0001_auth_and_catalogue.sql` → **Run**. It should say "Success. No rows returned".
3. Optional starter data: new query, paste `supabase/seed.sql` → **Run**. This adds the Diyas and Coconut shell categories and 3 products (without photos).

## 3. Turn off public sign-ups (for now)

Only you need an account until customer accounts arrive in Phase 4.

**Authentication → Sign In / Providers** → turn **off** "Allow new users to sign up". Keep the **Email** provider enabled.

## 4. Create your admin account

1. **Authentication → Users → Add user → Create new user**.
   - Email: your email · Password: a strong one · tick **Auto Confirm User**.
2. **SQL Editor → New query**, run (with your email). It also works if the user was created before step 2:

   ```sql
   insert into public.profiles (id, email, role)
   select id, email, 'admin' from auth.users
   where lower(email) = lower('you@example.com')
   on conflict (id) do update set role = 'admin'
   returning email, role;
   ```

   You should see one row: your email and `admin`. No rows means the email doesn't match a user. Copy it exactly from **Authentication → Users**. This is the only way to make someone an admin.

   To check at any time:

   ```sql
   select u.email, p.role from auth.users u left join public.profiles p on p.id = u.id;
   ```

## 5. Get the keys

**Supabase:**
- **Project URL**: the **Connect** button at the top of the dashboard, or ⚙️ **Project Settings → Data API**. Looks like `https://abcdxyz.supabase.co`.
- **Public key**: ⚙️ **Project Settings → API Keys**. Copy the **Publishable key** (`sb_publishable_…`), or the legacy **anon / public** key (`eyJ…`) under "Legacy API keys". Either works in `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Never copy the **secret** (`sb_secret_…`) or **service_role** key. The site doesn't need them.

**Cloudinary** (for photo uploads): [console.cloudinary.com](https://console.cloudinary.com) → **Settings → API Keys**. Copy the **API Key** and **API Secret**. Your cloud name is already set.

## 6. Add them to `.env.local`

Open `.env.local` in the project root (never commit or share it) and add:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxx
```

The **service_role** key and the **Cloudinary API secret** are powerful. Don't paste them into chats, screenshots or code. Only `.env.local` (and later your hosting provider's environment settings).

## 7. Try it

```
npm run dev
```

Open http://localhost:3000/admin and sign in.

- **Categories** → add your categories. Use "Inside category" for sub-categories (e.g. Planters inside Coconut shell).
- **Products → Add product** → upload several photos at once, reorder them with the arrows, ★ makes a photo the cover, describe each photo (helps SEO and screen readers), fill in price (₹), stock and details → **Add product**.
- Tick **Featured on home page** for the products you want in "The Maati Edit".
- Untick **Visible in shop** to hide a product without deleting it.

Changes show on the home page immediately after saving.

## 8. Turn on cart and payments (Phase 3)

### 8.1 Orders tables
**SQL Editor → New query**: paste all of `supabase/migrations/0002_orders.sql` → **Run**.

### 8.2 Supabase secret key
Guest checkout saves orders with a server-only key.

⚙️ **Project Settings → API Keys** → **Secret keys** → copy the `sb_secret_…` key (create one if none exists). Add to `.env.local`:

```
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxx
```

This key can read and change everything. Keep it only in `.env.local` (and later your hosting settings). Never put `NEXT_PUBLIC_` in front of it.

### 8.3 Razorpay test keys
1. Sign up at [razorpay.com](https://razorpay.com). You can start KYC in parallel.
2. Switch the dashboard to **Test Mode** (toggle at the top) → **Account & Settings → API Keys → Generate Key**.
3. Add both to `.env.local`:

   ```
   NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxx
   ```
4. Restart `npm run dev`. Add something to the cart → **Checkout** → **Pay securely**. In test mode:
   - **UPI:** use `success@razorpay` to succeed or `failure@razorpay` to fail.
   - **Card:** use a test card from Razorpay's docs ("Test card details").
   
   No real money moves.
5. After paying, you land on the order confirmation page, and the order appears in **/admin → Orders → To ship**.

### 8.4 Webhook (when the site is online)
The webhook makes sure an order is marked paid even if the customer closes the tab right after paying. It needs a public URL, so set it up once the site is deployed (Phase 6).

**Razorpay → Account & Settings → Webhooks → Add new webhook**:
- URL: `https://<your-domain>/api/razorpay/webhook`
- Secret: make up a long random string and put the same one in `.env.local` as `RAZORPAY_WEBHOOK_SECRET`
- Events: `payment.captured`, `order.paid`, `payment.failed`

### 8.5 Order emails (optional)
Without this, orders still work and show in /admin. With it, the customer gets a confirmation and you get a new-order alert.
1. Sign up at [resend.com](https://resend.com) → add and verify your domain → create an API key.
2. Add to `.env.local`:

   ```
   RESEND_API_KEY=re_xxxxxxxx
   EMAIL_FROM=Maati Living <orders@yourdomain.com>
   ORDER_NOTIFY_EMAIL=you@example.com
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

### 8.6 Going live (after KYC)
In the Razorpay dashboard switch to **Live Mode** → generate live keys → replace the two test keys (they start with `rzp_live_`). Set up the webhook again in Live Mode, since test and live webhooks are separate. The "Test mode" note on checkout disappears automatically.

### Delivery charges
Delivery is charged by the customer's state. Set the real rates in `src/config/shop.js` (`shippingByStatePaise`, amounts in paise). Until then, every state uses the placeholder ₹99, with free delivery from ₹999.

## 9. Customer accounts (Phase 4)

### 9.1 Accounts tables
**SQL Editor → New query**: paste all of `supabase/migrations/0003_customer_accounts.sql` → **Run**.

### 9.2 Allow sign-ups again
You turned sign-ups off in step 3. Customers need them now:

**Authentication → Sign In / Providers** → turn **on** "Allow new users to sign up", and keep **"Confirm email"** on.

Admins are still made only by the SQL in step 4, so a new sign-up is always a customer.

### 9.3 Redirect URLs
Confirmation and password-reset emails link back to the site. Supabase only allows addresses you list.

**Authentication → URL Configuration**:
- **Site URL:** `http://localhost:3000` for now (change to your real domain at launch)
- **Redirect URLs:** add `http://localhost:3000/auth/callback`, and later `https://<your-domain>/auth/callback`

### 9.4 Email sending (before launch)
Supabase's built-in email sender only allows a few emails per hour and is meant for testing. Before launch, use your own sender:

**Authentication → Emails → SMTP Settings** → enable custom SMTP. Resend works here too: host `smtp.resend.com`, port `465`, user `resend`, password = your Resend API key. You can also edit the email templates there to match the Maati voice.

### 9.5 Try it
`/account/signup` → create an account → open the link in your email → you land in **My account**. Orders you placed as a guest with the same email appear automatically.

## Troubleshooting

| Problem | Fix |
|---|---|
| `/admin` still says "Connect Supabase" | Keys missing or dev server not restarted after editing `.env.local`. |
| "This account doesn't have admin access" | Step 4.2 not run, or the email in the SQL doesn't match exactly. |
| Upload button missing / "Photo uploads need…" | `NEXT_PUBLIC_CLOUDINARY_API_KEY` or `CLOUDINARY_API_SECRET` missing; restart dev server. |
| Upload widget says "Invalid signature" | API secret is wrong or belongs to a different Cloudinary account than the cloud name. |
| Checkout says "Online payment isn't switched on yet" | One of `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` is missing; restart dev server. |
| "We couldn't start the payment" | Razorpay key/secret mismatch (test key with live secret, or a typo), or 0002 SQL not run. The terminal running `npm run dev` shows the exact error. |
| Paid but order shows "Confirming payment" | The browser closed before confirming. The webhook (8.4) fixes this automatically once it's set up. |
