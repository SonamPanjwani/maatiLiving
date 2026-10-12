const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

// Prices are stored in paise (integer) — 45000 → "₹450".
export function formatPrice(paise) {
  return inr.format(paise / 100);
}
