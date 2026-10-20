"use client";

import { useFormStatus } from "react-dom";

// "Update order" button: asks before cancelling, and stops "Shipped" without courier + tracking
// right away (the server checks again).
export default function StatusSubmit({ orderNumber }) {
  const { pending } = useFormStatus();
  const onClick = (event) => {
    const form = event.currentTarget.form;
    const status = form?.elements.status?.value;
    if (status === "shipped") {
      const missing = ["trackingCourier", "trackingNumber"].map((name) => form.elements[name]).find((input) => input && !input.value.trim());
      if (missing) {
        event.preventDefault();
        missing.setCustomValidity("Required to mark the order Shipped (hand delivery: \"Hand delivery\" / \"-\")");
        missing.reportValidity();
        missing.addEventListener("input", () => missing.setCustomValidity(""), { once: true });
        return;
      }
    }
    if (status === "cancelled" && !window.confirm(`Cancel order ${orderNumber}? The customer will see it as cancelled.`)) event.preventDefault();
  };
  return <button type="submit" className="button button-dark" disabled={pending} onClick={onClick}>{pending ? "Saving…" : "Update order"}</button>;
}
