import Link from "next/link";
import LegalPage, { BusinessAddress, V } from "@/components/legal/LegalPage";
import { business } from "@/src/config/business";
import { siteConfig } from "@/src/config/site";

export const metadata = { alternates: { canonical: "/terms" }, title: "Terms & conditions", description: "The terms for buying from and using the Maati Living website." };

export default function TermsPage() {
  const officerEmail = business.grievanceOfficer.email ?? siteConfig.email;
  return <LegalPage eyebrow="POLICIES" title={<>Terms &<br /><em>conditions.</em></>} intro="The plain-language terms for shopping with us." path="/terms">
    <h2>About these terms</h2>
    <p>This website is run by <BusinessAddress />{business.gstin && <> (GSTIN {business.gstin})</>}. By using the site or placing an order, you agree to these terms, our <Link href="/privacy">privacy policy</Link>, <Link href="/shipping-policy">shipping policy</Link> and <Link href="/returns">returns policy</Link>.</p>

    <h2>Our products</h2>
    <p>Our products are handmade by artisans from natural materials. We photograph and describe them as accurately as we can, but colour, size, shape and finish will vary slightly from piece to piece and from what you see on screen. Diyas are for use with oil and a wick under supervision; never leave a lit diya unattended.</p>

    <h2>Prices and payment</h2>
    <p>Prices are in Indian Rupees and include any applicable taxes, unless shown otherwise. Delivery charges are shown at checkout before you pay. Payment is taken securely by Razorpay at checkout. We may change prices at any time, but the price you paid is the price for your order.</p>

    <h2>Your order</h2>
    <p>Your order is confirmed once payment succeeds and you see the confirmation page. Occasionally we may have to cancel an order, for example if an item turns out to be out of stock or was listed at a clearly wrong price. If that happens we'll tell you and refund you in full.</p>

    <h2>Delivery, returns and refunds</h2>
    <p>Delivery is covered by our <Link href="/shipping-policy">shipping policy</Link>. Cancellations, damaged items and refunds are covered by our <Link href="/returns">returns policy</Link>.</p>

    <h2>Accounts</h2>
    <p>You don't need an account to shop. If you create one, keep your password private and tell us if you think someone else has used your account.</p>

    <h2>Using this website</h2>
    <p>The text, photographs and design on this site belong to {business.tradeName} or the people who made them. Please don't copy them for commercial use without asking. Don't misuse the site, for example by trying to break its security or placing fake orders.</p>

    <h2>Our responsibility</h2>
    <p>We're responsible for supplying the products you order as described, and for the remedies in our returns policy. As far as the law allows, we aren't liable for indirect losses, or for delays caused by events beyond our reasonable control. Nothing in these terms limits your rights as a consumer under Indian law.</p>

    <h2>Complaints</h2>
    <p>Please talk to us first. Most things can be sorted out quickly on <a href={`https://wa.me/${siteConfig.whatsappNumber}`}>WhatsApp</a> or by email. For formal complaints, contact our grievance officer, <V>{business.grievanceOfficer.name}</V>, at <a href={`mailto:${officerEmail}`}>{officerEmail}</a>. We acknowledge complaints within 48 hours and aim to resolve them within one month.</p>

    <h2>Law</h2>
    <p>These terms are governed by the laws of India. Any dispute will be handled by the courts at <V>{business.jurisdictionCity}</V>, without affecting your right as a consumer to approach a consumer commission.</p>

    <h2>Changes</h2>
    <p>We may update these terms from time to time. The version on this page when you place an order applies to that order.</p>
  </LegalPage>;
}
