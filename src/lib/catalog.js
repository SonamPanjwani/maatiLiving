// Single entry point for storefront catalogue data. Reads Supabase when it is
// configured, otherwise the placeholder files in src/data/. Both paths return
// the same shape (see CLAUDE.md → Catalogue data model).
import { categories as staticCategories } from "@/src/data/categories";
import { products as staticProducts } from "@/src/data/products";
import { isSupabaseConfigured } from "@/src/lib/supabase/config";
import { getSupabasePublicClient } from "@/src/lib/supabase/public";

export const CATEGORY_COLUMNS = "id, slug, name, description, parent_id, image_public_id, image_alt, sort_order, parent:parent_id(slug)";
export const PRODUCT_COLUMNS = `id, slug, name, price_paise, stock, short_description, sourcing_note, materials, artisan, region, care,
  is_available, is_featured, sku, category:category_id(${CATEGORY_COLUMNS}), product_images(public_id, alt, sort_order)`;

export function mapCategory(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    parentSlug: row.parent?.slug ?? null,
    parentId: row.parent_id ?? null,
    image: { publicId: row.image_public_id ?? "", alt: row.image_alt ?? row.name },
    sortOrder: row.sort_order,
  };
}

export function mapProduct(row) {
  const category = mapCategory(row.category);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    categorySlug: category?.slug ?? null,
    category,
    price: row.price_paise,
    stock: row.stock,
    shortDescription: row.short_description ?? "",
    sourcingNote: row.sourcing_note ?? "",
    images: [...(row.product_images ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((image) => ({ publicId: image.public_id, alt: image.alt })),
    materials: row.materials ?? [],
    artisan: row.artisan ?? "",
    region: row.region ?? "",
    care: row.care ?? "",
    available: row.is_available,
    featured: row.is_featured,
    sku: row.sku ?? "",
  };
}

const bySortOrder = (a, b) => a.sortOrder - b.sortOrder;

function withStaticCategory(product) {
  return { ...product, category: staticCategories.find((category) => category.slug === product.categorySlug) ?? null };
}

function throwOnError({ data, error }) {
  if (error) throw new Error(`Catalogue query failed: ${error.message}`);
  return data;
}

export async function getCategories() {
  if (!isSupabaseConfigured) return [...staticCategories].sort(bySortOrder);
  const rows = throwOnError(await getSupabasePublicClient().from("categories").select(CATEGORY_COLUMNS).order("sort_order"));
  return rows.map(mapCategory);
}

export async function getCategoryBySlug(slug) {
  if (!isSupabaseConfigured) return staticCategories.find((category) => category.slug === slug) ?? null;
  const row = throwOnError(await getSupabasePublicClient().from("categories").select(CATEGORY_COLUMNS).eq("slug", slug).maybeSingle());
  return mapCategory(row);
}

export async function getProducts({ categorySlug } = {}) {
  if (!isSupabaseConfigured) {
    return staticProducts
      .filter((product) => product.available && (!categorySlug || product.categorySlug === categorySlug))
      .map(withStaticCategory);
  }
  let query = getSupabasePublicClient().from("products").select(PRODUCT_COLUMNS).eq("is_available", true).order("created_at");
  if (categorySlug) {
    const category = await getCategoryBySlug(categorySlug);
    if (!category) return [];
    query = query.eq("category_id", category.id);
  }
  return throwOnError(await query).map(mapProduct);
}

export async function getFeaturedProducts() {
  if (!isSupabaseConfigured) return staticProducts.filter((product) => product.available && product.featured).map(withStaticCategory);
  const rows = throwOnError(await getSupabasePublicClient().from("products").select(PRODUCT_COLUMNS).eq("is_available", true).eq("is_featured", true).order("created_at"));
  return rows.map(mapProduct);
}

export async function getProductBySlug(slug) {
  if (!isSupabaseConfigured) {
    const product = staticProducts.find((item) => item.slug === slug);
    return product ? withStaticCategory(product) : null;
  }
  const row = throwOnError(await getSupabasePublicClient().from("products").select(PRODUCT_COLUMNS).eq("slug", slug).eq("is_available", true).maybeSingle());
  return row ? mapProduct(row) : null;
}
