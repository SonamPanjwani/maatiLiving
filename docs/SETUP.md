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
Delivery is charged by the customer's state. Set it in **/admin → Delivery** after running step 10.1.

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

## 10. Admin operations (Phase 5)

### 10.1 Tables
**SQL Editor → New query**: paste all of `supabase/migrations/0004_admin_operations.sql` → **Run**.

The migrations must run **in order**: 0001 → 0002 → 0003 → 0004. Each builds on the one before.

### 10.2 What's in /admin now
- **Dashboard:** revenue today / 7 days / 30 days, orders waiting to ship, low stock, recent orders, best sellers, and a daily revenue chart (hover a column, or "Show as table").
- **Orders:** search by order number, name, email or phone; filter by dates; **Export CSV** (opens in Excel). On an order:
  - **Shipped:** add the courier and tracking number. If emails are set up, the customer is told automatically, and the tracking shows on their order page.
  - **Cancelled:** tick "return items to stock".
  - **Refund full amount:** refunds through Razorpay, needs the Razorpay keys. Use the Razorpay dashboard for partial refunds.
- **Inventory:** every product's stock on one page; change a number and press Save.
- **Customers:** everyone who has paid, guests included, with orders and total spent.
- **Delivery:** standard delivery charge, a free-delivery threshold, and a charge for any state that differs. Leave a state blank to use the standard charge.

## 11. Taking payments before Razorpay is ready

Checkout picks how to take payment automatically, from what's in `.env.local`:

| You have set up | Checkout does |
|---|---|
| Razorpay keys + `SUPABASE_SECRET_KEY` | **Pay securely** with Razorpay: cards, UPI (PhonePe/GPay/Paytm), netbanking. Fully automatic. |
| `NEXT_PUBLIC_UPI_ID` + `SUPABASE_SECRET_KEY` (no Razorpay) | **Place order & pay by UPI**: the order is saved, the customer sees your UPI ID, QR code and a "Pay with UPI app" button, pays, and enters the transaction ID. You confirm it in admin. |
| Neither | **Send order on WhatsApp**: the whole order (items, total, address) opens in WhatsApp, ready to send to you. |

### 11.1 Direct UPI setup
1. Run `supabase/migrations/0005_manual_upi.sql` in the SQL Editor (after 0004).
2. Find your UPI ID in PhonePe / Google Pay / Paytm / your bank app (looks like `name@ybl`, `name@okhdfcbank`). A **business** UPI ID (PhonePe Business, Paytm for Business, Google Pay for Business) is best: it's free, made for receiving customer payments, and shows your shop name.
3. Add to `.env.local`, then restart:
   ```
   NEXT_PUBLIC_UPI_ID=yourname@ybl
   NEXT_PUBLIC_UPI_PAYEE_NAME=Maati Living
   ```
   (`SUPABASE_SECRET_KEY` must be set too, see 8.2.)

### 11.2 Every day: confirming UPI payments
- The dashboard shows "N UPI payments to check" when customers have entered a transaction ID.
- **/admin → Orders → UPI to verify** → open the order → check in your bank/UPI app that the **exact amount** arrived with that transaction ID → **Confirm payment received**. The order moves to *To ship*, stock goes down, and the customer gets the confirmation email (if emails are on).
- **Never confirm before you see the money.** A transaction ID typed by a customer is not proof of payment.
- If a payment never arrives, open the order → **Cancel order**. Stock is untouched, because it only goes down when you confirm.
- Refunds for UPI orders: send the money back from your UPI app or bank, then set the order to Cancelled (and tick "return items to stock").

When Razorpay is approved, add its keys. Checkout switches to Razorpay on its own, and existing UPI orders stay in admin as they are.

## 12. Saved carts (signed-in customers)

**SQL Editor → New query**: paste all of `supabase/migrations/0006_carts.sql` → **Run** (after 0005).

Signed-in customers' carts are then saved to their account: the same cart on phone and laptop, and nobody else on the same browser sees it. Guests keep a cart in their browser; when they sign in, it's merged into their account's cart. Without this step carts still work, just per device.

## 13. Books: stock ledger and vendors (Phase 1)

**Before running 0007:**
1. **Take a backup.** Supabase → Database → Backups (Pro plan), or Project Settings → Database → download a dump. On the free plan, at least export your orders CSV from /admin and note each product's stock.
2. **Run it on a dev/test Supabase project first**, check /admin → Books and Inventory, then run it on the live project.

Then **SQL Editor → New query** → paste all of `supabase/migrations/0007_books_foundation.sql` → **Run**.

What changes:
- Every stock change is recorded in a stock ledger (`stock_movements`). Stock can no longer be typed in directly: use **Inventory → product → Adjust stock** (with a reason). A new product's initial stock is recorded as opening stock.
- Existing stock is recorded as "opening stock". Cost prices start empty; set them per product in Inventory (purchases will set them automatically later).
- Paid orders remember each item's cost at the time of sale (for margins).
- **Books → Vendors**: add vendors, link the products they supply, mark a preferred vendor, archive (never delete).
- An audit log records who changed what.

**Demo data (test project only):** `supabase/demo/books_demo_seed.sql` adds two "DEMO" vendors; the removal SQL is at the bottom of that file. Never run it on the live project.

**Tests:** `npm test` runs the database tests (real Postgres in-process) and unit tests.

## 14. Books: purchases, receiving and bills (Phase 2)

**Order matters: run the SQL first, then deploy the code** (the new pages need the new tables).

1. Take a backup (same as §13) and run it on the dev/test project first.
2. **SQL Editor → New query** → paste all of `supabase/migrations/0008_books_purchases.sql` → **Run**. It should say "Success. No rows returned".
3. `npm run check:launch` should no longer list `purchases` / `purchase_items` as missing.
4. Then run `supabase/migrations/0009_purchase_cost_positive.sql` the same way: purchase lines must cost more than ₹0 (free samples go in with Inventory → Adjust stock → "Sample / gift").

**Bill PDFs (one Cloudinary setting).** Bill photos and PDFs are uploaded as *private* files: nobody can open them without a link the site signs for an admin. Photos and PDF pages (shown as images) work straight away. To also open the **original PDF file**, switch on PDF delivery once:
Cloudinary → ⚙ **Settings** → **Security** → tick **"Allow delivery of PDF and ZIP files"** → **Save**. (Until then "Original PDF" shows an error, but every page still opens as an image.)

What's new (/admin → Books → **Purchases**):
- **New purchase**: choose the vendor, add products (their last price fills in), shipping/discount/tax, the vendor's bill number/date, and photos or PDFs of the bill. "Pay by" fills itself from the bill date + the vendor's payment terms.
- **Save as draft** or **Save & mark ordered**. Share the order on WhatsApp (quantities only, or with prices) or print it / save as PDF.
- **Receive items**: enter what actually arrived (can be in parts). Stock goes up, and each product's cost price becomes the average of the old stock and the new delivery, *including its share of shipping and discount*. More than ordered asks for a confirmation and the bill then counts the extra pieces.
- After anything is received a purchase can't be cancelled or have its items changed; fix stock with **Adjust stock** and write why in the purchase's notes. Bill details, files and notes can always be updated.
- Vendor pages show their purchases and a balance = opening balance + received/billed purchases − payments (§15).

**Demo data (test project only):** paste the whole of `supabase/demo/books_demo_seed.sql` → Run. It creates the two DEMO vendors if they're missing and three DEMO purchases (one draft, two ordered) to try receiving, then shows a table of everything DEMO. Safe to run twice. Removal SQL is at the bottom.

## 15. Books: vendor payments and payables (Phase 3)

**Order matters: run the SQL first, then deploy the code.**

1. Take a backup (same as §13) and run it on the dev/test project first.
2. **SQL Editor → New query** → paste all of `supabase/migrations/0010_books_payments.sql` → **Run**. It should say "Success. No rows returned".
3. `npm run check:launch` should no longer list `vendor_payments` / `vendor_payment_allocations` as missing.

What's new (/admin → Books → **Payments** and **Payables**):
- **Record payment**: vendor, amount, date, UPI / bank / cash / other, UTR, a screenshot or receipt (private, like bills). The amount fills the vendor's open bills **oldest first** (opening balance first); you can change the split. Anything not put on a bill stays as an **advance**.
- A bill can't be paid more than what's left on it, and a payment can't be split into more than its amount.
- **Payment page**: change which bills it covers (e.g. apply an advance to a bill that arrived later), or **void** it with a reason. Voided payments stay visible, crossed out, and stop counting everywhere. Payments are never edited or deleted.
- **Payables**: everything still to pay, most overdue first, with total due, overdue, due in the next 7 days and advances.
- Purchases show Paid / Part paid / Unpaid, and the list can be filtered by "Still to pay", "Overdue" or "Paid in full".
- Vendor pages: KPIs (balance due, purchased, paid, overdue), Payments tab, and a **Statement** (opening balance, bills, payments, running balance) you can share on WhatsApp.
- A purchase with payments on it can't be cancelled, lose its bill number or go below what's paid; void or move the payment first. A vendor's opening balance can't go below what's been paid against it.

**Demo data:** the demo file (§14) now also adds two DEMO payments: one spread over the potters' opening balance and bill, one advance to the shell artisans. Run it again after 0010; it only adds what's missing.

## 16. Books: expenses and repeating reminders (Phase 4)

**Order matters: run the SQL first, then deploy the code.**

1. Take a backup (same as §13) and run it on the dev/test project first.
2. **SQL Editor → New query** → paste all of `supabase/migrations/0011_books_expenses.sql` → **Run**. It should say "Success. No rows returned".
3. `npm run check:launch` should no longer list `expense_categories` / `expenses` as missing.

What's new (/admin → Books → **Expenses**):
- **Add expense** (made for the phone): amount, category, date, how it was paid, a photo of the receipt (private). Vendor, GST and "repeats" are under **More details**. **Save & add another** for a pile of receipts.
- **Expenses list**: one month at a time (arrows to move), filter by category, totals by category on the side. Voided ones are under **Voided**.
- **Repeating expenses** (rent, software): tick "This repeats", choose monthly or yearly. A week before it's due it shows on the **Dashboard** and the Expenses page. **Confirm paid** opens the form with last time's amount (change it if it was different); **Skip** moves the reminder to the next date. Nothing is ever added on its own.
- **Categories**: the 10 starter ones are there; add, rename, reorder or archive (never delete).
- Expenses can be edited while active; **Void** (with a reason) takes one out of every total but keeps it visible.

**Demo data:** the demo file (§14) now also adds three DEMO expenses and a DEMO monthly rent whose reminder is due in 2 days.

## 17. Books: reports, dashboard, reorder and search (Phase 5)

No new SQL: this uses the tables from §13–16 (so run 0010 and 0011 first).

What's new:
- **Books → Reports**: Profit & loss (month by month), Product margin, Vendor statement, Payables ageing, Stock valuation (any date), Stock ledger and Expenses by category. Each has date filters, **Download CSV** and **Print / PDF** (choose "Save as PDF" in the print dialog).
- **CA export pack** (bottom of Reports): pick a month → one ZIP of CSVs for your accountant: sales, purchases, purchase items, vendor payments, expenses and stock valuation at month end. Column names stay the same every month, ready for Zoho / Tally later.
- **Dashboard**: this month's net profit, revenue, cost of goods, gross profit and expenses (vs last month); payables (total, overdue, next bills); a 6-month cash flow chart (money in vs money out, with a table view). Low stock now links to **Reorder**.
- **Inventory → Low stock**: a **Create reorder draft** button per preferred vendor makes a draft purchase with enough to get back to twice the low-stock level. Nothing is sent; you check it first. Products with no preferred vendor or no known price are listed so you can fix them.
- **Search** box in the admin bar: vendors, PO / bill numbers, payments (number or UTR), expenses, products and orders.

How the numbers work (for your CA): sales = item value of orders paid in the period that weren't cancelled or refunded; cost of goods = the product's average cost when each order was paid; expenses by the date spent. Pieces sold before a product had a cost price are flagged.

## Troubleshooting

| Problem | Fix |
|---|---|
| `/admin` still says "Connect Supabase" | Keys missing or dev server not restarted after editing `.env.local`. |
| "This account doesn't have admin access" | Step 4.2 not run, or the email in the SQL doesn't match exactly. |
| Upload button missing / "Photo uploads need…" | `NEXT_PUBLIC_CLOUDINARY_API_KEY` or `CLOUDINARY_API_SECRET` missing; restart dev server. |
| Upload widget says "Invalid signature" | API secret is wrong or belongs to a different Cloudinary account than the cloud name. |
| Checkout says "Online payment isn't switched on yet" | One of `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` is missing; restart dev server. |
| "We couldn't start the payment" | Razorpay key/secret mismatch (test key with live secret, or a typo), or 0002 SQL not run. The terminal running `npm run dev` shows the exact error. |
| Order pages or /admin show "column … does not exist" | A migration hasn't been run. Run them in number order (0001 → 0011). |
| Books → Purchases crashes or says a table doesn't exist | 0008 hasn't been run on this Supabase project (§14). |
| Books → Expenses crashes, or "expenses" doesn't exist | 0011 hasn't been run on this Supabase project (§16). The dashboard still loads without it. |
| Books → Payments / Payables / Vendors crash, or "vendor_payment_allocations" doesn't exist | 0010 hasn't been run on this Supabase project (§15). |
| A bill thumbnail is blank / "Original PDF" shows an error | Cloudinary PDF delivery is off (§14), or `CLOUDINARY_API_SECRET` is missing on the server. |
| Paid but order shows "Confirming payment" | The browser closed before confirming. The webhook (8.4) fixes this automatically once it's set up. |
