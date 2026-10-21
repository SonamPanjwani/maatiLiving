"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ChevronDown } from "lucide-react";
import { confirmRecurring, saveExpense } from "@/app/admin/(panel)/books/expenses/actions";
import BillUploader from "@/components/books/BillUploader";
import { paiseToRupeeInput } from "@/src/lib/books/money";
import { PAID_VIA, RECURRENCE, nextDueDate, validDate } from "@/src/lib/books/expenses";
import { formatDate } from "@/src/lib/format";

// Adding several receipts in a row is the main job of the new form, so "Save & add another" leads.
// Buttons wait while a receipt photo is still uploading, so an expense is never saved without it.
function Buttons({ mode, cancelHref, uploading }) {
  const { pending } = useFormStatus();
  const busy = pending || uploading;
  const label = (text) => (uploading ? "Waiting for photo…" : pending ? "Saving…" : text);
  return <div className="admin-form-actions sticky-save">
    {mode === "new"
      ? <>
          <button type="submit" name="intent" value="another" className="button button-dark" disabled={busy}>{label("Save & add another")}</button>
          <button type="submit" name="intent" value="save" className="stock-save" disabled={busy}>Save expense</button>
        </>
      : <button type="submit" className="button button-dark" disabled={busy}>{label(mode === "confirm" ? "Confirm as paid" : "Save expense")}</button>}
    <a className="text-link" href={cancelHref}>Cancel</a>
  </div>;
}

// Quick expense entry, phone first: amount, category, date, how it was paid, receipt photo. Vendor, tax and
// "repeats" sit under "More details".
// mode: "new" | "edit" | "confirm" (posting one due occurrence of a repeating expense: no repeat fields).
// defaults: { spentOn, paidVia } kept from the previous receipt when adding several in a row.
export default function ExpenseForm({ mode = "new", expense, categories, vendors, today, cancelHref, dueOn, defaults = {} }) {
  const [state, formAction] = useFormState(mode === "confirm" ? confirmRecurring : saveExpense, {});
  const e = expense ?? {};
  const [spentOn, setSpentOn] = useState(mode === "confirm" ? (dueOn && dueOn < today ? dueOn : today) : e.spent_on ?? defaults.spentOn ?? today);
  const [uploading, setUploading] = useState(false);
  const [recurring, setRecurring] = useState(Boolean(e.is_recurring));
  const [recurrence, setRecurrence] = useState(e.recurrence ?? "monthly");
  const [nextDue, setNextDue] = useState(mode === "edit" && e.is_recurring ? e.next_due_on ?? "" : "");
  const autoNext = validDate(spentOn) ? nextDueDate(spentOn, spentOn, recurrence) : "";
  const hasMore = Boolean(e.vendor_id || e.tax_paise || e.is_recurring);

  return <form action={formAction} className="admin-form admin-form-wide books-form expense-form">
    {mode === "edit" && <input type="hidden" name="id" value={e.id} />}
    {mode === "confirm" && <><input type="hidden" name="sourceId" value={e.id} /><input type="hidden" name="dueOn" value={dueOn} /></>}

    <label className="field expense-amount" htmlFor="exp-amount"><span>Amount (₹) <small>what you paid, tax included</small></span>
      <input id="exp-amount" name="amount" inputMode="decimal" defaultValue={paiseToRupeeInput(e.amount_paise ?? null)} required autoFocus={mode === "new"}
        pattern="\s*₹?\s*[0-9,]+(\.[0-9]{1,2})?\s*" title="An amount in rupees, e.g. 450 or 450.50" placeholder="0" /></label>

    <fieldset className="segmented segmented-wrap chip-choices">
      <legend className="segmented-label">Category</legend>
      {categories.map((category, index) => <label key={category.id}>
        <input type="radio" name="categoryId" value={category.id} defaultChecked={e.category_id ? e.category_id === category.id : false} required={index === 0} />
        {category.name}
      </label>)}
    </fieldset>

    <div className="field-row">
      <label className="field" htmlFor="exp-date"><span>{mode === "confirm" ? "Paid on" : "Date"}</span><input id="exp-date" name="spentOn" type="date" value={spentOn} max={today} onChange={(event) => setSpentOn(event.target.value)} required /></label>
    </div>

    <fieldset className="segmented segmented-wrap">
      <legend className="segmented-label">Paid by</legend>
      {Object.entries(PAID_VIA).map(([value, label], index) => <label key={value}><input type="radio" name="paidVia" value={value} defaultChecked={(e.paid_via ?? defaults.paidVia ?? "upi") === value} required={index === 0} /> {label}</label>)}
    </fieldset>

    <label className="field" htmlFor="exp-desc"><span>What for <small>optional, e.g. "200 kraft boxes"</small></span><input id="exp-desc" name="description" maxLength={300} defaultValue={e.description ?? ""} /></label>

    <BillUploader label="Photo of the receipt" max={10} initialFiles={mode === "confirm" ? [] : e.attachments ?? []} note="Private: only admins can open these." onBusyChange={setUploading} />

    <details className="expense-more" open={mode !== "new" && hasMore}>
      <summary><ChevronDown size={16} aria-hidden="true" className="expense-more-icon" />More details <small>vendor, tax{mode === "confirm" ? "" : ", repeats"}</small></summary>
      <div className="field-row">
        <label className="field" htmlFor="exp-vendor"><span>Vendor <small>optional</small></span>
          <select id="exp-vendor" name="vendorId" defaultValue={e.vendor_id ?? ""}>
            <option value="">None</option>
            {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
          </select>
        </label>
        <label className="field" htmlFor="exp-tax"><span>GST in this amount (₹) <small>optional</small></span><input id="exp-tax" name="tax" inputMode="decimal" defaultValue={e.tax_paise ? paiseToRupeeInput(e.tax_paise) : ""} placeholder="0" /></label>
      </div>
      {mode !== "confirm" && (e.recurring_source_id
        ? <p className="admin-note">Part of a repeating expense. Change how often it repeats on the original.</p>
        : <>
            <div className="field-checks"><label><input type="checkbox" name="isRecurring" checked={recurring} onChange={(event) => setRecurring(event.target.checked)} /> This repeats (rent, software, …)</label></div>
            {recurring && <div className="field-row">
              <label className="field" htmlFor="exp-rec"><span>How often</span>
                <select id="exp-rec" name="recurrence" value={recurrence} onChange={(event) => setRecurrence(event.target.value)}>
                  {Object.entries(RECURRENCE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="field" htmlFor="exp-next"><span>Next due <small>{autoNext ? `blank = ${formatDate(autoNext)}` : "blank = one step after the date"}</small></span>
                <input id="exp-next" name="nextDueOn" type="date" value={nextDue} min={validDate(spentOn) ? spentOn : undefined} onChange={(event) => setNextDue(event.target.value)} /></label>
            </div>}
            {recurring && <p className="admin-note">You'll get a reminder on the dashboard when it's due. Nothing is added on its own: you confirm each time, with the actual amount.</p>}
          </>)}
    </details>

    {state?.error && <p className="admin-error" role="alert">{state.error}</p>}
    <Buttons mode={mode} cancelHref={cancelHref} uploading={uploading} />
  </form>;
}
