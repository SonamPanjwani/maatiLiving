import { notFound } from "next/navigation";
import OrderSummary, { orderHeading } from "@/components/orders/OrderSummary";
import UpiPaymentPanel from "@/components/orders/UpiPaymentPanel";
import { isUpiConfigured } from "@/src/config/payments";
import { getOrderForCustomer } from "@/src/lib/orders";
import { isSupabaseAdminConfigured } from "@/src/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your order", robots: { index: false, follow: false } };

// Guest-friendly order page: needs the order number plus its secret access token (?t=).
export default async function OrderPage({ params, searchParams }) {
  if (!isSupabaseAdminConfigured) notFound();
  const order = await getOrderForCustomer(params.orderNumber, searchParams?.t);
  if (!order) notFound();
  const heading = orderHeading(order);
  const showUpi = isUpiConfigured && order.payment_method === "upi_manual" && order.status === "pending";

  return <section className="order-page section">
    <div className="section-heading">
      <div><p className="eyebrow">{heading.eyebrow} · {order.order_number}</p><h1>{heading.title}</h1></div>
      <p>{heading.copy}</p>
    </div>
    {showUpi && <UpiPaymentPanel order={order} />}
    <OrderSummary order={order} />
  </section>;
}
