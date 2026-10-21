#!/usr/bin/env node
// Proves server secrets never reach the browser: `npm run check:secrets` after a build
// (`--env <file>` to use other values, `--dir <distDir>` if the build isn't in .next).
//   1. Every file the browser can download (<distDir>/static/**) is searched for each secret's VALUE and NAME.
//   2. Every source file that reads a secret must be server-only (import "server-only", "use server",
//      a route handler, middleware, or a script).
// Never prints secret values. Exit code 1 on any finding.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const arg = (flag, fallback) => (process.argv.includes(flag) ? process.argv[process.argv.indexOf(flag) + 1] : fallback);
const envFile = arg("--env", ".env.local");
const distDir = arg("--dir", process.env.NEXT_DIST_DIR || ".next");

const SECRETS = ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "CLOUDINARY_API_SECRET", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET", "SMTP_PASS", "SUPABASE_DB_URL"];

const env = {};
if (existsSync(join(root, envFile))) {
  for (const line of readFileSync(join(root, envFile), "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}
for (const [key, value] of Object.entries(process.env)) if (value) env[key] = value;

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : [full];
});

const problems = [];

// 1. Browser bundle
const staticDir = join(root, distDir, "static");
if (!existsSync(staticDir)) {
  console.error(`No build found at ${distDir}/static — run \`npm run build\` first (or pass --dir).`);
  process.exit(1);
}
const files = walk(staticDir).filter((file) => /\.(js|css|html|json|map|txt)$/.test(file));
const values = SECRETS.filter((key) => (env[key] ?? "").length >= 8).map((key) => [key, env[key]]);
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const [key, value] of values) if (text.includes(value)) problems.push(`${relative(root, file)} contains the VALUE of ${key}`);
  for (const key of SECRETS) if (text.includes(key)) problems.push(`${relative(root, file)} mentions ${key}`);
}

// 2. Source files that read a secret must be server-only
const SOURCE_DIRS = ["app", "components", "src"];
const sources = SOURCE_DIRS.flatMap((dir) => walk(join(root, dir))).filter((file) => /\.(js|jsx|mjs)$/.test(file));
for (const file of sources) {
  const text = readFileSync(file, "utf8");
  const used = SECRETS.filter((key) => new RegExp(`process\\.env\\.${key}\\b`).test(text));
  if (!used.length) continue;
  const rel = relative(root, file).replace(/\\/g, "/");
  const serverOnly = /import\s+["']server-only["']/.test(text) || /^\s*["']use server["']/m.test(text) || /\/route\.js$/.test(rel);
  if (!serverOnly) problems.push(`${rel} reads ${used.join(", ")} but isn't marked server-only`);
  if (/^\s*["']use client["']/m.test(text)) problems.push(`${rel} is a client component and reads ${used.join(", ")}`);
}

console.log(`\nSecrets check — ${files.length} browser files in ${distDir}/static, ${values.length} secret values from ${envFile}${values.length ? "" : " (none set: names only)"}\n`);
if (problems.length) {
  for (const problem of problems) console.log(`  ✗ ${problem}`);
  console.log(`\n${problems.length} problem(s).\n`);
  process.exit(1);
}
console.log("  ✓ No secret value or name in anything the browser downloads");
console.log("  ✓ Every file that reads a secret is server-only\n");
