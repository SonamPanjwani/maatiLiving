import BooksNav from "@/components/books/BooksNav";
import MigrationNotice from "@/components/books/MigrationNotice";
import { missingBooksMigrations } from "@/src/lib/books/schema";

// Inventory is part of Books (stock ledger, cost price); same sub-navigation and the same "database update
// needed" notice if a Books migration hasn't been run.
export default async function InventoryLayout({ children }) {
  const missing = await missingBooksMigrations();
  return <>
    <BooksNav />
    {missing.length ? <MigrationNotice missing={missing} /> : children}
  </>;
}
