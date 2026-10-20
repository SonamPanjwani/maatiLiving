"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { receivePurchase } from "@/app/admin/(panel)/books/purchases/actions";
import { formatPrice } from "@/src/lib/format";

function SubmitReceive({ onConfirm }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="button button-dark" disabled={pending} onClick={onConfirm}>{pending ? "Receiving…" : "Receive into stock"}</button>;
}

// Receive items: quantities pre-filled with what's still to come. Confirms with a summary before anything changes;
// receiving more than ordered needs its own confirmation (and the bill then counts what arrived).
export default function ReceiveForm({ purchaseId, purchaseNumber, items }) {
  const [qty, setQty] = useState(() => Object.fromEntries(items.map((item) => [item.id, String(Math.max(item.qtyOrdered - item.qtyReceived, 0))])));
  const allowOver = useRef(null);

  const onConfirm = (event) => {
    const form = event.currentTarget.form;
    if (!form.reportValidity()) { event.preventDefault(); return; }
    const arriving = items.map((item) => ({ ...item, now: Number(qty[item.id] || 0) })).filter((item) => item.now > 0);
    if (arriving.length === 0) { event.preventDefault(); window.alert("Enter how many pieces arrived for at least one item."); return; }

    const pieces = arriving.reduce((sum, item) => sum + item.now, 0);
    const summary = arriving.map((item) => `• ${item.name}: ${item.now} (stock ${item.stock} → ${item.stock + item.now})`).join("\n");
    const over = arriving.filter((item) => item.qtyReceived + item.now > item.qtyOrdered);
    if (over.length) {
      const extra = over.reduce((sum, item) => sum + (item.qtyReceived + item.now - Math.max(item.qtyOrdered, item.qtyReceived)) * item.unitCostPaise, 0);
      const detail = over.map((item) => `• ${item.name}: ordered ${item.qtyOrdered}, ${item.qtyReceived + item.now} received in total`).join("\n");
      if (!window.confirm(`More than ordered:\n${detail}\n\nIf you accept the extra pieces, the bill counts them too (${formatPrice(extra)} more).`)) { event.preventDefault(); return; }
      allowOver.current.value = "1";
    } else {
      allowOver.current.value = "";
    }
    const message = `Receive ${pieces} ${pieces === 1 ? "piece" : "pieces"} on ${purchaseNumber}?\n\n${summary}\n\nStock goes up now and cost prices update. This can't be undone — fix mistakes later with Adjust stock.`;
    if (!window.confirm(message)) event.preventDefault();
  };

  return <form action={receivePurchase} className="admin-form admin-form-wide">
    <input type="hidden" name="id" value={purchaseId} />
    <input type="hidden" name="allowOver" ref={allowOver} />
    <table className="admin-table table-cards receive-lines">
      <thead><tr><th>Product</th><th className="num">Ordered</th><th className="num">Received so far</th><th className="num">Arriving now</th></tr></thead>
      <tbody>{items.map((item) => {
        const total = item.qtyReceived + Number(qty[item.id] || 0);
        return <tr key={item.id}>
          <td data-label="Product"><strong>{item.name}</strong><small>{item.stock} in stock now</small></td>
          <td data-label="Ordered" className="num">{item.qtyOrdered}</td>
          <td data-label="Received so far" className="num">{item.qtyReceived}</td>
          <td data-label="Arriving now" className="num"><span className="cell-value">
            <input className="line-input" name={`qty_${item.id}`} type="number" inputMode="numeric" min="0" step="1" value={qty[item.id]}
              onChange={(event) => setQty({ ...qty, [item.id]: event.target.value })} aria-label={`Pieces of ${item.name} arriving now`} />
            {total > item.qtyOrdered && <small className="admin-warn" role="status">{total - item.qtyOrdered} more than ordered</small>}
          </span></td>
        </tr>;
      })}</tbody>
    </table>
    <label className="field" htmlFor="receive-note"><span>Note <small>optional, e.g. "2 cracked, kept aside"</small></span><input id="receive-note" name="note" maxLength={300} /></label>
    <div className="admin-form-actions sticky-save">
      <SubmitReceive onConfirm={onConfirm} />
      <a className="text-link" href={`/admin/books/purchases/${purchaseId}`}>Cancel</a>
    </div>
  </form>;
}
