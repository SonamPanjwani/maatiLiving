import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import ProductCard from "@/components/home/ProductCard";
import ProductGallery from "@/components/shop/ProductGallery";
import { cloudinaryConfig } from "@/src/config/cloudinary";
import { getWhatsAppUrl } from "@/src/config/site";
import { getCategories, getProductBySlug, getProducts, getRelatedProducts } from "@/src/lib/catalog";
import { formatPrice } from "@/src/lib/format";

export const revalidate = 60;

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }) {
  const product = await getProductBySlug(params.slug);
  if (!product) return {};
  const cover = product.images[0]?.publicId;
  const ogImage = cover && cloudinaryConfig.cloudName
    ? `https://res.cloudinary.com/${cloudinaryConfig.cloudName}/image/upload/c_fill,g_auto,w_1200,h_630,f_jpg,q_auto/${cover}`
    : undefined;
  return {
    title: `${product.name} — Maati Living`,
    description: product.shortDescription || undefined,
    openGraph: { title: product.name, description: product.shortDescription || undefined, images: ogImage ? [ogImage] : undefined },
  };
}

function stockLabel(stock) {
  if (stock === 0) return { text: "Sold out — ask us about the next batch", tone: "out" };
  if (stock <= 5) return { text: "A few left in this batch", tone: "low" };
  return { text: "In stock", tone: "in" };
}

export default async function ProductPage({ params }) {
  const product = await getProductBySlug(params.slug);
  if (!product) notFound();
  const [categories, related] = await Promise.all([getCategories(), getRelatedProducts(product)]);

  const parent = categories.find((category) => category.slug === product.category?.parentSlug);
  const stock = stockLabel(product.stock);
  const facts = [
    ["Materials", product.materials.join(", ")],
    ["Made by", product.artisan],
    ["Region", product.region],
    ["Care", product.care],
    ["SKU", product.sku],
  ].filter(([, value]) => value);

  return <>
    <section className="product-detail">
      <ProductGallery images={product.images} name={product.name} />

      <div className="product-info">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/shop">Shop</Link>
          {parent && <><span aria-hidden="true">/</span><Link href={`/shop/${parent.slug}`}>{parent.name}</Link></>}
          {product.category && <><span aria-hidden="true">/</span><Link href={`/shop/${product.category.slug}`}>{product.category.name}</Link></>}
        </nav>
        <h1>{product.name}</h1>
        {product.sourcingNote && <p className="product-sourcing">{product.sourcingNote}</p>}
        <p className="product-price">{formatPrice(product.price)}</p>
        {product.shortDescription && <p className="product-description">{product.shortDescription}</p>}

        <p className={`product-stock product-stock-${stock.tone}`}>{stock.text}</p>
        <a className="button button-dark product-cta" href={getWhatsAppUrl(product.name)} target="_blank" rel="noreferrer">Enquire on WhatsApp <ArrowUpRight size={16} /></a>
        <p className="product-cta-note">We take orders on WhatsApp for now. Online checkout is coming soon.</p>

        {facts.length > 0 && <dl className="product-facts">
          {facts.map(([label, value]) => <div key={label}><dt className="eyebrow">{label}</dt><dd>{value}</dd></div>)}
        </dl>}
      </div>
    </section>

    {related.length > 0 && <section className="collection section">
      <div className="section-heading"><div><p className="eyebrow">YOU MAY ALSO LIKE</p><h2>More to<br /><em>bring home.</em></h2></div></div>
      <div className="product-grid">{related.map((item, index) => <ProductCard product={item} index={index} key={item.id} />)}</div>
    </section>}
  </>;
}
