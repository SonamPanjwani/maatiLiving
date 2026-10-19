import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import ProductCard from "@/components/home/ProductCard";
import CategoryNav from "./CategoryNav";

export default function ShopListing({ eyebrow, title, intro, categories, activeSlug, products }) {
  return <>
    <section className="shop-header section">
      <div className="section-heading">
        <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>
        {intro && <p>{intro}</p>}
      </div>
      <CategoryNav categories={categories} activeSlug={activeSlug} />
    </section>
    <section className="shop-products section">
      {products.length > 0
        ? <>
            <p className="shop-count">{`${products.length} ${products.length === 1 ? "piece" : "pieces"}`}</p>
            <div className="product-grid">{products.map((product, index) => <ProductCard product={product} index={index} key={product.id} />)}</div>
          </>
        : <div className="shop-empty"><p>Nothing here just yet — we're still finding the right makers.</p>{activeSlug && <Link className="text-link" href="/shop">See everything <ArrowUpRight size={15} /></Link>}</div>}
    </section>
  </>;
}
