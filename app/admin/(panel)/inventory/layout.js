import BooksNav from "@/components/books/BooksNav";

// Inventory is part of Books (stock ledger, cost price); same sub-navigation.
export default function InventoryLayout({ children }) {
  return <>
    <BooksNav />
    {children}
  </>;
}
