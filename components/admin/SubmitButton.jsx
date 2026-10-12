"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton({ children, pendingLabel = "Saving…", className = "button button-dark" }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending}>{pending ? pendingLabel : children}</button>;
}
