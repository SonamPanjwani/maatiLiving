"use client";

// A submit button that asks before a destructive server action runs.
export default function ConfirmSubmit({ message, children, className = "admin-danger" }) {
  return <button type="submit" className={className} onClick={(event) => { if (!window.confirm(message)) event.preventDefault(); }}>{children}</button>;
}
