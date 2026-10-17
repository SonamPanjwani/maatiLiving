"use client";

import { useFormState } from "react-dom";
import SubmitButton from "@/components/admin/SubmitButton";
import { updateProfile } from "@/app/(store)/account/actions";

export default function ProfileForm({ profile, email }) {
  const [state, formAction] = useFormState(updateProfile, {});
  return <form action={formAction} className="account-form">
    <label className="field"><span>Email <small>used to sign in</small></span><input value={email} readOnly /></label>
    <label className="field"><span>Name</span><input name="name" defaultValue={profile?.full_name ?? ""} autoComplete="name" required /></label>
    <label className="field"><span>Mobile <small>optional, for delivery updates</small></span><input name="phone" type="tel" inputMode="numeric" defaultValue={profile?.phone ?? ""} autoComplete="tel-national" /></label>
    {state?.error && <p className="admin-error" role="alert">{state.error}</p>}
    {state?.saved && <p className="admin-success" role="status">Saved.</p>}
    <SubmitButton>Save details</SubmitButton>
  </form>;
}
