"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { recordPayment } from "@/app/admin/(panel)/books/payments/actions";
import AllocationTable, { allocationSummary, useAllocation } from "@/components/books/AllocationTable";
import BillUploader from "@/components/books/BillUploader";
import { CopyUpiId } from "@/components/orders/UpiReferenceForm";
import { paiseToRupeeInput, rupeesToPaise } from "@/src/lib/books/money";
import { PAYMENT_METHODS } from "@/src/lib/books/payments";
import { formatDate, formatPrice } from "@/src/lib/format";

function Submit({ onConfirm }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="button button-dark" disabled={pending} onClick={onConfirm}>{pending ? "Saving…" : "Record payment"}</button>;
}

// Record a payment to a vendor. vendors: [{ id, name, upiId, balancePaise, items }] (items = open bills, oldest first).
// From a purchase (defaultPurchaseId) the amount starts at that bill's balance, allocated to it.
export default function PaymentForm({ vendors, defaultVendorId = "", defaultPurchaseId = "", today, cancelHref }) {
  const [state, formAction] = useFormState(recordPayment, {});
  const [vendorId, setVendorId] = useState(defaultVendorId);
  const vendor = vendors.find((v) => v.id === vendorId);
  const items = vendor?.items ?? [];
  const startItem = items.find((item) => item.key === defaultPurchaseId);
  const [amount, setAmount] = useState(startItem ? paiseToRupeeInput(startItem.balancePaise) : "");
  const [method, setMethod] = useState("upi");
  const amountPaise = rupeesToPaise(amount);
  const validAmount = Number.isInteger(amountPaise) && amountPaise > 0 ? amountPaise : 0;
  // Starts on the purchase it came from (if any); changing the vendor goes back to oldest first.
  const allocation = useAllocation(items, validAmount, startItem && vendorId === defaultVendorId ? { [startItem.key]: paiseToRupeeInput(startItem.balancePaise) } : null);

  const onConfirm = (event) => {
    const form = event.currentTarget.form;
    if (!form.reportValidity()) { event.preventDefault(); return; }
    if (allocation.check.error) { event.preventDefault(); window.alert(allocation.check.error); return; }
    const paidOn = form.elements.paidOn.value;
    const message = `Record ${formatPrice(validAmount)} paid to ${vendor?.name} by ${PAYMENT_METHODS[method]} on ${formatDate(paidOn)}?\n\n${allocationSummary(allocation, items, validAmount)}\n\nA payment can't be edited later. If it's wrong, void it (with a reason) and record it again.`;
    if (!window.confirm(message)) event.preventDefault();
  };

  return <form action={formAction} className="admin-form admin-form-wide books-form payment-form">
    <fieldset>
      <legend className="eyebrow">PAYMENT</legend>
      <label className="field" htmlFor="pay-vendor"><span>Paid to</span>
        <select id="pay-vendor" name="vendorId" value={vendorId} onChange={(event) => { setVendorId(event.target.value); allocation.fillOldest(); }} required>
          <option value="" disabled>Choose a vendor</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}{v.balancePaise > 0 ? ` — ${formatPrice(v.balancePaise)} due` : v.balancePaise < 0 ? ` — ${formatPrice(-v.balancePaise)} advance` : ""}</option>)}
        </select>
      </label>
      {vendor && <p className="admin-note vendor-pay-hint">
        {vendor.balancePaise > 0 ? <>Balance due <strong>{formatPrice(vendor.balancePaise)}</strong>.</> : vendor.balancePaise < 0 ? <>{formatPrice(-vendor.balancePaise)} already paid in advance.</> : "Nothing due right now."}
        {vendor.upiId && <span className="vendor-upi"><code>{vendor.upiId}</code><CopyUpiId upiId={vendor.upiId} /></span>}
      </p>}
      <div className="field-row">
        <label className="field" htmlFor="pay-amount"><span>Amount (₹)</span>
          <input id="pay-amount" name="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required
            pattern="\s*₹?\s*[0-9,]+(\.[0-9]{1,2})?\s*" title="An amount in rupees, e.g. 2500 or 2500.50" placeholder="0" /></label>
        <label className="field" htmlFor="pay-date"><span>Paid on</span><input id="pay-date" name="paidOn" type="date" defaultValue={today} max={today} required /></label>
      </div>
      <fieldset className="segmented">
        <legend className="segmented-label">Paid by</legend>
        {Object.entries(PAYMENT_METHODS).map(([value, label]) => <label key={value}><input type="radio" name="method" value={value} checked={method === value} onChange={() => setMethod(value)} /> {label}</label>)}
      </fieldset>
      <label className="field" htmlFor="pay-ref"><span>{method === "upi" || method === "bank" ? "UTR / transaction ID" : "Reference"} <small>optional</small></span><input id="pay-ref" name="reference" maxLength={80} autoComplete="off" /></label>
    </fieldset>

    <fieldset>
      <legend className="eyebrow">WHICH BILLS IT PAYS <small>oldest first unless you change it</small></legend>
      {vendor
        ? <AllocationTable items={items} allocation={allocation} amountPaise={validAmount} today={today} />
        : <p className="admin-note">Choose a vendor to see their open bills.</p>}
    </fieldset>

    <fieldset>
      <legend className="eyebrow">PROOF & NOTES</legend>
      <BillUploader label="Payment screenshot or receipt" max={10} note="Private: only admins can open these." />
      <label className="field" htmlFor="pay-notes"><span>Notes <small>internal</small></span><textarea id="pay-notes" name="notes" rows={2} maxLength={2000} /></label>
    </fieldset>

    {state?.error && <p className="admin-error" role="alert">{state.error}</p>}
    <div className="admin-form-actions sticky-save">
      <Submit onConfirm={onConfirm} />
      <a className="text-link" href={cancelHref}>Cancel</a>
    </div>
  </form>;
}
