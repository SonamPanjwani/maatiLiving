const whole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const withPaise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Prices are stored in paise (integer). Whole rupees show without decimals (45000 → "₹450");
// anything with paise shows them exactly (25050 → "₹250.50") — never rounded.
export function formatPrice(paise) {
  return (Math.abs(paise) % 100 === 0 ? whole : withPaise).format(paise / 100);
}
