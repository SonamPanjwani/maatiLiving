import ShopListing from "@/components/shop/ShopListing";
import { getCategories, getProducts } from "@/src/lib/catalog";

export const revalidate = 60;

export const metadata = {
  title: "Shop — Maati Living",
  description: "Handcrafted terracotta diyas and coconut shell pieces, made by Indian artisans for everyday life.",
};

export default async function ShopPage() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  return <ShopListing
    eyebrow="THE SHOP"
    title={<>Everything we've<br /><em>chosen so far.</em></>}
    intro="Small batches from makers we know. Natural materials, made to be used."
    categories={categories}
    products={products}
  />;
}
