// Admin navigation, shared by the header (components/admin/AdminBar.jsx) and the Books sub-navigation.

export const STORE_LINKS = [
  ["/admin", "Dashboard"],
  ["/admin/orders", "Orders"],
  ["/admin/products", "Products"],
  ["/admin/categories", "Categories"],
  ["/admin/customers", "Customers"],
  ["/admin/settings", "Delivery"],
];

// Inventory lives here, under Books (not in the main nav).
export const BOOKS_LINKS = [
  ["/admin/books/vendors", "Vendors"],
  ["/admin/books/purchases", "Purchases"],
  ["/admin/books/payments", "Payments"],
  ["/admin/books/payables", "Payables"],
  ["/admin/books/expenses", "Expenses"],
  ["/admin/books/reports", "Reports"],
  ["/admin/inventory", "Inventory"],
];

// Desktop main nav: the store pages plus one "Books" entry (current on any Books or Inventory page).
export const MAIN_LINKS = [...STORE_LINKS.slice(0, 5), ["/admin/books", "Books", ["/admin/books", "/admin/inventory"]], STORE_LINKS[5]];
