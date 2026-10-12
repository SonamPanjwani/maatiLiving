"use client";

import { useFormState } from "react-dom";
import { signIn } from "@/app/admin/actions";
import SubmitButton from "./SubmitButton";

export default function LoginForm({ initialError }) {
  const [state, formAction] = useFormState(signIn, { error: initialError });
  return <form action={formAction} className="admin-form">
    <label className="field"><span>Email</span><input type="email" name="email" autoComplete="email" required /></label>
    <label className="field"><span>Password</span><input type="password" name="password" autoComplete="current-password" required /></label>
    {state?.error && <p className="admin-error" role="alert">{state.error}</p>}
    <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
  </form>;
}
