import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getWhatsAppOrderUrl } from "@/src/config/site";
import { formatPrice } from "@/src/lib/format";

const HEADINGS = {
  paid: { eyebrow: "ORDER CONFIRMED", title: <>Thank you.<br /><em>It's on its way soon.</em></>, copy: "We've received your payment and we're getting your order ready. We'll message you when it ships." },
  shipped: { eyebrow: "ORDER SHIPPED", title: <>It's<br /><em>on its way.</em></>, copy: "Your order has left us. It should reach you in a few days." },
  delivered: { eyebrow: "ORDER DELIVERED", title: <>Delivered.<br /><em>We hope you love it.</em></>, copy: "Thank you for choosing Maati Living." },
  pending: { eyebrow: "CONFIRMING PAYMENT", title: <>Just a<br /><em>moment.</em></>, copy: "We're waiting for the payment to be confirmed. Refresh this page in a minute — if money was taken, please don't pay again." },
  failed: { eyebrow: "PAYMENT NOT COMPLETED", title: <>The payment<br /><em>didn't go through.</em></>, copy: "No order was placed. Your cart is still saved, so you can try again." },
  cancelled: { eyebrow: "ORDER CANCELLED", title: <>This order<br /><em>was cancelled.</em></>, copy: "If you have questions, message us on WhatsApp." },
  refunded: { eyebrow: "ORDER REFUNDED", title: <>Your refund<br /><em>is on its way.</em></>, copy: "We've refunded this order to your original payment method. Banks usually take 5–7 working days to show it." },
};

const UPI_HEADINGS = {
  awaiting: { eyebrow: "ORDER PLACED · PAYMENT DUE", title: <>Order placed.<br /><em>Now, the payment.</em></>, copy: "Pay by UPI below. We'll confirm your order and start packing as soon as your payment reaches us. Please keep this page open or bookmark it until you've paid." },
  checking: { eyebrow: "CHECKING PAYMENT", title: <>Thank you.<br /><em>We're checking it.</em></>, copy: "We've got your transaction ID and will confirm your order shortly, usually within a few hours." },
};

// Heading for an order page; direct-UPI orders waiting for payment get their own wording.
export function orderHeading(order) {
  if (order.status === "pending" && order.payment_method === "upi_manual") return order.payment_reference ? UPI_HEADINGS.checking : UPI_HEADINGS.awaiting;
  return HEADINGS[order.status] ?? HEADINGS.pending;
}

// Items, totals and delivery address for one order (customer-facing).
export default function OrderSummary({ order, backHref = "/shop", backLabel = "Keep browsing" }) {
  const unpaid = order.status === "failed" || order.status === "pending";
  const isUpi = order.payment_method === "upi_manual";
  return <div className="cart-layout">
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
        <div className="cart-total"><dt>{unpaid ? (isUpi ? "To pay" : "Total") : "Total paid"}</dt><dd>{formatPrice(order.total_paise)}</dd></div>
        {order.refund_amount_paise != null && <div><dt>Refunded</dt><dd>{formatPrice(order.refund_amount_paise)}</dd></div>}
      </dl>
    </div>
    <aside className="cart-summary">
      {order.tracking_number && ["shipped", "delivered"].includes(order.status) && <div className="order-tracking">
        <p className="eyebrow">TRACKING</p>
        <p>{order.tracking_courier || "Courier"}<br /><strong>{order.tracking_number}</strong></p>
      </div>}
      <p className="eyebrow">DELIVERING TO</p>
      <address className="order-address">
        {order.customer_name}<br />{order.address_line1}<br />{order.address_line2 && <>{order.address_line2}<br /></>}{order.city}, {order.state} {order.pincode}<br />{order.phone}
      </address>
      <a className="text-link" href={getWhatsAppOrderUrl(order.order_number)} target="_blank" rel="noreferrer">Questions? Message us <ArrowUpRight size={14} /></a>
      {order.status === "failed"
        ? <Link className="button button-dark cart-checkout" href="/checkout">Try again <ArrowUpRight size={16} /></Link>
        : <Link className="button button-dark cart-checkout" href={backHref}>{backLabel} <ArrowUpRight size={16} /></Link>}
    </aside>
  </div>;
}
