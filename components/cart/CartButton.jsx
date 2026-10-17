"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./CartProvider";

export default function CartButton({ className = "nav-cart", onClick }) {
  const { count, hydrated } = useCart();
  const label = hydrated && count > 0 ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Cart";
  return <Link href="/cart" className={className} aria-label={label} onClick={onClick}>
    <ShoppingBag size={15} />
    <span>Cart</span>
    {hydrated && count > 0 && <span className="nav-cart-count">{String(count).padStart(2, "0")}</span>}
  </Link>;
}
