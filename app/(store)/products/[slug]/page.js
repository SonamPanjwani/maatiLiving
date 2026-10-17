import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import AddToCart from "@/components/cart/AddToCart";
import ProductCard from "@/components/home/ProductCard";
import ProductGallery from "@/components/shop/ProductGallery";
import { jsonLd, ogImageUrl, siteUrl } from "@/src/config/seo";
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
  const ogImage = ogImageUrl(product.images[0]?.publicId);
  const path = `/products/${product.slug}`;
  return {
    title: product.name,
    description: product.shortDescription || undefined,
    alternates: { canonical: path },
    openGraph: { type: "website", url: path, title: product.name, description: product.shortDescription || undefined, images: ogImage ? [ogImage] : undefined },
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

  // Structured data for search results (price, availability, images).
  const structured = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription || undefined,
    sku: product.sku || undefined,
    image: product.images.map((image) => ogImageUrl(image.publicId)).filter(Boolean),
    material: product.materials.join(", ") || undefined,
    brand: { "@type": "Brand", name: "Maati Living" },
    category: product.category?.name,
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/products/${product.slug}`,
      priceCurrency: "INR",
      price: (product.price / 100).toFixed(2),
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured)} />
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
        <AddToCart product={{ id: product.id, slug: product.slug, name: product.name, price: product.price, stock: product.stock, images: product.images.slice(0, 1) }} />
        <p className="product-cta-note">Questions about this piece? <a className="text-link" href={getWhatsAppUrl(product.name)} target="_blank" rel="noreferrer">Ask us on WhatsApp <ArrowUpRight size={13} /></a></p>

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
