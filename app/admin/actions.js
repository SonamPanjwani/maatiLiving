"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/src/lib/auth";
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
  redirect("/admin/products");
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

export async function updateOrderStatus(formData) {
  await assertAdmin();
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!ADMIN_ORDER_STATUSES.includes(status)) redirect(`/admin/orders/${id}?error=${encodeURIComponent("Choose a valid status.")}`);
  const { error } = await createSupabaseServerClient().from("orders").update({ status }).eq("id", id);
  if (error) redirect(`/admin/orders/${id}?error=${encodeURIComponent(friendlyDbError(error))}`);
  revalidatePath("/admin/orders");
  redirect(`/admin/orders/${id}?saved=1`);
}
