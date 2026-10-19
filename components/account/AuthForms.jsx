"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import SubmitButton from "@/components/admin/SubmitButton";
import { changePassword, requestPasswordReset, signInCustomer, signUpCustomer, updatePassword } from "@/app/(store)/account/actions";

const withNext = (path, next) => (next && next !== "/account" ? `${path}?next=${encodeURIComponent(next)}` : path);

export function LoginForm({ next, initialError }) {
  const [state, formAction] = useFormState(signInCustomer, { error: initialError });
  return <form action={formAction} className="account-form">
    <input type="hidden" name="next" value={next} />
    <label className="field"><span>Email</span><input type="email" name="email" autoComplete="email" required /></label>
    <label className="field"><span>Password</span><input type="password" name="password" autoComplete="current-password" required /></label>
    {state?.error && <p className="admin-error" role="alert">{state.error}</p>}
    <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    <p className="account-form-links"><Link className="text-link" href="/account/forgot-password">Forgot password?</Link><Link className="text-link" href={withNext("/account/signup", next)}>Create an account</Link></p>
  </form>;
}

export function SignupForm({ next }) {
  const [state, formAction] = useFormState(signUpCustomer, {});
  if (state?.sent) {
    return <div className="account-sent" role="status"><p>Almost there. We've sent a confirmation link to <strong>{state.sent}</strong>.</p><p>Open it to finish creating your account. Check spam if you don't see it in a few minutes.</p></div>;
  }
  return <form action={formAction} className="account-form">
    <input type="hidden" name="next" value={next} />
    <label className="field"><span>Your name</span><input name="name" autoComplete="name" required /></label>
    <label className="field"><span>Email</span><input type="email" name="email" autoComplete="email" required /></label>
    <label className="field"><span>Password <small>at least 8 characters</small></span><input type="password" name="password" autoComplete="new-password" minLength={8} required /></label>
    {state?.error && <p className="admin-error" role="alert">{state.error}</p>}
    <SubmitButton pendingLabel="Creating…">Create account</SubmitButton>
    <p className="account-form-links"><span>Already have one?</span><Link className="text-link" href={withNext("/account/login", next)}>Sign in</Link></p>
  </form>;
}

export function ForgotPasswordForm() {
  const [state, formAction] = useFormState(requestPasswordReset, {});
  if (state?.sent) {
    return <div className="account-sent" role="status"><p>If there's an account for <strong>{state.sent}</strong>, a reset link is on its way.</p><p>The link works once and expires after a while.</p></div>;
  }
  return <form action={formAction} className="account-form">
    <label className="field"><span>Email</span><input type="email" name="email" autoComplete="email" required /></label>
    {state?.error && <p className="admin-error" role="alert">{state.error}</p>}
    <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
    <p className="account-form-links"><Link className="text-link" href="/account/login">Back to sign in</Link></p>
  </form>;
}

// Profile page: current password required.
export function ChangePasswordForm() {
  const [state, formAction] = useFormState(changePassword, {});
  return <form action={formAction} className="account-form">
    <label className="field"><span>Current password</span><input type="password" name="current" autoComplete="current-password" required /></label>
    <label className="field"><span>New password <small>at least 8 characters</small></span><input type="password" name="password" autoComplete="new-password" minLength={8} required /></label>
    <label className="field"><span>Repeat new password</span><input type="password" name="confirm" autoComplete="new-password" minLength={8} required /></label>
    {state?.error && <p className="admin-error" role="alert">{state.error}</p>}
    <SubmitButton pendingLabel="Saving…">Change password</SubmitButton>
  </form>;
}

// After the reset email link.
export function ResetPasswordForm() {
  const [state, formAction] = useFormState(updatePassword, {});
  return <form action={formAction} className="account-form">
    <label className="field"><span>New password <small>at least 8 characters</small></span><input type="password" name="password" autoComplete="new-password" minLength={8} required /></label>
    <label className="field"><span>Repeat new password</span><input type="password" name="confirm" autoComplete="new-password" minLength={8} required /></label>
    {state?.error && <p className="admin-error" role="alert">{state.error}</p>}
    <SubmitButton pendingLabel="Saving…">Save new password</SubmitButton>
  </form>;
}
