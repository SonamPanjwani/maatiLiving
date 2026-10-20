const whole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const withPaise = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Prices are stored in paise (integer). Whole rupees show without decimals (45000 → "₹450");
// anything with paise shows them exactly (25050 → "₹250.50") — never rounded.
export function formatPrice(paise) {
  return (Math.abs(paise) % 100 === 0 ? whole : withPaise).format(paise / 100);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-10-20" (a calendar date, no time) → "20 Oct 2026". Blank or invalid → "".
// Built by hand: Intl prints "Sept" in newer locale data.
export function formatDate(isoDate) {
  const match = String(isoDate ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match || !MONTHS[Number(match[2]) - 1]) return "";
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

// Today's calendar date in India as "YYYY-MM-DD" (for date inputs and "overdue" checks).
export function todayInIndia(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const timeFormat = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

// A moment (timestamp) in India time: "20 Oct 2026, 3:45 pm".
export function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatDate(todayInIndia(date))}, ${timeFormat.format(date)}`;
}
