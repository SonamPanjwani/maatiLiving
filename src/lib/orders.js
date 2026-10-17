import "server-only";
import { shippingFor, shopConfig } from "@/src/config/shop";
import { getProductsByIds } from "./catalog";
import { sendOrderEmails } from "./email";
import { getSupabaseAdminClient, isSupabaseAdminConfigured } from "./supabase/admin";
import { clean, isValidEmail, validateAddress } from "./validation";

export const ORDER_COLUMNS = `id, order_number, access_token, status, customer_name, email, phone, address_line1, address_line2,
  city, state, pincode, notes, subtotal_paise, shipping_paise, total_paise, razorpay_order_id, razorpay_payment_id,
  paid_at, created_at, order_items(product_name, product_slug, image_public_id, unit_price_paise, quantity)`;

// Re-prices cart lines from the database. Never trusts browser prices.
// Returns { lines, subtotal, shipping, total, notices } with quantities clamped to stock.
// Delivery depends on the state; without one, shipping is null (not yet known) and total excludes it.
export async function quoteCart(rawLines, state = null) {
  const requested = (Array.isArray(rawLines) ? rawLines : [])
    .slice(0, shopConfig.maxLinesPerOrder)
    .map((line) => ({ productId: String(line?.productId ?? ""), quantity: Math.floor(Number(line?.quantity)) }))
    .filter((line) => line.productId && line.quantity > 0);

  const products = await getProductsByIds(requested.map((line) => line.productId));
  const notices = [];
  const lines = [];

  for (const line of requested) {
    const product = products.find((item) => item.id === line.productId);
    if (!product) { notices.push("One item is no longer available and was removed."); continue; }
    const available = Math.min(product.stock, shopConfig.maxQuantityPerItem);
    if (available <= 0) { notices.push(`${product.name} has just sold out and was removed.`); continue; }
    const quantity = Math.min(line.quantity, available);
    if (quantity < line.quantity) notices.push(`Only ${available} of ${product.name} available — quantity updated.`);
    lines.push({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      imagePublicId: product.images[0]?.publicId ?? "",
      maxQuantity: available,
      quantity,
    });
  }

  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const shipping = shippingFor(subtotal, state);
  return { lines, subtotal, shipping, total: subtotal + (shipping ?? 0), notices };
}

// Returns { customer } (orders column names) or { error }.
export function validateCustomer(input) {
  const email = clean(input?.email, 160).toLowerCase();
  if (!isValidEmail(email)) return { error: "Please enter a valid email address." };
  const { address, error } = validateAddress(input);
  if (error) return { error };
  return {
    customer: {
      customer_name: address.name,
      email,
      phone: address.phone,
      address_line1: address.line1,
      address_line2: address.line2,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      notes: clean(input?.notes, 500) || null,
    },
    address,
  };
}

// userId: the signed-in customer (from the server session), or null for guest checkout.
export async function createPendingOrder(customer, quote, userId = null) {
  const supabase = getSupabaseAdminClient();
  const { data: order, error } = await supabase.from("orders").insert({
    ...customer,
    user_id: userId,
    subtotal_paise: quote.subtotal,
    shipping_paise: quote.shipping,
    total_paise: quote.total,
  }).select("id, order_number, access_token").single();
  if (error) throw new Error(`Could not create order: ${error.message}`);

  const { error: itemsError } = await supabase.from("order_items").insert(quote.lines.map((line) => ({
    order_id: order.id,
    product_id: line.productId,
    product_name: line.name,
    product_slug: line.slug,
    image_public_id: line.imagePublicId || null,
    unit_price_paise: line.price,
    quantity: line.quantity,
  })));
  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    throw new Error(`Could not save order items: ${itemsError.message}`);
  }
  return order;
}

export async function attachRazorpayOrder(orderId, razorpayOrderId) {
  const { error } = await getSupabaseAdminClient().from("orders").update({ razorpay_order_id: razorpayOrderId }).eq("id", orderId);
  if (error) throw new Error(`Could not link payment: ${error.message}`);
}

// Idempotent: safe to call from both the browser confirmation and the webhook.
export async function markOrderPaid(razorpayOrderId, razorpayPaymentId) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("mark_order_paid", { p_razorpay_order_id: razorpayOrderId, p_payment_id: razorpayPaymentId });
  if (error) throw new Error(`Could not confirm order: ${error.message}`);
  const result = data?.[0];
  if (!result) return null;

  const { data: order } = await supabase.from("orders").select(ORDER_COLUMNS).eq("id", result.order_id).single();
  if (result.newly_paid && order) await sendOrderEmails(order);
  return order;
}

export async function markOrderFailed(razorpayOrderId) {
  await getSupabaseAdminClient().from("orders").update({ status: "failed" }).eq("razorpay_order_id", razorpayOrderId).eq("status", "pending");
}

// Customer-facing lookup: needs both the order number and its secret access token.
export async function getOrderForCustomer(orderNumber, accessToken) {
  if (!/^[0-9a-f-]{36}$/i.test(String(accessToken ?? ""))) return null;
  const { data } = await getSupabaseAdminClient().from("orders").select(ORDER_COLUMNS)
    .eq("order_number", orderNumber).eq("access_token", accessToken).maybeSingle();
  return data;
}

// Links guest orders placed with this email to the account. Only call for a verified email.
export async function claimGuestOrders(user) {
  if (!isSupabaseAdminConfigured || !user?.email || !user.email_confirmed_at) return 0;
  const { data, error } = await getSupabaseAdminClient().rpc("claim_guest_orders", { p_user_id: user.id, p_email: user.email });
  if (error) { console.error("claim_guest_orders:", error.message); return 0; }
  return data ?? 0;
}
