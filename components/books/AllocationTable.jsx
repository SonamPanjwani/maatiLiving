"use client";

import { useMemo, useState } from "react";
import { paiseToRupeeInput, rupeesToPaise } from "@/src/lib/books/money";
import { autoAllocate, checkAllocation } from "@/src/lib/books/payments";
import { formatDate, formatPrice } from "@/src/lib/format";

// Allocation state for a payment: oldest-first automatically (follows the amount) until the admin edits a cell;
// "Fill oldest first" goes back to automatic. initial = { key: rupees } starts in manual mode (editing a payment).
export function useAllocation(items, amountPaise, initial = null) {
  const [manual, setManual] = useState(initial);
  const auto = useMemo(() => Object.fromEntries(
    autoAllocate(amountPaise > 0 ? amountPaise : 0, items).allocations.map((a) => [a.key, paiseToRupeeInput(a.amountPaise)]),
  ), [items, amountPaise]);
  const values = manual ?? auto;
  const parsed = items.map((item) => ({ key: item.key, label: item.label, amountPaise: rupeesToPaise(values[item.key] ?? "") }));
  const unreadable = parsed.some((row) => Number.isNaN(row.amountPaise));
  const lines = parsed.filter((row) => Number.isInteger(row.amountPaise) && row.amountPaise > 0);
  const check = unreadable
    ? { error: "Allocated amounts must be in rupees, e.g. 500 or 500.50." }
    : checkAllocation(amountPaise > 0 ? amountPaise : 0, lines, items, { formatPrice });
  return {
    values,
    lines,
    check,
    isAuto: manual === null,
    setValue: (key, value) => setManual({ ...values, [key]: value }),
    fillOldest: () => setManual(null),
    clear: () => setManual({}),
    reset: () => setManual(initial),
  };
}

// Open bills with a "pay now" amount each (fields alloc_<key>, read by the server action).
export default function AllocationTable({ items, allocation, amountPaise, today }) {
  const { values, check, isAuto, setValue, fillOldest, clear } = allocation;
  if (items.length === 0) {
    return <p className="admin-note">Nothing open to pay for this vendor{amountPaise > 0 ? `, so the whole ${formatPrice(amountPaise)} is kept as an advance` : ""}. You can apply an advance to a later bill from the payment's page.</p>;
  }
  return <div className="allocation">
    <table className="admin-table table-cards allocation-lines">
      <thead><tr><th>Bill</th><th>Pay by</th><th className="num">Still to pay</th><th className="num">Pay now (₹)</th></tr></thead>
      <tbody>{items.map((item) => {
        const typed = rupeesToPaise(values[item.key] ?? "");
        const over = Number.isInteger(typed) && typed > item.balancePaise;
        return <tr key={item.key}>
        <td data-label="Bill"><span className="cell-value"><strong>{item.label}</strong>
          {item.purchaseId && <small>{[item.billNumber && `Bill ${item.billNumber}`, item.date && formatDate(item.date)].filter(Boolean).join(" · ")}</small>}</span></td>
        <td data-label="Pay by">{item.dueDate
          ? <span className="cell-value">{formatDate(item.dueDate)}{item.overdueDays > 0 && <small className="admin-warn">{item.overdueDays} {item.overdueDays === 1 ? "day" : "days"} overdue</small>}{item.overdueDays === 0 && today && item.dueDate === today && <small>due today</small>}</span>
          : <span className="muted">—</span>}</td>
        <td data-label="Still to pay" className="num"><span className="cell-value">{formatPrice(item.balancePaise)}{item.paidPaise > 0 && <small>of {formatPrice(item.totalPaise)}</small>}</span></td>
        <td data-label="Pay now (₹)" className="num">
          <input className="line-input" name={`alloc_${item.key}`} inputMode="decimal" value={values[item.key] ?? ""} placeholder="0"
            onChange={(event) => {
              const paise = rupeesToPaise(event.target.value);
              event.target.setCustomValidity(Number.isNaN(paise) ? "An amount in rupees, e.g. 500 or 500.50" : paise > item.balancePaise ? `Only ${formatPrice(item.balancePaise)} is still to pay on ${item.label}.` : "");
              setValue(item.key, event.target.value);
            }}
            aria-label={`Amount of this payment for ${item.label}, in rupees`} aria-invalid={over || undefined} aria-describedby={over ? `over-${item.key}` : undefined} />
          {over && <small id={`over-${item.key}`} className="admin-warn allocation-over" role="status">More than the {formatPrice(item.balancePaise)} still to pay</small>}
        </td>
      </tr>;
      })}</tbody>
    </table>
    <div className="allocation-summary" aria-live="polite">
      <p>{check.error
        ? <span className="admin-error">{check.error}</span>
        : <>Allocated <strong>{formatPrice(check.allocatedPaise)}</strong>{check.advancePaise > 0 && <> · <strong>{formatPrice(check.advancePaise)}</strong> kept as advance</>}</>}</p>
      <p className="allocation-actions">
        <button type="button" className="text-link" onClick={fillOldest} disabled={isAuto}>Fill oldest first</button>
        <button type="button" className="text-link" onClick={clear}>Clear (keep as advance)</button>
      </p>
    </div>
  </div>;
}

// Confirm text listing where the money goes.
export function allocationSummary(allocation, items, amountPaise) {
  const byKey = new Map(items.map((item) => [item.key, item]));
  const lines = allocation.lines.map((line) => `• ${byKey.get(line.key)?.label ?? "Bill"}: ${formatPrice(line.amountPaise)}`);
  const advance = allocation.check.advancePaise ?? amountPaise;
  if (advance > 0) lines.push(`• Kept as advance: ${formatPrice(advance)}`);
  return lines.join("\n");
}
