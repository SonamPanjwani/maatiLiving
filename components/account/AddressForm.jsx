"use client";

import { useFormState } from "react-dom";
import SubmitButton from "@/components/admin/SubmitButton";
import { saveAddress } from "@/app/(store)/account/actions";
import AddressFields from "./AddressFields";

export default function AddressForm({ address }) {
  const [state, formAction] = useFormState(saveAddress, {});
  return <form action={formAction} className="account-form account-form-wide" key={address?.id ?? "new"}>
    {address?.id && <input type="hidden" name="id" value={address.id} />}
    <AddressFields address={address} />
    <div className="field-checks"><label><input type="checkbox" name="isDefault" defaultChecked={address?.is_default} /> Use as my default address</label></div>
    {state?.error && <p className="admin-error" role="alert">{state.error}</p>}
    <div className="admin-form-actions"><SubmitButton>{address?.id ? "Save address" : "Add address"}</SubmitButton>{address?.id && <a className="text-link" href="/account/addresses">Cancel</a>}</div>
  </form>;
}
