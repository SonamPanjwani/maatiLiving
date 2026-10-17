import Link from "next/link";
import LegalPage from "@/components/legal/LegalPage";
import { business } from "@/src/config/business";
import { siteConfig } from "@/src/config/site";

export const metadata = { alternates: { canonical: "/returns" }, title: "Returns, refunds & cancellations", description: "Maati Living's policy on cancellations, damaged items, returns and refunds." };

export default function ReturnsPage() {
  const { policies } = business;
  return <LegalPage eyebrow="POLICIES" title={<>Returns<br /><em>& refunds.</em></>} intro="Handmade things vary a little, and we want you to be happy with yours." path="/returns">
    <h2>Handmade means a little different</h2>
    <p>Our diyas and coconut shell pieces are made by hand from natural materials. Small variations in colour, shape, texture and size are part of their character, not defects, and no two pieces are exactly alike.</p>

    <h2>Cancelling an order</h2>
    <p>You can cancel any time <strong>before your order is dispatched</strong> by messaging us on <a href={`https://wa.me/${siteConfig.whatsappNumber}`}>WhatsApp</a> or emailing <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a> with your order number. We'll refund the full amount. Once an order has been dispatched it can't be cancelled, but the returns options below may apply.</p>

    <h2>Damaged, broken or wrong items</h2>
    <p>If something arrives damaged, broken, defective or isn't what you ordered, tell us within <strong>{policies.damageReportWithinHours} hours</strong> of delivery. Send your order number, a photo of the item and a photo of the packaging. Once we've seen them, we'll send a replacement (if we have one in stock) or a full refund for that item, whichever you prefer. You won't need to pay anything to send it back, and for broken items we usually won't need it back at all.</p>

    <h2>Other returns</h2>
    {policies.changeOfMindReturns
      ? <p>If you change your mind, you can return unused items in their original packaging within <strong>{policies.returnWindowDays} days</strong> of delivery. Message us first so we can arrange it. Return shipping is paid by you unless the item was faulty. We refund the item price once it reaches us in good condition.</p>
      : <p>Because our pieces are handmade and fragile, we can't accept returns for a change of mind. If you're unsure about a piece before buying, <a href={`https://wa.me/${siteConfig.whatsappNumber}`}>ask us on WhatsApp</a> and we'll happily send more photos or details.</p>}

    <h2>How refunds are paid</h2>
    <p>Approved refunds go back to your <strong>original payment method</strong> (UPI, card, netbanking or wallet) through our payment partner, Razorpay. We issue them within <strong>{policies.refundWithinDays} working days</strong> of approving them. Your bank may then take a further 5–7 working days to show the money in your account.</p>
    <p>Delivery charges are refunded when the whole order is cancelled before dispatch, or when the problem was our mistake.</p>

    <h2>How to reach us</h2>
    <p>For anything about returns or refunds, contact us on <a href={`https://wa.me/${siteConfig.whatsappNumber}`}>WhatsApp</a> or at <a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>. More options are on the <Link href="/contact">contact page</Link>.</p>
  </LegalPage>;
}
