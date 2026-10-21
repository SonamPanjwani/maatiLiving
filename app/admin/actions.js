"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { indianStates } from "@/src/config/shop";
import { assertAdmin } from "@/src/lib/auth";
import { ORDER_EMAIL_COLUMNS, sendOrderEmails, sendShippedEmail, sendTestEmail } from "@/src/lib/email";
import { rupeesToPaise } from "@/src/lib/books/money";
import { isRazorpayConfigured, refundPayment } from "@/src/lib/razorpay";
import { slugify } from "@/src/lib/slugify";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const text = (formData, key) => String(formData.get(key) ?? "").trim();

function friendlyDbError(error) {
  if (error.code === "23505") return "That slug or SKU is already used by another item.";
  if (error.code === "23503") return "This category still has products in it — move or delete them first.";
  if (error.code === "42501") return "Not authorised.";
  return error.message;
}

function revalidateStorefront() {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function signIn(_prevState, formData) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: text(formData, "email"), password: String(formData.get("password") ?? "") });
  if (error) return { error: "Email or password is incorrect." };

  const { user } = data; // straight from the sign-in response (no extra round trip)
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    await supabase.auth.signOut();
    return { error: "This account doesn't have admin access." };
  }
  redirect("/admin");
}

export async function signOut() {
  await createSupabaseServerClient().auth.signOut();
  redirect("/admin/login");
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

function parseImages(raw) {
  try {
    const images = JSON.parse(raw || "[]");
    return images.filter((image) => typeof image?.publicId === "string" && image.publicId)
      .map((image) => ({ publicId: image.publicId, alt: String(image.alt ?? "").trim() }));
  } catch {
    return [];
  }
}

export async function saveProduct(_prevState, formData) {
  await assertAdmin();
  const supabase = createSupabaseServerClient();

  const id = text(formData, "id");
  const name = text(formData, "name");
  const slug = slugify(text(formData, "slug") || name);
  const pricePaise = rupeesToPaise(text(formData, "price"));
  // Stock is set only when the product is created (recorded as opening stock); afterwards use Adjust stock.
  const stock = id ? null : Number(text(formData, "stock") || 0);
  const images = parseImages(formData.get("images"));

  if (!name) return { error: "Please give the product a name." };
  if (!slug) return { error: "Please give the product a slug (used in its web address)." };
  if (!text(formData, "categoryId")) return { error: "Please choose a category." };
  if (!Number.isInteger(pricePaise) || pricePaise <= 0) return { error: "Price must be more than ₹0, e.g. 450 or 450.50." };
  if (!id && (!Number.isInteger(stock) || stock < 0)) return { error: "Initial stock must be a whole number, 0 or more." };

  const row = {
    name,
    slug,
    category_id: text(formData, "categoryId"),
    price_paise: pricePaise,
    ...(id ? {} : { stock }),
    short_description: text(formData, "shortDescription"),
    sourcing_note: text(formData, "sourcingNote"),
    materials: text(formData, "materials").split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
    artisan: text(formData, "artisan"),
    region: text(formData, "region"),
    care: text(formData, "care"),
    sku: text(formData, "sku") || null,
    is_available: formData.get("available") === "on",
    is_featured: formData.get("featured") === "on",
  };

  const { data: saved, error } = id
    ? await supabase.from("products").update(row).eq("id", id).select("id").single()
    : await supabase.from("products").insert(row).select("id").single();
  if (error) return { error: friendlyDbError(error) };

  // Replace the image list wholesale: order in the form is the display order, first is the cover.
  const { error: deleteError } = await supabase.from("product_images").delete().eq("product_id", saved.id);
  if (deleteError) return { error: friendlyDbError(deleteError) };
  if (images.length) {
    const { error: imageError } = await supabase.from("product_images").insert(
      images.map((image, index) => ({ product_id: saved.id, public_id: image.publicId, alt: image.alt || name, sort_order: index })),
    );
    if (imageError) return { error: friendlyDbError(imageError) };
  }

  revalidateStorefront();
  redirect(`/admin/products?saved=${encodeURIComponent(name)}`);
}

export async function deleteProduct(formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const { error } = await createSupabaseServerClient().from("products").delete().eq("id", id);
  if (error) {
    const message = ["23001", "23503"].includes(error.code)
      ? "This product has stock or order history, so it can't be deleted. Untick \"Visible in shop\" to hide it instead."
      : friendlyDbError(error);
    redirect(`/admin/products/${id}?error=${encodeURIComponent(message)}`);
  }
  revalidateStorefront();
  redirect("/admin/products");
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function saveCategory(_prevState, formData) {
  await assertAdmin();
  const supabase = createSupabaseServerClient();

  const id = text(formData, "id");
  const name = text(formData, "name");
  const slug = slugify(text(formData, "slug") || name);
  if (!name) return { error: "Please give the category a name." };
  if (!slug) return { error: "Please give the category a slug." };

  const parentId = text(formData, "parentId") || null;
  if (id && parentId === id) return { error: "A category can't be inside itself." };

  const [image] = parseImages(formData.get("image"));
  const row = {
    name,
    slug,
    description: text(formData, "description"),
    parent_id: parentId,
    image_public_id: image?.publicId ?? null,
    image_alt: image?.alt || name,
    sort_order: Number(text(formData, "sortOrder") || 0),
  };

  const { error } = id
    ? await supabase.from("categories").update(row).eq("id", id)
    : await supabase.from("categories").insert(row);
  if (error) return { error: friendlyDbError(error) };

  revalidateStorefront();
  redirect(`/admin/categories?saved=${encodeURIComponent(name)}`);
}

export async function deleteCategory(formData) {
  await assertAdmin();
  const { error } = await createSupabaseServerClient().from("categories").delete().eq("id", text(formData, "id"));
  if (error) redirect(`/admin/categories?error=${encodeURIComponent(friendlyDbError(error))}`);
  revalidateStorefront();
  redirect("/admin/categories");
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

const ADMIN_ORDER_STATUSES = ["paid", "shipped", "delivered", "cancelled"];
const orderUrl = (id, params) => `/admin/orders/${id}?${new URLSearchParams(params)}`;

function revalidateOrders() {
  revalidatePath("/admin", "layout");
  revalidatePath("/account", "layout");
}

// Status changes from the order page. Shipping records courier + tracking (and emails the customer);
// cancelling can put the items back into stock.
export async function updateOrderStatus(formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!ADMIN_ORDER_STATUSES.includes(status)) redirect(orderUrl(id, { error: "Choose a valid status." }));

  const supabase = createSupabaseServerClient();
  const { data: before } = await supabase.from("orders").select("status, paid_at, restocked").eq("id", id).single();
  if (!before || !before.paid_at || !["paid", "shipped", "delivered", "cancelled"].includes(before.status)) {
    redirect(orderUrl(id, { error: "Only paid orders can change status. For a UPI order, use Confirm payment received." }));
  }
  if (before.status === "cancelled" && before.restocked && status !== "cancelled") {
    redirect(orderUrl(id, { error: "This cancelled order's items were already returned to stock, so it can't be reopened." }));
  }

  const update = { status };
  if (status === "shipped") {
    update.tracking_courier = text(formData, "trackingCourier") || null;
    update.tracking_number = text(formData, "trackingNumber") || null;
    if (!update.tracking_courier || !update.tracking_number) {
      redirect(orderUrl(id, { error: "To mark it Shipped, enter the courier and tracking number (for hand delivery: courier \"Hand delivery\", tracking \"-\")." }));
    }
    if (before.status !== "shipped") update.shipped_at = new Date().toISOString();
  }
  const { error } = await supabase.from("orders").update(update).eq("id", id);
  if (error) redirect(orderUrl(id, { error: friendlyDbError(error) }));

  if (status === "cancelled" && formData.get("restock") === "on") await supabase.rpc("admin_restock_order", { p_order_id: id });
  if (status === "shipped" && before.status !== "shipped" && formData.get("notify") === "on") {
    const { data: order } = await supabase.from("orders").select(ORDER_EMAIL_COLUMNS).eq("id", id).single();
    if (order) await sendShippedEmail(order);
  }

  revalidateOrders();
  redirect(orderUrl(id, { saved: "1" }));
}

// Full refund through Razorpay. Partial refunds: use the Razorpay dashboard.
export async function refundOrder(formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const supabase = createSupabaseServerClient();
  const { data: order } = await supabase.from("orders").select("id, order_number, status, total_paise, razorpay_payment_id, refund_id").eq("id", id).single();

  if (!order) redirect("/admin/orders");
  if (order.refund_id || order.status === "refunded") redirect(orderUrl(id, { error: "This order has already been refunded." }));
  if (!order.razorpay_payment_id || !["paid", "shipped", "delivered", "cancelled"].includes(order.status)) {
    redirect(orderUrl(id, { error: "Only paid orders can be refunded." }));
  }
  if (!isRazorpayConfigured) redirect(orderUrl(id, { error: "Razorpay keys aren't set up, so refunds can't be issued from here." }));

  let refund;
  try {
    refund = await refundPayment({ paymentId: order.razorpay_payment_id, amountPaise: order.total_paise, notes: { order_number: order.order_number } });
  } catch (cause) {
    redirect(orderUrl(id, { error: cause.message }));
  }

  const { error } = await supabase.from("orders").update({
    status: "refunded",
    refund_id: refund.id,
    refund_amount_paise: refund.amount ?? order.total_paise,
    refunded_at: new Date().toISOString(),
  }).eq("id", id);
  // The money has moved even if this update fails, so say so plainly.
  if (error) redirect(orderUrl(id, { error: `Refund ${refund.id} was issued, but the order couldn't be updated: ${error.message}` }));

  if (formData.get("restock") === "on") await supabase.rpc("admin_restock_order", { p_order_id: id });
  revalidateOrders();
  redirect(orderUrl(id, { saved: "refunded" }));
}

// Direct-UPI order: the admin has checked the money arrived (bank/UPI app) and confirms it.
// SQL marks it paid and takes the items out of stock, exactly once; then the customer is emailed.
export async function confirmManualPayment(formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const supabase = createSupabaseServerClient();
  const { data: confirmed, error } = await supabase.rpc("admin_confirm_manual_payment", { p_order_id: id });
  if (error) redirect(orderUrl(id, { error: friendlyDbError(error) }));
  if (!confirmed) redirect(orderUrl(id, { error: "This order was already confirmed, or isn't an unpaid UPI order." }));

  const { data: order } = await supabase.from("orders").select(ORDER_EMAIL_COLUMNS).eq("id", id).single();
  if (order) await sendOrderEmails(order);
  revalidateOrders();
  revalidateStorefront();
  redirect(orderUrl(id, { saved: "upi-confirmed" }));
}

// Unpaid order (e.g. UPI never arrived): cancel it. Nothing to restock — stock only moves on payment.
export async function cancelUnpaidOrder(formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const { data, error } = await createSupabaseServerClient().from("orders")
    .update({ status: "cancelled" }).eq("id", id).eq("status", "pending").select("id");
  if (error) redirect(orderUrl(id, { error: friendlyDbError(error) }));
  if (!data?.length) redirect(orderUrl(id, { error: "Only unpaid orders can be cancelled this way." }));
  revalidateOrders();
  redirect(orderUrl(id, { saved: "1" }));
}

export async function restockOrder(formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const { data, error } = await createSupabaseServerClient().rpc("admin_restock_order", { p_order_id: id });
  if (error) redirect(orderUrl(id, { error: friendlyDbError(error) }));
  revalidateOrders();
  revalidateStorefront();
  redirect(orderUrl(id, data ? { saved: "restocked" } : { error: "Items were already returned to stock." }));
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

const ADJUST_REASONS = ["damaged", "lost", "sample", "recount", "other"];

// Manual stock change (+/−) with a reason: one ledger movement, never below zero (enforced in SQL).
export async function adjustStock(formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const back = `/admin/inventory/${id}`;
  const direction = text(formData, "direction") === "remove" ? -1 : 1;
  const qty = Number(text(formData, "qty"));
  const reason = text(formData, "reason");
  if (!Number.isInteger(qty) || qty <= 0) redirect(`${back}?error=${encodeURIComponent("Enter how many pieces, a whole number above 0.")}`);
  if (!ADJUST_REASONS.includes(reason)) redirect(`${back}?error=${encodeURIComponent("Choose a reason.")}`);
  const { error } = await createSupabaseServerClient().rpc("books_adjust_stock", {
    p_product_id: id, p_qty_change: direction * qty, p_reason: reason, p_note: text(formData, "note") || null,
  });
  if (error) redirect(`${back}?error=${encodeURIComponent(friendlyDbError(error))}`);
  revalidateStorefront();
  redirect(`${back}?saved=adjusted`);
}

// Manual cost price (until purchases set it by weighted average). Blank clears it.
export async function setCostPrice(formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const back = `/admin/inventory/${id}`;
  const cost = rupeesToPaise(text(formData, "cost"));
  if (Number.isNaN(cost)) redirect(`${back}?error=${encodeURIComponent("Cost must be an amount in rupees, e.g. 180 or 180.50.")}`);
  // ₹0 would make every sale look like 100% margin; blank (null) clears the cost instead.
  if (cost === 0) redirect(`${back}?error=${encodeURIComponent("Cost price must be more than ₹0. Leave it blank if you don't know it yet.")}`);
  const { error } = await createSupabaseServerClient().rpc("books_set_cost_price", { p_product_id: id, p_cost_paise: cost });
  if (error) redirect(`${back}?error=${encodeURIComponent(friendlyDbError(error))}`);
  revalidatePath("/admin", "layout");
  redirect(`${back}?saved=cost`);
}

// Per-product low-stock alert level (blank = shop default).
export async function setLowStockThreshold(formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const back = `/admin/inventory/${id}`;
  const raw = text(formData, "threshold");
  const threshold = raw === "" ? null : Number(raw);
  if (threshold !== null && (!Number.isInteger(threshold) || threshold < 0)) redirect(`${back}?error=${encodeURIComponent("Low-stock level must be a whole number, or blank.")}`);
  const { error } = await createSupabaseServerClient().from("products").update({ low_stock_threshold: threshold }).eq("id", id);
  if (error) redirect(`${back}?error=${encodeURIComponent(friendlyDbError(error))}`);
  revalidatePath("/admin", "layout");
  redirect(`${back}?saved=threshold`);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

// Rupee input → paise: rupeesToPaise from src/lib/books/money (exact, no floats; blank → null, invalid → NaN).

export async function saveShippingSettings(_prevState, formData) {
  await assertAdmin();
  const defaultPaise = rupeesToPaise(formData.get("defaultRupees"));
  const freeOverPaise = rupeesToPaise(formData.get("freeOverRupees"));
  if (defaultPaise == null || Number.isNaN(defaultPaise)) return { error: "Enter the standard delivery charge in rupees (0 for free)." };
  if (Number.isNaN(freeOverPaise)) return { error: "Free delivery threshold must be a number in rupees, or blank." };

  const byStatePaise = {};
  for (const state of indianStates) {
    const paise = rupeesToPaise(formData.get(`state:${state}`));
    if (Number.isNaN(paise)) return { error: `The charge for ${state} must be a number in rupees, or blank.` };
    if (paise != null) byStatePaise[state] = paise;
  }

  const { error } = await createSupabaseServerClient().from("settings")
    .upsert({ key: "shipping", value: { defaultPaise, freeOverPaise, byStatePaise } });
  if (error) return { error: friendlyDbError(error) };
  revalidateStorefront();
  return { saved: true };
}

// Sends one test email (to the address typed, else the signed-in admin) so the SMTP setup can be checked on the
// live site. Shows the mail server's own error if it fails.
export async function sendTestEmailAction(formData) {
  const admin = await assertAdmin();
  const to = text(formData, "to") || admin.user.email;
  const back = (params) => `/admin/settings?${new URLSearchParams(params)}#email`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) redirect(back({ email: "error", message: "Enter a valid email address." }));
  try {
    await sendTestEmail(to);
  } catch (cause) {
    redirect(back({ email: "error", message: String(cause?.message ?? cause).slice(0, 300) }));
  }
  redirect(back({ email: "sent", to }));
}
