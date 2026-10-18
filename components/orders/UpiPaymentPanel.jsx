import QRCode from "qrcode";
import { ArrowUpRight } from "lucide-react";
import { upiConfig, upiPayUrl } from "@/src/config/payments";
import { siteConfig } from "@/src/config/site";
import { formatPrice } from "@/src/lib/format";
import UpiReferenceForm, { CopyUpiId } from "./UpiReferenceForm";

// "Pay by UPI" block for an unpaid direct-UPI order: amount, UPI ID, app link (phones), QR (laptops),
// then the transaction-id form. Shown on the order page until the admin confirms the payment.
export default async function UpiPaymentPanel({ order }) {
  const payUrl = upiPayUrl({ amountPaise: order.total_paise, orderNumber: order.order_number });
  // dark = --charcoal (the SVG is generated as a string, so the token can't be referenced here)
  const qrSvg = await QRCode.toString(payUrl, { type: "svg", margin: 1, color: { dark: "#2A2622", light: "#00000000" } });
  const whatsappText = `Hi Maati Living, I've paid ${formatPrice(order.total_paise)} by UPI for order ${order.order_number}. Sharing the screenshot.`;

  return <section className="upi-panel" aria-labelledby="upi-heading">
    <div className="upi-panel-pay">
      <h2 id="upi-heading" className="eyebrow">PAY BY UPI</h2>
      <p className="upi-amount">{formatPrice(order.total_paise)}</p>
      <p className="upi-to">to <strong>{upiConfig.payeeName}</strong></p>
      <div className="upi-id"><code>{upiConfig.id}</code><CopyUpiId upiId={upiConfig.id} /></div>
      <a className="button button-dark upi-app-button" href={payUrl}>Pay with UPI app <ArrowUpRight size={16} /></a>
      <p className="admin-note upi-app-note">Opens PhonePe, Google Pay, Paytm or BHIM with the amount filled in. If your app shows an error, copy the UPI ID above and pay it directly. Please add <strong>{order.order_number}</strong> in the note.</p>
    </div>
    <div className="upi-panel-qr">
      <div className="upi-qr" role="img" aria-label={`UPI QR code to pay ${formatPrice(order.total_paise)} to ${upiConfig.payeeName}`} dangerouslySetInnerHTML={{ __html: qrSvg }} />
      <p className="admin-note">On a laptop? Scan this with any UPI app on your phone.</p>
    </div>
    <div className="upi-panel-confirm">
      <h3 className="eyebrow">AFTER PAYING</h3>
      <UpiReferenceForm orderNumber={order.order_number} token={order.access_token} existingReference={order.payment_reference} />
      <p className="admin-note">Or <a className="inline-link" href={`https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(whatsappText)}`} target="_blank" rel="noreferrer">send us the payment screenshot on WhatsApp</a>.</p>
    </div>
  </section>;
}
