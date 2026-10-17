"use server";

import { attachRazorpayOrder, createPendingOrder, markOrderFailed, markOrderPaid, quoteCart, validateCustomer } from "@/src/lib/orders";
import { createRazorpayOrder, isRazorpayConfigured, razorpayKeyId, verifyPaymentSignature } from "@/src/lib/razorpay";
import { isSupabaseAdminConfigured } from "@/src/lib/supabase/admin";

// Fresh prices/stock for the cart page. Lines: [{ productId, quantity }].
export async function refreshCart(lines) {
  return quoteCart(lines);
}

// Creates a pending order + Razorpay order. The browser then opens Razorpay Checkout.
export async function startCheckout({ lines, customer: input }) {
  if (!isRazorpayConfigured || !isSupabaseAdminConfigured) return { error: "Online payment isn't switched on yet. Please order on WhatsApp for now." };

  const { customer, error } = validateCustomer(input);
  if (error) return { error };

  const quote = await quoteCart(lines);
  if (quote.lines.length === 0) return { error: "Your cart is empty.", quote };
  // Something changed since the cart was shown (price, stock): make the customer review before paying.
  const changed = quote.notices.length > 0 || quote.lines.some((line) => {
    const sent = lines.find((item) => item.productId === line.productId);
    return !sent || sent.price !== line.price || sent.quantity !== line.quantity;
  });
  if (changed) return { error: "Your cart was updated with the latest prices and stock. Please check it and pay again.", quote };

  try {
    const order = await createPendingOrder(customer, quote);
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
