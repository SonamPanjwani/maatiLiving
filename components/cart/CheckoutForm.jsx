"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Lock } from "lucide-react";
import { confirmPayment, reportPaymentFailed, startCheckout } from "@/app/(store)/checkout/actions";
import { indianStates } from "@/src/config/shop";
import { siteConfig } from "@/src/config/site";
import { formatPrice } from "@/src/lib/format";
import { CartTotals } from "./CartView";
import { useCart } from "./CartProvider";

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CheckoutForm({ paymentsEnabled, testMode }) {
  const router = useRouter();
  const { items, hydrated, subtotal, replace, clear } = useCart();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!hydrated) return <p className="cart-loading">Loading…</p>;
  if (items.length === 0) {
    return <div className="checkout-empty"><p>Your cart is empty.</p><Link className="button button-dark" href="/shop">Explore the shop <ArrowUpRight size={16} /></Link></div>;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const lines = items.map(({ productId, quantity, price }) => ({ productId, quantity, price }));

    const started = await startCheckout({ lines, customer: form }).catch(() => ({ error: "Something went wrong. Please try again." }));
    if (started.error) {
      if (started.quote) replace(started.quote.lines);
      setError(started.error);
      setBusy(false);
      return;
    }

    if (!(await loadRazorpay())) {
      setError("Couldn't load the payment window. Check your connection and try again.");
      setBusy(false);
      return;
    }

    const razorpay = new window.Razorpay({
      key: started.keyId,
      order_id: started.razorpayOrderId,
      amount: started.amount,
      currency: "INR",
      name: siteConfig.name,
      description: `Order ${started.orderNumber}`,
      prefill: started.prefill,
      theme: { color: "#A13D2E" },
      handler: async (response) => {
        const result = await confirmPayment(response).catch(() => ({ error: "We couldn't confirm the payment. Please don't pay again — we'll check and get back to you." }));
        if (result.ok) {
          clear();
          router.push(result.url);
        } else {
          setError(`${result.error} (Order ${started.orderNumber})`);
          setBusy(false);
        }
      },
      modal: { ondismiss: () => setBusy(false) },
    });
    razorpay.on("payment.failed", (response) => {
      reportPaymentFailed(started.razorpayOrderId);
      setError(response?.error?.description ? `Payment failed: ${response.error.description}` : "Payment failed. You can try again.");
      setBusy(false);
    });
    razorpay.open();
  };

  return <form className="checkout-layout" onSubmit={onSubmit}>
    <div className="checkout-fields">
      <fieldset>
        <legend className="eyebrow">CONTACT</legend>
        <label className="field"><span>Full name</span><input name="name" autoComplete="name" required /></label>
        <div className="field-row">
          <label className="field"><span>Email</span><input name="email" type="email" autoComplete="email" required /></label>
          <label className="field"><span>Mobile</span><input name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="10-digit number" required /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend className="eyebrow">DELIVERY ADDRESS</legend>
        <label className="field"><span>House / flat, street</span><input name="addressLine1" autoComplete="address-line1" required /></label>
        <label className="field"><span>Area, landmark <small>optional</small></span><input name="addressLine2" autoComplete="address-line2" /></label>
        <div className="field-row">
          <label className="field"><span>City</span><input name="city" autoComplete="address-level2" required /></label>
          <label className="field"><span>PIN code</span><input name="pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} pattern="[1-9][0-9]{5}" required /></label>
        </div>
        <label className="field"><span>State</span>
          <select name="state" autoComplete="address-level1" defaultValue="" required>
            <option value="" disabled>Choose your state</option>
            {indianStates.map((state) => <option key={state}>{state}</option>)}
          </select>
        </label>
        <label className="field"><span>Note for us <small>optional — gifting, delivery instructions</small></span><textarea name="notes" rows={2} /></label>
      </fieldset>
    </div>

    <aside className="cart-summary">
      <p className="eyebrow">YOUR ORDER</p>
      <ul className="checkout-items">
        {items.map((item) => <li key={item.productId}><span>{item.name} × {item.quantity}</span><span>{formatPrice(item.price * item.quantity)}</span></li>)}
      </ul>
      <CartTotals subtotal={subtotal} />
      {error && <p className="admin-error" role="alert">{error}</p>}
      {paymentsEnabled
        ? <button type="submit" className="button button-dark cart-checkout" disabled={busy}><Lock size={14} /> {busy ? "Opening payment…" : "Pay securely"}</button>
        : <p className="checkout-disabled">Online payment isn't switched on yet. Please order through <a className="text-link" href={`https://wa.me/${siteConfig.whatsappNumber}`} target="_blank" rel="noreferrer">WhatsApp</a> for now.</p>}
      {testMode && <p className="checkout-test">Test mode — no real money is charged.</p>}
      <p className="checkout-secure">Payments by Razorpay: UPI, cards, netbanking and wallets.</p>
      <Link className="text-link" href="/cart">Back to cart</Link>
    </aside>
  </form>;
}
