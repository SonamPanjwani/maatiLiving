import Link from "next/link";
import CloudImage from "@/components/common/CloudImage";
import TextilePlaceholder from "@/components/common/TextilePlaceholder";
import { ArrowUpRight } from "lucide-react";
import { isCloudinaryConfigured } from "@/src/config/cloudinary";
import { formatPrice } from "@/src/lib/format";

const placeholderVariants = ["indigo", "rust", "moss"];

export default function ProductCard({ product, index }) {
  const cover = product.images[0] ?? { publicId: "", alt: product.name };
  const href = `/products/${product.slug}`;
  return <article className="product-card">
    <Link href={href} className="product-image-wrap" tabIndex={-1} aria-hidden="true">{isCloudinaryConfigured && cover.publicId ? <CloudImage src={cover.publicId} alt={cover.alt} fill sizes="(max-width: 700px) 84vw, 30vw" crop="fill" gravity="auto" format="auto" quality="auto" /> : <TextilePlaceholder variant={placeholderVariants[index % placeholderVariants.length]} label={cover.alt} />}<span className="product-index">{product.stock === 0 ? "SOLD OUT" : String(index + 1).padStart(2, "0")}</span></Link>
    <div className="product-meta"><span className="eyebrow">{product.category?.name}</span><h3><Link href={href}>{product.name}</Link></h3><span className="price">{formatPrice(product.price)}</span><p>{product.sourcingNote}</p><Link className="whatsapp-link" href={href}>View piece <ArrowUpRight size={15} /></Link></div>
  </article>;
}
