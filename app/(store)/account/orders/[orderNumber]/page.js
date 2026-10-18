import { notFound } from "next/navigation";
import OrderSummary, { orderHeading } from "@/components/orders/OrderSummary";
import UpiPaymentPanel from "@/components/orders/UpiPaymentPanel";
import { isUpiConfigured } from "@/src/config/payments";
import { requireCustomerPage } from "@/src/lib/auth";
import { ORDER_COLUMNS } from "@/src/lib/orders";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const metadata = { title: "Order", robots: { index: false } };

export default async function AccountOrderPage({ params }) {
  const { user } = await requireCustomerPage(`/account/orders/${params.orderNumber}`);
  // RLS limits customers to their own orders; the user_id filter also keeps admins to their own here.
  const { data: order } = await createSupabaseServerClient().from("orders").select(ORDER_COLUMNS)
    .eq("order_number", params.orderNumber).eq("user_id", user.id).maybeSingle();
  if (!order) notFound();
  const heading = orderHeading(order);
  const showUpi = isUpiConfigured && order.payment_method === "upi_manual" && order.status === "pending";

  return <section className="order-page section">
    <div className="section-heading">
      <div><p className="eyebrow">{heading.eyebrow} · {order.order_number}</p><h1>{heading.title}</h1></div>
      <p>{heading.copy}</p>
    </div>
    {showUpi && <UpiPaymentPanel order={order} />}
    <OrderSummary order={order} backHref="/account" backLabel="All my orders" />
  </section>;
}
