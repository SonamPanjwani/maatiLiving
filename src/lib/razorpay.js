import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";

export const razorpayKeyId = keyId;
export const isRazorpayConfigured = Boolean(keyId && keySecret);
export const isRazorpayLive = keyId.startsWith("rzp_live_");

function safeEqualHex(expected, received) {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(received ?? ""), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// https://razorpay.com/docs/api/orders/create/
export async function createRazorpayOrder({ amountPaise, receipt, notes }) {
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
    },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt, notes }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Razorpay order failed: ${body?.error?.description ?? response.status}`);
  return body; // { id: "order_…", amount, currency, … }
}

// Checkout handler signature: HMAC-SHA256(order_id + "|" + payment_id, key_secret).
export function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  if (!keySecret || !razorpayOrderId || !razorpayPaymentId) return false;
  const expected = createHmac("sha256", keySecret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
  return safeEqualHex(expected, razorpaySignature);
}

export const isWebhookConfigured = Boolean(webhookSecret);

// Webhook signature: HMAC-SHA256(raw request body, webhook secret).
export function verifyWebhookSignature(rawBody, signature) {
  if (!webhookSecret) return false;
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
