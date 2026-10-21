import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import ProductCard from "@/components/home/ProductCard";
import CategoryNav from "./CategoryNav";

// Pieces per category slug, counting sub-categories into their parent; "all" = everything visible.
function categoryCounts(categories, allProducts) {
  const parentOf = new Map(categories.map((category) => [category.slug, category.parentSlug ?? null]));
  const counts = { all: allProducts.length };
  for (const category of categories) counts[category.slug] = 0;
  for (const product of allProducts) {
    for (let slug = product.categorySlug; slug; slug = parentOf.get(slug)) counts[slug] = (counts[slug] ?? 0) + 1;
  }
  return counts;
}

// The category chips sit between the heading and the products, sticky under the header while the list scrolls.
export default function ShopListing({ eyebrow, title, intro, categories, activeSlug, products, allProducts = products }) {
  return <>
    <section className="shop-header section">
      <div className="section-heading">
        <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>
        {intro && <p>{intro}</p>}
      </div>
    </section>
    <div className="shop-body">
      <CategoryNav categories={categories} activeSlug={activeSlug} counts={categoryCounts(categories, allProducts)} />
      <section className="shop-products section">
        {products.length > 0
          ? <>
              <p className="shop-count">{`${products.length} ${products.length === 1 ? "piece" : "pieces"}`}</p>
              <div className="product-grid">{products.map((product, index) => <ProductCard product={product} index={index} key={product.id} />)}</div>
            </>
          : <div className="shop-empty"><p>Nothing here just yet — we're still finding the right makers.</p>{activeSlug && <Link className="text-link" href="/shop">See everything <ArrowUpRight size={15} /></Link>}</div>}
      </section>
    </div>
  </>;
}
