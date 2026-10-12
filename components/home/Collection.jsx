import { products } from "@/src/data/products";
import ProductCard from "./ProductCard";

export default function Collection() {
  return <section id="collection" className="collection section"><div className="section-heading"><div><p className="eyebrow">THE MAATI EDIT</p><h2>Things worth<br />bringing home.</h2></div><p>Thoughtfully discovered.<br />Carefully considered.<br />Made for everyday life.</p></div><div className="product-grid">{products.map((product, index) => <ProductCard product={product} index={index} key={product.id} />)}</div></section>;
}
