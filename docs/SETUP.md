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

**Supabase:** **Project Settings → API** (or **Connect**). Copy the **Project URL** and the **anon / public** key.

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

## Troubleshooting

| Problem | Fix |
|---|---|
| `/admin` still says "Connect Supabase" | Keys missing or dev server not restarted after editing `.env.local`. |
| "This account doesn't have admin access" | Step 4.2 not run, or the email in the SQL doesn't match exactly. |
| Upload button missing / "Photo uploads need…" | `NEXT_PUBLIC_CLOUDINARY_API_KEY` or `CLOUDINARY_API_SECRET` missing; restart dev server. |
| Upload widget says "Invalid signature" | API secret is wrong or belongs to a different Cloudinary account than the cloud name. |
