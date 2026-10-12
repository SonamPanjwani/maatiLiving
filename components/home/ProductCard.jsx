import CloudImage from "@/components/common/CloudImage";
import TextilePlaceholder from "@/components/common/TextilePlaceholder";
import WhatsAppLink from "@/components/common/WhatsAppLink";
import { isCloudinaryConfigured } from "@/src/config/cloudinary";

const placeholderVariants = ["indigo", "rust", "moss"];

export default function ProductCard({ product, index }) {
  return <article className="product-card">
    <div className="product-image-wrap">{isCloudinaryConfigured && product.images[0].publicId ? <CloudImage src={product.images[0].publicId} alt={product.images[0].alt} fill sizes="(max-width: 700px) 84vw, 30vw" crop="fill" gravity="auto" format="auto" quality="auto" /> : <TextilePlaceholder variant={placeholderVariants[index % placeholderVariants.length]} label={product.images[0].alt} />}<span className="product-index">{String(index + 1).padStart(2, "0")}</span></div>
    <div className="product-meta"><span className="eyebrow">{product.category}</span><h3>{product.name}</h3><span className="price">{product.price}</span><p>{product.sourcingNote}</p><WhatsAppLink productName={product.name} /></div>
  </article>;
}
