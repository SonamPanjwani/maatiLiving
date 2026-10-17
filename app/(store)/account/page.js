import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import AccountShell from "@/components/account/AccountShell";
import { requireCustomerPage } from "@/src/lib/auth";
import { formatPrice } from "@/src/lib/format";
import { STATUS_LABELS } from "@/src/lib/order-status";
import { claimGuestOrders } from "@/src/lib/orders";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const metadata = { title: "My orders — Maati Living", robots: { index: false } };

const CUSTOMER_STATUS = { ...STATUS_LABELS, paid: "Being prepared" };
const itemCount = (order) => order.order_items.reduce((sum, item) => sum + item.quantity, 0);
const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export default async function AccountOrdersPage() {
  const { user, profile } = await requireCustomerPage("/account");
  await claimGuestOrders(user); // earlier guest orders with this verified email
  const { data: orders } = await createSupabaseServerClient().from("orders")
    .select("id, order_number, status, total_paise, created_at, order_items(quantity)")
    .eq("user_id", user.id) // explicit: admins' RLS would otherwise return every order
    .in("status", ["paid", "shipped", "delivered", "cancelled", "refunded"])
    .order("created_at", { ascending: false });

  return <AccountShell active="/account" name={profile?.full_name} title={<>Your<br /><em>orders.</em></>}>
    {!orders?.length
      ? <div className="shop-empty"><p>No orders yet. When you buy something, it'll show up here.</p><Link className="text-link" href="/shop">Explore the shop <ArrowUpRight size={15} /></Link></div>
      : <ul className="account-orders">
          {orders.map((order) => <li key={order.id}>
            <Link href={`/account/orders/${order.order_number}`}>
              <span className="account-order-number">{order.order_number}</span>
              <span>{dateFormat.format(new Date(order.created_at))}</span>
              <span>{itemCount(order)} {itemCount(order) === 1 ? "item" : "items"}</span>
              <span>{formatPrice(order.total_paise)}</span>
              <span className="account-order-status">{CUSTOMER_STATUS[order.status]}</span>
            </Link>
          </li>)}
        </ul>}
  </AccountShell>;
}
