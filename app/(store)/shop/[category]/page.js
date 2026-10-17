import { notFound } from "next/navigation";
import ShopListing from "@/components/shop/ShopListing";
import { getCategories, getCategoryBySlug, getProducts } from "@/src/lib/catalog";

export const revalidate = 60;

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }) {
  const category = await getCategoryBySlug(params.category);
  if (!category) return {};
  return { title: category.name, description: category.description || undefined, alternates: { canonical: `/shop/${category.slug}` } };
}

export default async function CategoryPage({ params }) {
  const [category, categories, products] = await Promise.all([
    getCategoryBySlug(params.category),
    getCategories(),
    getProducts({ categorySlug: params.category }),
  ]);
  if (!category) notFound();

  const parent = categories.find((item) => item.slug === category.parentSlug);
  return <ShopListing
    eyebrow={parent ? `THE SHOP / ${parent.name}` : "THE SHOP"}
    title={category.name}
    intro={category.description}
    categories={categories}
    activeSlug={category.slug}
    products={products}
  />;
}
