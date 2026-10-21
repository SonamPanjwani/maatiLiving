"use client";

import { useFormStatus } from "react-dom";

const REASON_LABELS = { recount: "Recount", damaged: "Damaged / broken", lost: "Lost", sample: "Sample / gift", other: "Other" };

// "Save adjustment": validates, then confirms with a summary, e.g. "Remove 3 pieces of Diya Set (Damaged / broken)?"
export default function AdjustStockSubmit({ productName, currentStock }) {
  const { pending } = useFormStatus();
  const onClick = (event) => {
    const form = event.currentTarget.form;
    if (!form.reportValidity()) { event.preventDefault(); return; }
    const remove = form.elements.direction.value === "remove";
    const qty = Number(form.elements.qty.value);
    const after = currentStock + (remove ? -qty : qty);
    const message = `${remove ? "Remove" : "Add"} ${qty} ${qty === 1 ? "piece" : "pieces"} ${remove ? "from" : "to"} ${productName} (${REASON_LABELS[form.elements.reason.value] ?? form.elements.reason.value})?\n\nStock goes from ${currentStock} to ${after}. This is recorded in the stock history and can't be edited later.`;
    if (!window.confirm(message)) event.preventDefault();
  };
  return <button type="submit" className="button button-dark" onClick={onClick} disabled={pending}>{pending ? "Saving…" : "Save adjustment"}</button>;
}
