import Link from "next/link";
import LegalPage from "@/components/legal/LegalPage";
import { business } from "@/src/config/business";
import { siteConfig } from "@/src/config/site";
import { getShippingSettings } from "@/src/lib/settings";
import { formatPrice } from "@/src/lib/format";

export const metadata = { alternates: { canonical: "/shipping-policy" }, title: "Shipping policy", description: "How and when Maati Living orders are packed, shipped and delivered across India." };
export const revalidate = 300;

export default async function ShippingPolicyPage() {
  const { policies } = business;
  const shipping = await getShippingSettings();
  return <LegalPage eyebrow="POLICIES" title={<>Shipping<br /><em>policy.</em></>} intro="How we pack, send and deliver your order." path="/shipping-policy">
    <h2>Where we deliver</h2>
    <p>We currently deliver to addresses within India. We don't ship internationally yet.</p>

    <h2>When your order leaves us</h2>
    <p>Every piece is checked and packed by hand. We aim to dispatch orders within <strong>{policies.dispatchWithinDays} working days</strong> of payment. During festivals (especially around Diwali) this can take a little longer, and we'll tell you if it does.</p>

    <h2>How long delivery takes</h2>
    <p>Once dispatched, most orders arrive in <strong>{policies.deliveryDays} working days</strong>, depending on your location and the courier. Remote areas can take longer.</p>

    <h2>Delivery charges</h2>
    <p>Delivery charges depend on your state and are shown at checkout before you pay. The standard charge is {formatPrice(shipping.defaultPaise)}{shipping.freeOverPaise != null && <>, and delivery is free on orders of {formatPrice(shipping.freeOverPaise)} or more</>}.</p>

    <h2>Tracking your order</h2>
    <p>When your order ships, we add the courier and tracking number to your order page and let you know. If you have an account, you'll find it under <Link href="/account">My account</Link>.</p>

    <h2>If something arrives damaged</h2>
    <p>Terracotta and coconut shell are natural materials, and we pack them carefully. If anything arrives broken or damaged, please tell us within <strong>{policies.damageReportWithinHours} hours</strong> of delivery with a photo of the item and the packaging. Message us on <a href={`https://wa.me/${siteConfig.whatsappNumber}`}>WhatsApp</a> or email <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>. We'll send a replacement or refund it, as explained in our <Link href="/returns">returns policy</Link>.</p>

    <h2>Wrong or incomplete address</h2>
    <p>Please check your address and PIN code at checkout. If a parcel comes back because the address was wrong or nobody could receive it, we'll contact you to arrange re-delivery. An extra delivery charge may apply.</p>

    <h2>Questions</h2>
    <p>Write to us at <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> or see our <Link href="/contact">contact page</Link>. Dispatch and delivery times are our best estimates and can vary. We can't control courier delays, but we'll always help you follow up.</p>
  </LegalPage>;
}
