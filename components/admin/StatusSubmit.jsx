"use client";

import { useFormStatus } from "react-dom";

// "Update order" button: asks before cancelling, and before marking Shipped without tracking (server checks too).
export default function StatusSubmit({ orderNumber }) {
  const { pending } = useFormStatus();
  const onClick = (event) => {
    const form = event.currentTarget.form;
    const status = form?.elements.status?.value;
    if (status === "cancelled" && !window.confirm(`Cancel order ${orderNumber}? The customer will see it as cancelled.`)) event.preventDefault();
  };
  return <button type="submit" className="button button-dark" disabled={pending} onClick={onClick}>{pending ? "Saving…" : "Update order"}</button>;
}
