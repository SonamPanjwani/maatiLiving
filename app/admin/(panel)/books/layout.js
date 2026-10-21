import BooksNav from "@/components/books/BooksNav";
import MigrationNotice from "@/components/books/MigrationNotice";
import { missingBooksMigrations } from "@/src/lib/books/schema";

// Books area: purchasing, vendors and money. Pages inherit the admin guard from (panel)/layout.js.
// If a Books migration hasn't been run on this database, say which one instead of crashing.
export default async function BooksLayout({ children }) {
  const missing = await missingBooksMigrations();
  return <>
    <BooksNav />
    {missing.length ? <MigrationNotice missing={missing} /> : children}
  </>;
}
