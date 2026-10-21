"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updatePaymentAllocation } from "@/app/admin/(panel)/books/payments/actions";
import AllocationTable, { allocationSummary, useAllocation } from "@/components/books/AllocationTable";
import { paiseToRupeeInput } from "@/src/lib/books/money";
import { formatPrice } from "@/src/lib/format";

function Submit({ onConfirm }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="button button-dark" disabled={pending} onClick={onConfirm}>{pending ? "Saving…" : "Save allocation"}</button>;
}

// Change which bills an existing payment covers. items already include this payment's own amounts as open.
export default function PaymentAllocationForm({ payment, items, today }) {
  const [state, formAction] = useFormState(updatePaymentAllocation, {});
  const initial = Object.fromEntries(payment.allocations.map((a) => [a.purchase_id ?? "opening", paiseToRupeeInput(a.amount_paise)]));
  const allocation = useAllocation(items, payment.amount_paise, initial);

  const onConfirm = (event) => {
    if (allocation.check.error) { event.preventDefault(); window.alert(allocation.check.error); return; }
    if (!window.confirm(`Change what ${payment.number} (${formatPrice(payment.amount_paise)}) pays for?\n\n${allocationSummary(allocation, items, payment.amount_paise)}`)) event.preventDefault();
  };

  return <form action={formAction} className="admin-form admin-form-wide">
    <input type="hidden" name="id" value={payment.id} />
    <AllocationTable items={items} allocation={allocation} amountPaise={payment.amount_paise} today={today} />
    {state?.error && <p className="admin-error" role="alert">{state.error}</p>}
    {items.length > 0 && <div className="admin-form-actions">
      <Submit onConfirm={onConfirm} />
      <button type="button" className="text-link" onClick={allocation.reset}>Undo changes</button>
    </div>}
  </form>;
}
