import "server-only";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

// Which Books migrations are missing on this Supabase project, so Books pages can say "run migration 00XX" instead
// of crashing. One table per migration (0009 only replaces a function, so it can't be detected this way).
export const BOOKS_MIGRATIONS = [
  { table: "vendors", file: "0007_books_foundation.sql", setup: "§13" },
  { table: "purchases", file: "0008_books_purchases.sql", setup: "§14" },
  { table: "vendor_payments", file: "0010_books_payments.sql", setup: "§15" },
  { table: "expenses", file: "0011_books_expenses.sql", setup: "§16" },
];

// PostgREST "table not in schema cache" / Postgres "relation does not exist".
const isMissingTable = (error) => error && (error.code === "PGRST205" || error.code === "42P01");

// Once every table has been seen, the check is skipped for the life of the server (no cost on later requests).
let allPresent = false;

export async function missingBooksMigrations() {
  if (allPresent) return [];
  const supabase = createSupabaseServerClient();
  const results = await Promise.all(BOOKS_MIGRATIONS.map(async (migration) => {
    const { error } = await supabase.from(migration.table).select("id", { head: true }).limit(1);
    return isMissingTable(error) ? migration : null;
  }));
  const missing = results.filter(Boolean);
  if (missing.length === 0) allPresent = true;
  return missing;
}
