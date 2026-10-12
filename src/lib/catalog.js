// Single entry point for catalogue data. Async on purpose: in Phase 2 these
// bodies become Supabase queries and callers stay unchanged.
import { categories } from "@/src/data/categories";
import { products } from "@/src/data/products";

const bySortOrder = (a, b) => a.sortOrder - b.sortOrder;

function withCategory(product) {
  return { ...product, category: categories.find((category) => category.slug === product.categorySlug) ?? null };
}

export async function getCategories() {
  return [...categories].sort(bySortOrder);
}

export async function getCategoryBySlug(slug) {
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function getProducts({ categorySlug } = {}) {
  return products
    .filter((product) => product.available && (!categorySlug || product.categorySlug === categorySlug))
    .map(withCategory);
}

export async function getFeaturedProducts() {
  return products.filter((product) => product.available && product.featured).map(withCategory);
}

export async function getProductBySlug(slug) {
  const product = products.find((item) => item.slug === slug);
  return product ? withCategory(product) : null;
}
