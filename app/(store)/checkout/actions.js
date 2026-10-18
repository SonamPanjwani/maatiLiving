"use server";

import { attachRazorpayOrder, createPendingOrder, markOrderFailed, markOrderPaid, quoteCart, submitUpiReference, validateCustomer } from "@/src/lib/orders";
import { getPaymentMode } from "@/src/lib/payment-mode";
import { createRazorpayOrder, razorpayKeyId, verifyPaymentSignature } from "@/src/lib/razorpay";
import { getCurrentUser } from "@/src/lib/auth";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

// Fresh prices/stock for the cart page. Lines: [{ productId, quantity }].
export async function refreshCart(lines) {
  return quoteCart(lines);
}

// Shared by both payment routes: validate the address, re-price the cart from the database, refuse if
// anything changed since the customer saw it, and create the pending order (linked to the signed-in
// account from the server session, never from the form).
async function prepareOrder(lines, input, paymentMethod) {
  const { customer, address, error } = validateCustomer(input);
  if (error) return { error };
  const current = await getCurrentUser();

  const quote = await quoteCart(lines, customer.state);
  if (quote.lines.length === 0) return { error: "Your cart is empty.", quote };
  const changed = quote.notices.length > 0 || quote.lines.some((line) => {
    const sent = lines.find((item) => item.productId === line.productId);
    return !sent || sent.price !== line.price || sent.quantity !== line.quantity;
  });
  if (changed) return { error: "Your cart was updated with the latest prices and stock. Please check it and place the order again.", quote };

  const order = await createPendingOrder(customer, quote, current?.user.id ?? null, paymentMethod);
  if (current && input?.saveAddress === "on") await saveCheckoutAddress(address);
  return { order, quote, customer };
}

// Razorpay: creates a pending order + Razorpay order. The browser then opens Razorpay Checkout.
export async function startCheckout({ lines, customer: input }) {
  if (getPaymentMode() !== "razorpay") return { error: "Online card payment isn't switched on yet." };
  try {
    const prepared = await prepareOrder(lines, input, "razorpay");
    if (prepared.error) return prepared;
    const { order, quote, customer } = prepared;
    const razorpayOrder = await createRazorpayOrder({
      amountPaise: quote.total,
      receipt: order.order_number,
      notes: { order_number: order.order_number },
    });
    await attachRazorpayOrder(order.id, razorpayOrder.id);
    return {
      keyId: razorpayKeyId,
      razorpayOrderId: razorpayOrder.id,
      amount: quote.total,
      orderNumber: order.order_number,
      accessToken: order.access_token,
      prefill: { name: customer.customer_name, email: customer.email, contact: customer.phone },
    };
  } catch (cause) {
    console.error(cause);
    return { error: "We couldn't start the payment. Please try again in a moment." };
  }
}

// Direct UPI: saves the order (unpaid), then the order page shows the UPI ID / QR to pay.
export async function placeUpiOrder({ lines, customer: input }) {
  if (getPaymentMode() !== "upi") return { error: "UPI payment isn't switched on." };
  try {
    const prepared = await prepareOrder(lines, input, "upi_manual");
    if (prepared.error) return prepared;
    return { ok: true, url: `/orders/${prepared.order.order_number}?t=${prepared.order.access_token}` };
  } catch (cause) {
    console.error(cause);
    return { error: "We couldn't place your order. Please try again in a moment." };
  }
}

// Customer says "I've paid" and gives the UPI transaction id. Needs the order's secret access token.
export async function submitPaymentReference(_prevState, formData) {
  const reference = String(formData.get("reference") ?? "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9]{6,35}$/.test(reference)) return { error: "Please enter the UPI transaction ID (usually 12 digits) from your payment app." };
  const saved = await submitUpiReference(String(formData.get("orderNumber") ?? ""), String(formData.get("token") ?? ""), reference);
  return saved ? { saved: true } : { error: "We couldn't save that. Please message us on WhatsApp with your order number." };
}

// Best effort: a failed address save must not block the order. RLS ties it to the signed-in user.
async function saveCheckoutAddress(address) {
  const supabase = createSupabaseServerClient();
  const { count } = await supabase.from("addresses").select("id", { count: "exact", head: true });
  const { error } = await supabase.from("addresses").insert({ ...address, is_default: !count });
  if (error) console.error("Saving checkout address:", error.message);
}

// Called by the Razorpay Checkout success handler. Signature check is what makes it trustworthy.
export async function confirmPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!verifyPaymentSignature({ razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature })) {
    return { error: "We couldn't verify this payment. If money was taken, contact us with your order number." };
  }
  try {
    const order = await markOrderPaid(razorpay_order_id, razorpay_payment_id);
    if (!order) return { error: "Order not found." };
    return { ok: true, url: `/orders/${order.order_number}?t=${order.access_token}` };
  } catch (cause) {
    console.error(cause);
    return { error: "Payment received, but we couldn't update your order. We'll confirm it shortly — please don't pay again." };
  }
}

export async function reportPaymentFailed(razorpayOrderId) {
  if (typeof razorpayOrderId === "string" && razorpayOrderId.startsWith("order_")) await markOrderFailed(razorpayOrderId);
}
