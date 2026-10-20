#!/usr/bin/env node
// Pre-launch checklist: `npm run check:launch`
// Reads .env.local (overridden by real environment variables, e.g. on Vercel), the business
// config, and — when keys are present — the live Supabase database. Never prints secret values.
// Exit code 1 if anything blocks launch.
import { existsSync, readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

function loadEnv() {
  const env = {};
  if (existsSync(new URL(".env.local", root))) {
    for (const line of read(".env.local").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
  for (const [key, value] of Object.entries(process.env)) if (value) env[key] = value;
  return env;
}

const env = loadEnv();
const results = { block: [], warn: [], ok: [] };
const block = (message) => results.block.push(message);
const warn = (message) => results.warn.push(message);
const ok = (message) => results.ok.push(message);
const has = (key) => Boolean(env[key]);

// ---------------------------------------------------------------- environment
const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? "";
if (!siteUrl) block("NEXT_PUBLIC_SITE_URL is not set (your https:// domain).");
else if (!siteUrl.startsWith("https://") || siteUrl.includes("localhost")) block("NEXT_PUBLIC_SITE_URL must be your live https:// domain, not localhost.");
else ok("Site URL set");

const supabaseKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!has("NEXT_PUBLIC_SUPABASE_URL") || !supabaseKey) block("Supabase URL / publishable key missing.");
else ok("Supabase URL + publishable key");
if (!secretKey) block("SUPABASE_SECRET_KEY missing (needed for checkout).");
else if (/^sb_publishable_/.test(secretKey)) block("SUPABASE_SECRET_KEY looks like the publishable key — use the secret (sb_secret_…) key.");
else ok("Supabase secret key");
for (const key of Object.keys(env)) {
  if (key.startsWith("NEXT_PUBLIC_") && /SECRET|SERVICE_ROLE/.test(key)) block(`${key}: secrets must never start with NEXT_PUBLIC_ (they would be sent to every browser).`);
}

if (!has("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME") || !has("NEXT_PUBLIC_CLOUDINARY_API_KEY") || !has("CLOUDINARY_API_SECRET")) block("Cloudinary cloud name / API key / API secret incomplete.");
else ok("Cloudinary keys");

// Payments: Razorpay if configured, else direct UPI (confirmed by hand), else orders by WhatsApp.
const rzpId = env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";
const upiId = env.NEXT_PUBLIC_UPI_ID ?? "";
const upiValid = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/.test(upiId);
if (rzpId || has("RAZORPAY_KEY_SECRET")) {
  if (!rzpId || !has("RAZORPAY_KEY_SECRET")) block("Razorpay key id / secret: only one of the pair is set.");
  else if (rzpId.startsWith("rzp_test_")) block("Razorpay is still in TEST mode (rzp_test_…). Switch to live keys after KYC.");
  else if (rzpId.startsWith("rzp_live_")) ok("Payments: Razorpay live");
  else warn("Razorpay key id has an unexpected format.");
  if (!has("RAZORPAY_WEBHOOK_SECRET")) block("RAZORPAY_WEBHOOK_SECRET missing — set up the webhook (docs/DEPLOY.md).");
  else ok("Razorpay webhook secret");
} else if (upiId && !upiValid) {
  block(`NEXT_PUBLIC_UPI_ID doesn't look like a UPI ID (expected name@bank).`);
} else if (upiValid) {
  ok(`Payments: direct UPI to ${upiId} (you confirm each payment in /admin → Orders → UPI to verify)`);
  warn("Razorpay not set up yet — payments are checked by hand. Add Razorpay keys after KYC to automate.");
} else {
  warn("No online payment yet: checkout sends orders to your WhatsApp. Add NEXT_PUBLIC_UPI_ID or Razorpay keys to take payments on the site.");
}

if (!/^91[6-9]\d{9}$/.test(env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "")) block("NEXT_PUBLIC_WHATSAPP_NUMBER must be 91 + 10-digit mobile (e.g. 919876543210).");
else ok("WhatsApp number");
const email = env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";
if (!email || email.endsWith("@example.com")) block("NEXT_PUBLIC_CONTACT_EMAIL is not set to a real address.");
else ok("Contact email");

if (!has("RESEND_API_KEY") || !has("EMAIL_FROM")) warn("Order emails are off (RESEND_API_KEY / EMAIL_FROM). Orders still work; customers just won't get emails.");
else {
  ok("Order emails");
  if (!has("ORDER_NOTIFY_EMAIL")) warn("ORDER_NOTIFY_EMAIL not set — you won't get new-order emails.");
}

// ---------------------------------------------------------------- hero photos in the configured Cloudinary cloud
if (has("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME")) {
  try {
    const heroIds = [...read("src/data/hero.js").matchAll(/publicId:\s*"([^"]+)"/g)].map((match) => match[1]);
    const missing = [];
    for (const id of heroIds) {
      const response = await fetch(`https://res.cloudinary.com/${env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/${id}`, { method: "HEAD" });
      if (!response.ok) missing.push(id);
    }
    if (missing.length) block(`Hero photos not found in Cloudinary cloud "${env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}": ${missing.join(", ")}. Upload them there, or point NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME at the account that has them.`);
    else ok(`Hero photos found (${heroIds.length})`);
  } catch (cause) {
    warn(`Couldn't check hero photos: ${cause.message}`);
  }
}

// ---------------------------------------------------------------- business details
const todoLines = read("src/config/business.js").split(/\r?\n/).filter((line) => /:\s*"TODO/.test(line) && !line.trim().startsWith("//"));
if (todoLines.length) block(`Business details still TODO in src/config/business.js (${todoLines.length}):\n${todoLines.map((line) => `      ${line.trim()}`).join("\n")}`);
else ok("Business details filled in");

// ---------------------------------------------------------------- live database
async function rest(path) {
  const headers = { apikey: secretKey };
  if (secretKey.startsWith("eyJ")) headers.Authorization = `Bearer ${secretKey}`; // legacy service_role JWT
  const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, { headers });
  return { status: response.status, body: await response.json().catch(() => null) };
}

if (has("NEXT_PUBLIC_SUPABASE_URL") && secretKey) {
  try {
    const tables = { categories: "0001", products: "0001", profiles: "0001", orders: "0002", addresses: "0003", settings: "0004", carts: "0006", vendors: "0007", vendor_products: "0007", stock_movements: "0007", audit_log: "0007" };
    let schemaOk = true;
    for (const [table, migration] of Object.entries(tables)) {
      const { status } = await rest(`${table}?select=*&limit=1`);
      if (status !== 200) { block(`Table "${table}" not reachable (HTTP ${status}) — run migration ${migration}.`); schemaOk = false; }
    }
    if (schemaOk) {
      ok("Core tables present (0001–0004)");
      const columns = await rest("orders?select=tracking_number&limit=1");
      if (columns.status !== 200) block("orders.tracking_number missing — run 0004_admin_operations.sql.");
      const upiColumns = await rest("orders?select=payment_method&limit=1");
      if (upiColumns.status !== 200) block("orders.payment_method missing — run 0005_manual_upi.sql.");

      const admins = await rest("profiles?select=email&role=eq.admin");
      if (!admins.body?.length) block("No admin account — see docs/SETUP.md step 4.");
      else ok(`Admin account(s): ${admins.body.length}`);

      const products = (await rest("products?select=slug,stock,is_available,product_images(id)")).body ?? [];
      const visible = products.filter((product) => product.is_available);
      if (!visible.length) block("No visible products in the shop.");
      else ok(`${visible.length} visible product(s)`);
      const noPhotos = visible.filter((product) => !product.product_images.length);
      if (noPhotos.length) warn(`${noPhotos.length} visible product(s) have no photos: ${noPhotos.map((product) => product.slug).join(", ")}`);
      const samples = products.filter((product) => ["terracotta-diya-set-of-6", "coconut-shell-hanging-planter", "coconut-shell-agarbatti-stand"].includes(product.slug));
      if (samples.length) warn(`Sample products from seed.sql are still there (${samples.map((product) => product.slug).join(", ")}). Edit or delete them.`);

      const shipping = (await rest("settings?select=value&key=eq.shipping")).body?.[0]?.value;
      if (!shipping) warn("No delivery settings saved — the default ₹99 applies everywhere. Set them in /admin → Delivery.");
      else if (!Object.keys(shipping.byStatePaise ?? {}).length) warn("No per-state delivery charges — every state uses the standard rate. Fine if intended.");
      else ok(`Delivery charges set for ${Object.keys(shipping.byStatePaise).length} state(s)`);
    }
  } catch (cause) {
    warn(`Couldn't reach Supabase to check the database: ${cause.message}`);
  }
} else {
  warn("Skipped database checks (Supabase URL / secret key not set).");
}

// ---------------------------------------------------------------- admin guards (static)
// Every admin page must sit under app/admin/(panel) (layout runs requireAdminPage) or be the login page;
// every exported server action / route handler under app/admin must call assertAdmin() or getCurrentAdmin().
{
  const { readdirSync, statSync } = await import("node:fs");
  const walk = (dir) => readdirSync(dir).flatMap((name) => {
    const full = new URL(`${name}${statSync(new URL(name, dir)).isDirectory() ? "/" : ""}`, dir);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
  const adminDir = new URL("app/admin/", root);
  const files = walk(adminDir).map((url) => decodeURIComponent(url.pathname).replace(/^.*?app\/admin\//, "app/admin/"));
  const problems = [];
  for (const file of files) {
    if (/\/page\.js$/.test(file) && !file.startsWith("app/admin/(panel)/") && file !== "app/admin/login/page.js") problems.push(`${file}: admin page outside (panel) — no admin guard`);
    if (/actions\.js$|route\.js$/.test(file)) {
      const source = read(file);
      const exported = [...source.matchAll(/export async function (\w+)\s*\(/g)].map((m) => m[1]);
      for (const name of exported) {
        const body = source.slice(source.indexOf(`export async function ${name}`)).split(/\nexport /)[0];
        const isAuthAction = ["signIn", "signOut"].includes(name);
        if (!isAuthAction && !/assertAdmin\(\)|getCurrentAdmin\(\)/.test(body)) problems.push(`${file}: ${name}() has no admin check`);
      }
    }
  }
  if (problems.length) block(`Admin guard missing:\n${problems.map((p) => `      ${p}`).join("\n")}`);
  else ok(`Admin guards present on all /admin pages, actions and routes (${files.length} files checked)`);
}

// ---------------------------------------------------------------- report
console.log("\nMaati Living — launch check\n");
for (const message of results.ok) console.log(`  ✓ ${message}`);
for (const message of results.warn) console.log(`  ! ${message}`);
for (const message of results.block) console.log(`  ✗ ${message}`);
console.log(`\n${results.block.length ? `${results.block.length} blocker(s)` : "No blockers"}, ${results.warn.length} warning(s).`);
console.log("Also check by hand: docs/DEPLOY.md → 'Before you announce'.\n");
process.exit(results.block.length ? 1 : 0);
