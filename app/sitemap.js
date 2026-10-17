import { siteUrl } from "@/src/config/seo";
import { getCategories, getProducts } from "@/src/lib/catalog";

export const revalidate = 3600;

const STATIC_PAGES = [
  ["/", 1, "weekly"],
  ["/shop", 0.9, "daily"],
  ["/about", 0.6, "monthly"],
  ["/contact", 0.5, "yearly"],
  ["/shipping-policy", 0.3, "yearly"],
  ["/returns", 0.3, "yearly"],
  ["/terms", 0.2, "yearly"],
  ["/privacy", 0.2, "yearly"],
];

export default async function sitemap() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  return [
    ...STATIC_PAGES.map(([path, priority, changeFrequency]) => ({ url: `${siteUrl}${path}`, priority, changeFrequency })),
    ...categories.map((category) => ({ url: `${siteUrl}/shop/${category.slug}`, priority: 0.7, changeFrequency: "weekly" })),
    ...products.map((product) => ({ url: `${siteUrl}/products/${product.slug}`, priority: 0.8, changeFrequency: "weekly" })),
  ];
}
