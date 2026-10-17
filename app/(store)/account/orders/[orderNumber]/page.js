import { notFound } from "next/navigation";
import OrderSummary, { orderHeading } from "@/components/orders/OrderSummary";
import { requireCustomerPage } from "@/src/lib/auth";
import { ORDER_COLUMNS } from "@/src/lib/orders";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const metadata = { title: "Order — Maati Living", robots: { index: false } };

export default async function AccountOrderPage({ params }) {
  const { user } = await requireCustomerPage(`/account/orders/${params.orderNumber}`);
  // RLS limits customers to their own orders; the user_id filter also keeps admins to their own here.
  const { data: order } = await createSupabaseServerClient().from("orders").select(ORDER_COLUMNS)
    .eq("order_number", params.orderNumber).eq("user_id", user.id).maybeSingle();
  if (!order) notFound();
  const heading = orderHeading(order.status);

  return <section className="order-page section">
    <div className="section-heading">
      <div><p className="eyebrow">{heading.eyebrow} · {order.order_number}</p><h1>{heading.title}</h1></div>
      <p>{heading.copy}</p>
    </div>
    <OrderSummary order={order} backHref="/account" backLabel="All my orders" />
  </section>;
}
