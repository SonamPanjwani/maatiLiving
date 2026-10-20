"use client";

// A submit button that asks before a destructive server action runs.
// Checks the form's required fields first, so the confirm never pops up for an incomplete form.
export default function ConfirmSubmit({ message, children, className = "admin-danger" }) {
  const onClick = (event) => {
    const form = event.currentTarget.form;
    if (form && !form.reportValidity()) { event.preventDefault(); return; }
    if (!window.confirm(message)) event.preventDefault();
  };
  return <button type="submit" className={className} onClick={onClick}>{children}</button>;
}
