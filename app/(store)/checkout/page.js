import CheckoutForm from "@/components/cart/CheckoutForm";
import { isRazorpayConfigured, isRazorpayLive } from "@/src/lib/razorpay";
import { isSupabaseAdminConfigured } from "@/src/lib/supabase/admin";

export const metadata = { title: "Checkout — Maati Living", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  const paymentsEnabled = isRazorpayConfigured && isSupabaseAdminConfigured;
  return <section className="checkout section">
    <div className="section-heading"><div><p className="eyebrow">CHECKOUT</p><h1>Where should<br /><em>we send it?</em></h1></div></div>
    <CheckoutForm paymentsEnabled={paymentsEnabled} testMode={paymentsEnabled && !isRazorpayLive} />
  </section>;
}
