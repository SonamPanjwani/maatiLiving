"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Check, Copy } from "lucide-react";
import SubmitButton from "@/components/admin/SubmitButton";
import { submitPaymentReference } from "@/app/(store)/checkout/actions";

export function CopyUpiId({ upiId }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked: the ID is visible to copy by hand */ }
  };
  return <>
    <button type="button" className="upi-copy" onClick={copy}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? "Copied" : "Copy"}<span className="sr-only"> UPI ID</span>
    </button>
    <span className="sr-only" role="status">{copied ? "UPI ID copied" : ""}</span>
  </>;
}

export default function UpiReferenceForm({ orderNumber, token, existingReference }) {
  const [state, formAction] = useFormState(submitPaymentReference, {});
  if (state?.saved || existingReference) {
    return <p className="admin-success" role="status">Thank you. We've got your transaction ID{existingReference && !state?.saved ? ` (${existingReference})` : ""}. We'll check the payment and confirm your order, usually within a few hours.</p>;
  }
  return <form action={formAction} className="account-form upi-ref-form">
    <input type="hidden" name="orderNumber" value={orderNumber} />
    <input type="hidden" name="token" value={token} />
    <label className="field"><span>UPI transaction ID <small>12-digit UTR from your payment app (under transaction details)</small></span>
      <input name="reference" type="text" inputMode="numeric" pattern="\d{12}" maxLength={12} title="12-digit UTR number" autoComplete="off" placeholder="e.g. 412345678901" required />
    </label>
    {state?.error && <p className="admin-error" role="alert">{state.error}</p>}
    <SubmitButton pendingLabel="Sending…">I've paid</SubmitButton>
  </form>;
}
