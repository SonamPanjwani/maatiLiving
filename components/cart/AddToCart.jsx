"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Minus, Plus } from "lucide-react";
import { shopConfig } from "@/src/config/shop";
import { useCart } from "./CartProvider";

export default function AddToCart({ product }) {
  const { items, add } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const inCart = items.find((item) => item.productId === product.id)?.quantity ?? 0;
  const max = Math.max(0, Math.min(product.stock, shopConfig.maxQuantityPerItem) - inCart);

  if (product.stock === 0) return <button type="button" className="button button-dark product-cta" disabled>Sold out</button>;

  const onAdd = () => {
    add(product, quantity);
    setAdded(true);
    setQuantity(1);
  };

  return <div className="add-to-cart">
    <div className="add-to-cart-row">
      <div className="qty-stepper" role="group" aria-label="Quantity">
        <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="Decrease quantity"><Minus size={14} /></button>
        <span aria-live="polite">{quantity}</span>
        <button type="button" onClick={() => setQuantity((q) => Math.min(max, q + 1))} disabled={quantity >= max} aria-label="Increase quantity"><Plus size={14} /></button>
      </div>
      <button type="button" className="button button-dark product-cta" onClick={onAdd} disabled={max === 0}>{max === 0 ? "All in your cart" : "Add to cart"}</button>
    </div>
    {added && <p className="add-to-cart-added" role="status">Added to your cart. <Link className="text-link" href="/cart">View cart <ArrowUpRight size={14} /></Link></p>}
  </div>;
}
