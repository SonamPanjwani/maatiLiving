"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Lock } from "lucide-react";
import { confirmPayment, reportPaymentFailed, startCheckout } from "@/app/(store)/checkout/actions";
import { siteConfig } from "@/src/config/site";
import { formatPrice } from "@/src/lib/format";
import AddressFields from "@/components/account/AddressFields";
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

// account: { email, name, phone, addresses[] } for a signed-in customer, else null (guest checkout).
export default function CheckoutForm({ paymentsEnabled, testMode, account = null }) {
  const router = useRouter();
  const { items, hydrated, subtotal, replace, clear } = useCart();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const saved = account?.addresses ?? [];
  const initial = saved.find((address) => address.is_default) ?? saved[0] ?? null;
  const [addressId, setAddressId] = useState(initial?.id ?? "new");
  const [state, setState] = useState(initial?.state ?? "");
  const selected = saved.find((address) => address.id === addressId) ?? null;
  // Contact defaults: the chosen saved address, else the profile.
  const contact = selected ?? { name: account?.name ?? "", phone: account?.phone ?? "" };

  // Name/phone stay as typed unless a saved address supplies them (email is never touched).
  const nameRef = useRef(null);
  const phoneRef = useRef(null);
  const chooseAddress = (id) => {
    const address = saved.find((item) => item.id === id);
    setAddressId(id);
    setState(address?.state ?? "");
    if (address && nameRef.current) nameRef.current.value = address.name;
    if (address && phoneRef.current) phoneRef.current.value = address.phone;
  };

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
      {!account && <p className="checkout-signin">Continue as a guest, or <Link className="inline-link" href="/account/login?next=/checkout">sign in</Link> to use saved addresses and keep your order history.</p>}

      {saved.length > 0 && <fieldset>
        <legend className="eyebrow">DELIVER TO</legend>
        <div className="saved-addresses">
          {saved.map((address) => <label key={address.id} className={address.id === addressId ? "is-selected" : ""}>
            <input type="radio" name="savedAddress" value={address.id} checked={address.id === addressId} onChange={() => chooseAddress(address.id)} />
            <span><strong>{address.name}</strong> · {address.line1}, {address.city}, {address.state} {address.pincode}</span>
          </label>)}
          <label className={addressId === "new" ? "is-selected" : ""}>
            <input type="radio" name="savedAddress" value="new" checked={addressId === "new"} onChange={() => chooseAddress("new")} />
            <span>A new address</span>
          </label>
        </div>
      </fieldset>}

      <fieldset>
        <legend className="eyebrow">CONTACT</legend>
        <div className="field-row">
          <label className="field"><span>Full name</span><input ref={nameRef} name="name" defaultValue={contact.name} autoComplete="name" required /></label>
          <label className="field"><span>Mobile</span><input ref={phoneRef} name="phone" type="tel" inputMode="numeric" defaultValue={contact.phone} autoComplete="tel-national" placeholder="10-digit number" required /></label>
        </div>
        <label className="field"><span>Email <small>for your order confirmation</small></span><input name="email" type="email" defaultValue={account?.email ?? ""} autoComplete="email" required /></label>
      </fieldset>
      {/* key remounts the address inputs with the chosen saved address as defaults */}
      <fieldset key={`address-${addressId}`}>
        <legend className="eyebrow">DELIVERY ADDRESS</legend>
        <AddressFields address={selected ?? {}} includeContact={false} stateValue={state} onStateChange={setState} />
        {account && addressId === "new" && <div className="field-checks"><label><input type="checkbox" name="saveAddress" defaultChecked /> Save this address to my account</label></div>}
        <label className="field"><span>Note for us <small>optional — gifting, delivery instructions</small></span><textarea name="notes" rows={2} /></label>
      </fieldset>
    </div>

    <aside className="cart-summary">
      <p className="eyebrow">YOUR ORDER</p>
      <ul className="checkout-items">
        {items.map((item) => <li key={item.productId}><span>{item.name} × {item.quantity}</span><span>{formatPrice(item.price * item.quantity)}</span></li>)}
      </ul>
      <CartTotals subtotal={subtotal} state={state || null} />
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
