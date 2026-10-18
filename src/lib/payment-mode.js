import "server-only";
import { isUpiConfigured } from "@/src/config/payments";
import { isRazorpayConfigured, isRazorpayLive } from "./razorpay";
import { isSupabaseAdminConfigured } from "./supabase/admin";

// How checkout takes payment, decided by what's configured:
//   "razorpay"  — Razorpay keys + Supabase secret key (cards, UPI/PhonePe/GPay, netbanking; automatic)
//   "upi"       — no Razorpay yet, but a UPI ID + Supabase secret key (order saved; admin confirms payment)
//   "whatsapp"  — neither: the order is sent to the shop's WhatsApp
export function getPaymentMode() {
  if (isRazorpayConfigured && isSupabaseAdminConfigured) return "razorpay";
  if (isUpiConfigured && isSupabaseAdminConfigured) return "upi";
  return "whatsapp";
}

export const isPaymentTestMode = () => getPaymentMode() === "razorpay" && !isRazorpayLive;
