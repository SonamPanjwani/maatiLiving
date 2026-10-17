import CheckoutForm from "@/components/cart/CheckoutForm";
import { getCurrentUser } from "@/src/lib/auth";
import { getShippingSettings } from "@/src/lib/settings";
import { isRazorpayConfigured, isRazorpayLive } from "@/src/lib/razorpay";
import { isSupabaseAdminConfigured } from "@/src/lib/supabase/admin";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

export const metadata = { title: "Checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

// Signed-in customers get their profile and saved addresses pre-filled; guests get an empty form.
async function loadAccount() {
  const current = await getCurrentUser();
  if (!current) return null;
  const { data: addresses } = await createSupabaseServerClient().from("addresses")
    .select("id, name, phone, line1, line2, city, state, pincode, is_default")
    .eq("user_id", current.user.id)
    .order("is_default", { ascending: false }).order("created_at");
  return { email: current.user.email, name: current.profile?.full_name ?? "", phone: current.profile?.phone ?? "", addresses: addresses ?? [] };
}

export default async function CheckoutPage() {
  const paymentsEnabled = isRazorpayConfigured && isSupabaseAdminConfigured;
  const [account, shippingSettings] = await Promise.all([loadAccount(), getShippingSettings()]);
  return <section className="checkout section">
    <div className="section-heading"><div><p className="eyebrow">CHECKOUT</p><h1>Where should<br /><em>we send it?</em></h1></div></div>
    <CheckoutForm paymentsEnabled={paymentsEnabled} testMode={paymentsEnabled && !isRazorpayLive} account={account} shippingSettings={shippingSettings} />
  </section>;
}
