"use client";

import { useFormStatus } from "react-dom";

// A submit button that asks before a destructive server action runs.
// Checks the form's required fields first, so the confirm never pops up for an incomplete form.
// While the action runs it's disabled and shows pendingLabel, so a slow connection can't send it twice.
export default function ConfirmSubmit({ message, children, className = "admin-danger", pendingLabel = "Saving…" }) {
  const { pending } = useFormStatus();
  const onClick = (event) => {
    const form = event.currentTarget.form;
    if (form && !form.reportValidity()) { event.preventDefault(); return; }
    if (!window.confirm(message)) event.preventDefault();
  };
  return <button type="submit" className={className} onClick={onClick} disabled={pending} aria-busy={pending || undefined}>{pending ? pendingLabel : children}</button>;
}
