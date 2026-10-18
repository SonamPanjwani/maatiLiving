// Direct UPI (PhonePe / Google Pay / Paytm / BHIM) — used until Razorpay is live.
// Public values only: a UPI ID is meant to be shared with payers.
const upiId = (process.env.NEXT_PUBLIC_UPI_ID || "").trim();

export const upiConfig = {
  id: upiId,
  payeeName: (process.env.NEXT_PUBLIC_UPI_PAYEE_NAME || "Maati Living").trim(),
};

// handle@bank, e.g. maatiliving@ybl / name@okhdfcbank
export const isUpiConfigured = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/.test(upiId);

// Standard UPI intent link: opens any UPI app with payee, amount and note filled in.
// The UPI ID goes in raw (validated above to safe characters): some apps reject "%40" for "@".
export function upiPayUrl({ amountPaise, orderNumber }) {
  const pn = encodeURIComponent(upiConfig.payeeName);
  const tn = encodeURIComponent(`Maati Living order ${orderNumber}`);
  return `upi://pay?pa=${upiConfig.id}&pn=${pn}&am=${(amountPaise / 100).toFixed(2)}&cu=INR&tn=${tn}`;
}
