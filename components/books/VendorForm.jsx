"use client";

import { useFormState } from "react-dom";
import SubmitButton from "@/components/admin/SubmitButton";
import { saveVendor } from "@/app/admin/(panel)/books/actions";
import { paiseToRupeeInput } from "@/src/lib/books/money";
import { indianStates } from "@/src/config/shop";

const PHONE = { type: "tel", inputMode: "numeric", pattern: "[6-9][0-9]{9}", maxLength: 10, title: "10-digit mobile number starting with 6, 7, 8 or 9" };

export default function VendorForm({ vendor }) {
  const [state, formAction] = useFormState(saveVendor, {});
  const v = vendor ?? {};
  return <form action={formAction} className="admin-form admin-form-wide books-form">
    {v.id && <input type="hidden" name="id" value={v.id} />}

    <fieldset>
      <legend className="eyebrow">VENDOR</legend>
      <label className="field" htmlFor="v-name"><span>Name</span><input id="v-name" name="name" defaultValue={v.name ?? ""} required maxLength={120} /></label>
      <div className="field-row">
        <label className="field" htmlFor="v-contact"><span>Contact person <small>optional</small></span><input id="v-contact" name="contactPerson" defaultValue={v.contact_person ?? ""} maxLength={120} /></label>
        <label className="field" htmlFor="v-supplies"><span>Supplies <small>e.g. diyas, coconut shell</small></span><input id="v-supplies" name="supplies" defaultValue={v.supplies ?? ""} maxLength={300} /></label>
      </div>
      <div className="field-row">
        <label className="field" htmlFor="v-phone"><span>Phone</span><input id="v-phone" name="phone" {...PHONE} defaultValue={v.phone ?? ""} /></label>
        <label className="field" htmlFor="v-wa"><span>WhatsApp <small>blank = same as phone</small></span><input id="v-wa" name="whatsapp" {...PHONE} defaultValue={v.whatsapp && v.whatsapp !== v.phone ? v.whatsapp : ""} /></label>
      </div>
      <label className="field" htmlFor="v-email"><span>Email <small>optional</small></span><input id="v-email" name="email" type="email" defaultValue={v.email ?? ""} /></label>
      <label className="field" htmlFor="v-address"><span>Address <small>optional</small></span><input id="v-address" name="address" defaultValue={v.address ?? ""} maxLength={300} /></label>
      <div className="field-row">
        <label className="field" htmlFor="v-city"><span>City</span><input id="v-city" name="city" defaultValue={v.city ?? ""} maxLength={80} /></label>
        <label className="field" htmlFor="v-state"><span>State</span>
          <select id="v-state" name="state" defaultValue={v.state ?? ""}>
            <option value="">—</option>
            {indianStates.map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend className="eyebrow">PAYMENT TERMS</legend>
      <div className="field-row">
        <label className="field" htmlFor="v-terms"><span>Pay within (days) <small>0 = on receipt</small></span><input id="v-terms" name="paymentTermsDays" type="number" inputMode="numeric" min="0" max="365" step="1" defaultValue={v.payment_terms_days ?? 0} /></label>
        <label className="field" htmlFor="v-opening"><span>Opening balance (₹) <small>what you owed them on day one; minus = advance</small></span><input id="v-opening" name="openingBalance" inputMode="decimal" defaultValue={paiseToRupeeInput(v.opening_balance_paise ?? 0)} /></label>
      </div>
      <div className="field-row">
        <label className="field" htmlFor="v-upi"><span>UPI ID <small>optional</small></span><input id="v-upi" name="upiId" defaultValue={v.upi_id ?? ""} placeholder="name@bank" /></label>
        <label className="field" htmlFor="v-rating"><span>Rating <small>optional</small></span>
          <select id="v-rating" name="rating" defaultValue={v.rating ?? ""}>
            <option value="">—</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)}</option>)}
          </select>
        </label>
      </div>
      <div className="field-row">
        <label className="field" htmlFor="v-bankname"><span>Bank account name</span><input id="v-bankname" name="bankAccountName" defaultValue={v.bank_account_name ?? ""} /></label>
        <label className="field" htmlFor="v-bankno"><span>Account number</span><input id="v-bankno" name="bankAccountNumber" inputMode="numeric" defaultValue={v.bank_account_number ?? ""} /></label>
        <label className="field" htmlFor="v-ifsc"><span>IFSC</span><input id="v-ifsc" name="bankIfsc" defaultValue={v.bank_ifsc ?? ""} placeholder="HDFC0001234" /></label>
      </div>
    </fieldset>

    <fieldset>
      <legend className="eyebrow">TAX (OPTIONAL)</legend>
      <div className="field-row">
        <label className="field" htmlFor="v-gstin"><span>GSTIN</span><input id="v-gstin" name="gstin" defaultValue={v.gstin ?? ""} maxLength={15} placeholder="22AAAAA0000A1Z5" /></label>
        <label className="field" htmlFor="v-pan"><span>PAN</span><input id="v-pan" name="pan" defaultValue={v.pan ?? ""} maxLength={10} placeholder="ABCDE1234F" /></label>
      </div>
    </fieldset>

    <fieldset>
      <legend className="eyebrow">NOTES</legend>
      <label className="field" htmlFor="v-notes"><span>Notes <small>quality, lead time, anything to remember</small></span><textarea id="v-notes" name="notes" rows={3} defaultValue={v.notes ?? ""} /></label>
    </fieldset>

    {state?.error && <p className="admin-error" role="alert">{state.error}</p>}
    <div className="admin-form-actions sticky-save"><SubmitButton>{v.id ? "Save vendor" : "Add vendor"}</SubmitButton><a className="text-link" href={v.id ? `/admin/books/vendors/${v.id}` : "/admin/books/vendors"}>Cancel</a></div>
  </form>;
}
