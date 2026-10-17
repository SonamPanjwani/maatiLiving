import Link from "next/link";
import LegalPage, { BusinessAddress, V } from "@/components/legal/LegalPage";
import { business } from "@/src/config/business";
import { siteConfig } from "@/src/config/site";

export const metadata = { alternates: { canonical: "/privacy" }, title: "Privacy policy", description: "What personal data Maati Living collects, why, who it is shared with and your rights." };

export default function PrivacyPage() {
  const officerEmail = business.grievanceOfficer.email ?? siteConfig.email;
  return <LegalPage eyebrow="POLICIES" title={<>Privacy<br /><em>policy.</em></>} intro="We collect only what we need to get your order to you, and we never sell it." path="/privacy">
    <h2>Who we are</h2>
    <p>This website is run by <BusinessAddress /> ("we", "us"). We are responsible for the personal data described here.</p>

    <h2>What we collect</h2>
    <ul>
      <li><strong>When you order:</strong> your name, email, mobile number, delivery address and any note you add.</li>
      <li><strong>If you create an account:</strong> your name, email, a securely hashed password, and any addresses and phone number you save.</li>
      <li><strong>Payments:</strong> handled by Razorpay. We receive a payment reference and status. We never see or store your full card, UPI or bank details.</li>
      <li><strong>Your cart:</strong> stored in your own browser (local storage) so it's there when you come back. It isn't sent to us until you check out.</li>
      <li><strong>Sign-in:</strong> if you sign in, a cookie keeps you signed in. We don't use advertising or tracking cookies.</li>
    </ul>

    <h2>Why we use it</h2>
    <p>To process and deliver your order, send order and delivery updates, handle returns and refunds, answer your questions, keep your account working, and meet our legal and tax obligations. We don't send marketing messages unless you ask us to.</p>

    <h2>Who we share it with</h2>
    <p>Only the service providers that run this shop, and only what each one needs:</p>
    <ul>
      <li><strong>Razorpay</strong>: payments and refunds.</li>
      <li><strong>Couriers</strong>: your name, address and phone number, to deliver your order.</li>
      <li><strong>Supabase</strong>: secure hosting for our database and accounts.</li>
      <li><strong>Cloudinary</strong>: product images. No personal data.</li>
      <li><strong>Our email provider</strong>: to send order emails.</li>
      <li><strong>Our website host</strong>: to run this website.</li>
    </ul>
    <p>Some of these providers may store data outside India, with safeguards in place. We don't sell or rent your personal data. We share it with authorities only when the law requires it.</p>

    <h2>How long we keep it</h2>
    <p>We keep order records for as long as tax and accounting law requires, usually up to 8 years. Account details are kept until you ask us to delete your account.</p>

    <h2>Your rights</h2>
    <p>Under India's Digital Personal Data Protection Act, 2023 you can ask us to see the personal data we hold about you, correct it, or erase it (where we don't have to keep it by law). You can also withdraw consent and nominate someone to act for you. You can update your name, phone and addresses yourself in <Link href="/account/profile">My account</Link>. For anything else, write to us using the details below.</p>

    <h2>Security</h2>
    <p>The site uses HTTPS. Passwords are stored securely (hashed) by our sign-in provider, and access to order data is limited to the people who fulfil orders.</p>

    <h2>Grievance officer</h2>
    <p>If you have a concern about your data or an order, contact our grievance officer, <V>{business.grievanceOfficer.name}</V>, at <a href={`mailto:${officerEmail}`}>{officerEmail}</a>. We acknowledge complaints within 48 hours and aim to resolve them within one month.</p>

    <h2>Changes</h2>
    <p>If we change this policy, we'll update this page and the date below.</p>
  </LegalPage>;
}
