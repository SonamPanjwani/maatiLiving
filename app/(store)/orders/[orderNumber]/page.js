import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { getWhatsAppUrl } from "@/src/config/site";
import { formatPrice } from "@/src/lib/format";
import { getOrderForCustomer } from "@/src/lib/orders";
import { isSupabaseAdminConfigured } from "@/src/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your order — Maati Living", robots: { index: false, follow: false } };

const headings = {
  paid: { eyebrow: "ORDER CONFIRMED", title: <>Thank you.<br /><em>It's on its way soon.</em></>, copy: "We've received your payment and we're getting your order ready. We'll message you when it ships." },
  shipped: { eyebrow: "ORDER SHIPPED", title: <>It's<br /><em>on its way.</em></>, copy: "Your order has left us. It should reach you in a few days." },
  delivered: { eyebrow: "ORDER DELIVERED", title: <>Delivered.<br /><em>We hope you love it.</em></>, copy: "Thank you for choosing Maati Living." },
  pending: { eyebrow: "CONFIRMING PAYMENT", title: <>Just a<br /><em>moment.</em></>, copy: "We're waiting for the payment to be confirmed. Refresh this page in a minute — if money was taken, please don't pay again." },
  failed: { eyebrow: "PAYMENT NOT COMPLETED", title: <>The payment<br /><em>didn't go through.</em></>, copy: "No order was placed. Your cart is still saved, so you can try again." },
  cancelled: { eyebrow: "ORDER CANCELLED", title: <>This order<br /><em>was cancelled.</em></>, copy: "If you have questions, message us on WhatsApp." },
};

export default async function OrderPage({ params, searchParams }) {
  if (!isSupabaseAdminConfigured) notFound();
  const order = await getOrderForCustomer(params.orderNumber, searchParams?.t);
  if (!order) notFound();
  const heading = headings[order.status] ?? headings.pending;

  return <section className="order-page section">
    <div className="section-heading">
      <div><p className="eyebrow">{heading.eyebrow} · {order.order_number}</p><h1>{heading.title}</h1></div>
      <p>{heading.copy}</p>
    </div>

    <div className="cart-layout">
      <div>
        <ul className="checkout-items order-items">
          {order.order_items.map((item, index) => <li key={index}>
            <span>{item.product_slug ? <Link href={`/products/${item.product_slug}`}>{item.product_name}</Link> : item.product_name} × {item.quantity}</span>
            <span>{formatPrice(item.unit_price_paise * item.quantity)}</span>
          </li>)}
        </ul>
        <dl className="cart-totals">
          <div><dt>Subtotal</dt><dd>{formatPrice(order.subtotal_paise)}</dd></div>
          <div><dt>Delivery</dt><dd>{order.shipping_paise ? formatPrice(order.shipping_paise) : "Free"}</dd></div>
          <div className="cart-total"><dt>{order.status === "failed" || order.status === "pending" ? "Total" : "Total paid"}</dt><dd>{formatPrice(order.total_paise)}</dd></div>
        </dl>
      </div>
      <aside className="cart-summary">
        <p className="eyebrow">DELIVERING TO</p>
        <address className="order-address">
          {order.customer_name}<br />{order.address_line1}<br />{order.address_line2 && <>{order.address_line2}<br /></>}{order.city}, {order.state} {order.pincode}<br />{order.phone}
        </address>
        <a className="text-link" href={getWhatsAppUrl(`my order ${order.order_number}`)} target="_blank" rel="noreferrer">Questions? Message us <ArrowUpRight size={14} /></a>
        {order.status === "failed" ? <Link className="button button-dark cart-checkout" href="/checkout">Try again <ArrowUpRight size={16} /></Link>
          : <Link className="button button-dark cart-checkout" href="/shop">Keep browsing <ArrowUpRight size={16} /></Link>}
      </aside>
    </div>
  </section>;
}
