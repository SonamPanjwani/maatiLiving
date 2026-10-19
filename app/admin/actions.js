"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { indianStates } from "@/src/config/shop";
import { assertAdmin } from "@/src/lib/auth";
import { ORDER_EMAIL_COLUMNS, sendOrderEmails, sendShippedEmail } from "@/src/lib/email";
import { isRazorpayConfigured, refundPayment } from "@/src/lib/razorpay";
import { slugify } from "@/src/lib/slugify";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

const text = (formData, key) => String(formData.get(key) ?? "").trim();

function friendlyDbError(error) {
  if (error.code === "23505") return "That slug or SKU is already used by another item.";
  if (error.code === "23503") return "This category still has products in it — move or delete them first.";
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
  const { error } = await supabase.auth.signInWithPassword({ email: text(formData, "email"), password: String(formData.get("password") ?? "") });
  if (error) return { error: "Email or password is incorrect." };

  const { data: { user } } = await supabase.auth.getUser();
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
  const price = Number(text(formData, "price"));
  const stock = Number(text(formData, "stock") || 0);
  const images = parseImages(formData.get("images"));

  if (!name) return { error: "Please give the product a name." };
  if (!slug) return { error: "Please give the product a slug (used in its web address)." };
  if (!text(formData, "categoryId")) return { error: "Please choose a category." };
  if (!Number.isFinite(price) || price < 0) return { error: "Price must be a number in rupees, e.g. 450." };
  if (!Number.isInteger(stock) || stock < 0) return { error: "Stock must be a whole number, 0 or more." };

  const row = {
    name,
    slug,
    category_id: text(formData, "categoryId"),
    price_paise: Math.round(price * 100),
    stock,
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
  const { error } = await createSupabaseServerClient().from("products").delete().eq("id", text(formData, "id"));
  if (error) throw new Error(friendlyDbError(error));
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

export async function updateStock(formData) {
  await assertAdmin();
  const stock = Number(text(formData, "stock"));
  const back = text(formData, "back") || "/admin/inventory";
  if (!Number.isInteger(stock) || stock < 0) redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent("Stock must be a whole number, 0 or more.")}`);
  const { error } = await createSupabaseServerClient().from("products").update({ stock }).eq("id", text(formData, "id"));
  if (error) redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent(friendlyDbError(error))}`);
  revalidateStorefront();
  redirect(back);
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

// Rupee input → paise integer; blank → null.
function rupeesToPaise(value) {
  const raw = String(value ?? "").trim();
  if (raw === "") return null;
  const rupees = Number(raw);
  return Number.isFinite(rupees) && rupees >= 0 ? Math.round(rupees * 100) : NaN;
}

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
