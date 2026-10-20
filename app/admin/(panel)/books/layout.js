import BooksNav from "@/components/books/BooksNav";

// Books area: purchasing, vendors and money. Pages inherit the admin guard from (panel)/layout.js.
export default function BooksLayout({ children }) {
  return <>
    <BooksNav />
    {children}
  </>;
}
