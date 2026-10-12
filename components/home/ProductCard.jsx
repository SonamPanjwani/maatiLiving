import CloudImage from "@/components/common/CloudImage";
import TextilePlaceholder from "@/components/common/TextilePlaceholder";
import WhatsAppLink from "@/components/common/WhatsAppLink";
import { isCloudinaryConfigured } from "@/src/config/cloudinary";
import { formatPrice } from "@/src/lib/format";

const placeholderVariants = ["indigo", "rust", "moss"];

export default function ProductCard({ product, index }) {
  const cover = product.images[0] ?? { publicId: "", alt: product.name };
  return <article className="product-card">
    <div className="product-image-wrap">{isCloudinaryConfigured && cover.publicId ? <CloudImage src={cover.publicId} alt={cover.alt} fill sizes="(max-width: 700px) 84vw, 30vw" crop="fill" gravity="auto" format="auto" quality="auto" /> : <TextilePlaceholder variant={placeholderVariants[index % placeholderVariants.length]} label={cover.alt} />}<span className="product-index">{String(index + 1).padStart(2, "0")}</span></div>
    <div className="product-meta"><span className="eyebrow">{product.category?.name}</span><h3>{product.name}</h3><span className="price">{formatPrice(product.price)}</span><p>{product.sourcingNote}</p><WhatsAppLink productName={product.name} /></div>
  </article>;
}
