"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Minus, Plus, X } from "lucide-react";
import CloudImage from "@/components/common/CloudImage";
import TextilePlaceholder from "@/components/common/TextilePlaceholder";
import { refreshCart } from "@/app/(store)/checkout/actions";
import { isCloudinaryConfigured } from "@/src/config/cloudinary";
import { shippingFor, shopConfig } from "@/src/config/shop";
import { formatPrice } from "@/src/lib/format";
import { useCart } from "./CartProvider";

export function CartLineImage({ item }) {
  return <Link href={`/products/${item.slug}`} className="cart-line-image" tabIndex={-1} aria-hidden="true">
    {isCloudinaryConfigured && item.imagePublicId
      ? <CloudImage src={item.imagePublicId} alt="" width={160} height={200} crop="fill" gravity="auto" format="auto" quality="auto" />
      : <TextilePlaceholder variant="rust" label={item.name} />}
  </Link>;
}

// state: delivery state if known. Without it, delivery shows "calculated at checkout".
// shipping: settings from the server (getShippingSettings), so display matches what's charged.
export function CartTotals({ subtotal, state = null, shippingSettings }) {
  const shipping = shippingFor(subtotal, state, shippingSettings);
  const free = shippingSettings?.freeOverPaise;
  return <dl className="cart-totals">
    <div><dt>Subtotal</dt><dd>{formatPrice(subtotal)}</dd></div>
    <div><dt>Delivery</dt><dd>{shipping === null ? (state ? "—" : "Calculated at checkout") : shipping ? formatPrice(shipping) : "Free"}</dd></div>
    {free != null && shipping !== 0 && <p className="cart-free-note">Free delivery on orders from {formatPrice(free)}.</p>}
    <div className="cart-total"><dt>{shipping === null ? "Total before delivery" : "Total"}</dt><dd>{formatPrice(subtotal + (shipping ?? 0))}</dd></div>
  </dl>;
}

export default function CartView({ shippingSettings }) {
  const { items, hydrated, subtotal, setQuantity, remove, replace } = useCart();
  const [notices, setNotices] = useState([]);
  const [checked, setChecked] = useState(false);

  // Once per visit to the cart: pull current prices and stock from the server.
  useEffect(() => {
    if (!hydrated || checked) return;
    setChecked(true);
    if (items.length === 0) return;
    refreshCart(items.map(({ productId, quantity }) => ({ productId, quantity })))
      .then((quote) => {
        const priceChanged = quote.lines.some((line) => items.find((item) => item.productId === line.productId)?.price !== line.price);
        replace(quote.lines);
        setNotices([...quote.notices, ...(priceChanged ? ["Some prices have changed since you added them."] : [])]);
      })
      .catch(() => {});
  }, [hydrated, checked, items, replace]);

  if (!hydrated) return <section className="cart section"><p className="cart-loading">Loading your cart…</p></section>;

  if (items.length === 0) {
    return <section className="cart section">
      <div className="section-heading"><div><p className="eyebrow">YOUR CART</p><h1>Nothing here<br /><em>yet.</em></h1></div></div>
      <Link className="button button-dark" href="/shop">Explore the shop <ArrowUpRight size={16} /></Link>
    </section>;
  }

  return <section className="cart section">
    <div className="section-heading"><div><p className="eyebrow">YOUR CART</p><h1>Almost <em>home.</em></h1></div></div>
    {notices.length > 0 && <ul className="cart-notices" role="status">{notices.map((notice) => <li key={notice}>{notice}</li>)}</ul>}

    <div className="cart-layout">
      <ul className="cart-lines">
        {items.map((item) => <li key={item.productId} className="cart-line">
          <CartLineImage item={item} />
          <div className="cart-line-info">
            <h3><Link href={`/products/${item.slug}`}>{item.name}</Link></h3>
            <p>{formatPrice(item.price)}</p>
            <div className="qty-stepper" role="group" aria-label={`Quantity of ${item.name}`}>
              <button type="button" onClick={() => setQuantity(item.productId, item.quantity - 1)} disabled={item.quantity <= 1} aria-label="Decrease quantity"><Minus size={14} /></button>
              <span aria-live="polite">{item.quantity}</span>
              <button type="button" onClick={() => setQuantity(item.productId, item.quantity + 1)} disabled={item.quantity >= Math.min(item.maxQuantity ?? shopConfig.maxQuantityPerItem, shopConfig.maxQuantityPerItem)} aria-label="Increase quantity"><Plus size={14} /></button>
            </div>
          </div>
          <div className="cart-line-end">
            <span>{formatPrice(item.price * item.quantity)}</span>
            <button type="button" className="cart-remove" onClick={() => remove(item.productId)} aria-label={`Remove ${item.name}`}><X size={14} /> Remove</button>
          </div>
        </li>)}
      </ul>

      <aside className="cart-summary">
        <p className="eyebrow">SUMMARY</p>
        <CartTotals subtotal={subtotal} shippingSettings={shippingSettings} />
        <Link className="button button-dark cart-checkout" href="/checkout">Checkout <ArrowUpRight size={16} /></Link>
        <Link className="text-link" href="/shop">Keep browsing</Link>
      </aside>
    </div>
  </section>;
}
