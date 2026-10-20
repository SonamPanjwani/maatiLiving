// Books area: purchasing, vendors and money. Pages inherit the admin guard from (panel)/layout.js.
// Sections appear here as each phase ships.
const SECTIONS = [
  ["/admin/books/vendors", "Vendors"],
  ["/admin/inventory", "Inventory"],
];

export default function BooksLayout({ children }) {
  return <>
    <nav className="category-nav books-nav" aria-label="Books"><ul>
      <li className="books-nav-label">Books</li>
      {SECTIONS.map(([href, label]) => <li key={href}><a href={href}>{label}</a></li>)}
    </ul></nav>
    {children}
  </>;
}
