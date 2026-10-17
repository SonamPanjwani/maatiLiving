import CartView from "@/components/cart/CartView";
import { getShippingSettings } from "@/src/lib/settings";

export const metadata = { title: "Your cart — Maati Living", robots: { index: false } };
export const revalidate = 60;

export default async function CartPage() {
  return <CartView shippingSettings={await getShippingSettings()} />;
}
