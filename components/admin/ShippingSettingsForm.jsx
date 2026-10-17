"use client";

import { useFormState } from "react-dom";
import { saveShippingSettings } from "@/app/admin/actions";
import { indianStates } from "@/src/config/shop";
import SubmitButton from "./SubmitButton";

const toRupees = (paise) => (paise == null ? "" : String(paise / 100));

export default function ShippingSettingsForm({ settings }) {
  const [state, formAction] = useFormState(saveShippingSettings, {});
  return <form action={formAction} className="admin-form admin-form-wide">
    <fieldset>
      <legend className="eyebrow">STANDARD RATES</legend>
      <div className="field-row">
        <label className="field"><span>Standard delivery (₹) <small>for states without their own rate</small></span><input name="defaultRupees" type="number" min="0" step="1" defaultValue={toRupees(settings.defaultPaise)} required /></label>
        <label className="field"><span>Free delivery from (₹) <small>leave blank for never</small></span><input name="freeOverRupees" type="number" min="0" step="1" defaultValue={toRupees(settings.freeOverPaise)} /></label>
      </div>
    </fieldset>

    <fieldset>
      <legend className="eyebrow">BY STATE</legend>
      <p className="admin-note">Leave a state blank to use the standard rate. Enter 0 for free delivery to that state.</p>
      <div className="state-rates">
        {indianStates.map((name) => <label key={name} className="field">
          <span>{name}</span>
          <input name={`state:${name}`} type="number" min="0" step="1" defaultValue={toRupees(settings.byStatePaise[name])} placeholder={toRupees(settings.defaultPaise)} />
        </label>)}
      </div>
    </fieldset>

    {state?.error && <p className="admin-error" role="alert">{state.error}</p>}
    {state?.saved && <p className="admin-success" role="status">Delivery charges saved. The shop uses them straight away.</p>}
    <div className="admin-form-actions"><SubmitButton>Save delivery charges</SubmitButton></div>
  </form>;
}
