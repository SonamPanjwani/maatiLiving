"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus, Search, X } from "lucide-react";
import { savePurchase } from "@/app/admin/(panel)/books/purchases/actions";
import BillUploader from "@/components/books/BillUploader";
import { paiseToRupeeInput, rupeesToPaise } from "@/src/lib/books/money";
import { purchaseTotals } from "@/src/lib/books/purchases";
import { formatDate, formatPrice } from "@/src/lib/format";

let nextKey = 0;
const lineKey = () => `line-${nextKey++}`;

function addDays(isoDate, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "";
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function Buttons({ isNew, isDraft, locked, cancelHref }) {
  const { pending } = useFormStatus();
  return <div className="admin-form-actions sticky-save">
    {(isNew || isDraft) && !locked
      ? <>
          <button type="submit" name="intent" value="ordered" className="button button-dark" disabled={pending}>{pending ? "Saving…" : "Save & mark ordered"}</button>
          <button type="submit" name="intent" value="draft" className="stock-save" disabled={pending}>Save as draft</button>
        </>
      : <button type="submit" name="intent" value="save" className="button button-dark" disabled={pending}>{pending ? "Saving…" : "Save purchase"}</button>}
    <a className="text-link" href={cancelHref}>Cancel</a>
  </div>;
}

// Create / edit a purchase. locked = stock already received: only bill details, files and notes can change.
export default function PurchaseForm({ purchase, vendors, products, links, defaultVendorId = "", today }) {
  const [state, formAction] = useFormState(savePurchase, {});
  const p = purchase ?? {};
  const locked = Boolean(p.locked);
  const [vendorId, setVendorId] = useState(p.vendor_id ?? defaultVendorId);
  const [lines, setLines] = useState(() => (p.items ?? []).map((item) => ({
    key: lineKey(), productId: item.product_id, name: item.product?.name ?? "Product", qty: String(item.qty_ordered), cost: paiseToRupeeInput(item.unit_cost_paise),
  })));
  const [money, setMoney] = useState({ discount: paiseToRupeeInput(p.discount_paise || null), shipping: paiseToRupeeInput(p.shipping_paise || null), tax: paiseToRupeeInput(p.tax_paise || null) });
  const [billDate, setBillDate] = useState(p.bill_date ?? "");
  const [search, setSearch] = useState("");

  const vendor = vendors.find((v) => v.id === vendorId);
  const lastCost = useMemo(() => new Map(links.filter((link) => link.vendor_id === vendorId).map((link) => [link.product_id, link])), [links, vendorId]);
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const chosen = new Set(lines.map((line) => line.productId));
  const term = search.trim().toLowerCase();
  const matches = products
    .filter((product) => !chosen.has(product.id))
    .filter((product) => (term ? `${product.name} ${product.sku ?? ""}`.toLowerCase().includes(term) : lastCost.has(product.id)))
    .sort((a, b) => Number(lastCost.has(b.id)) - Number(lastCost.has(a.id)))
    .slice(0, 8);

  const addLine = (product) => {
    setLines((current) => [...current, { key: lineKey(), productId: product.id, name: product.name, qty: "", cost: paiseToRupeeInput(lastCost.get(product.id)?.last_cost_paise ?? null) }]);
    setSearch("");
  };
  const updateLine = (key, field, value) => setLines((current) => current.map((line) => (line.key === key ? { ...line, [field]: value } : line)));
  const removeLine = (key) => setLines((current) => current.filter((line) => line.key !== key));

  const changeVendor = (id) => {
    setVendorId(id);
    // Fill empty costs from the new vendor's last prices; never overwrite what was typed.
    const costs = new Map(links.filter((link) => link.vendor_id === id).map((link) => [link.product_id, link.last_cost_paise]));
    setLines((current) => current.map((line) => (line.cost === "" && costs.get(line.productId) != null ? { ...line, cost: paiseToRupeeInput(costs.get(line.productId)) } : line)));
  };

  const paise = (value) => { const n = rupeesToPaise(value); return Number.isInteger(n) ? n : 0; };
  const parsed = lines.map((line) => ({ qty: Number(line.qty), unitCostPaise: rupeesToPaise(line.cost) }));
  const { subtotalPaise, totalPaise } = purchaseTotals(parsed, { discountPaise: paise(money.discount), shippingPaise: paise(money.shipping), taxPaise: paise(money.tax) });
  const autoDue = vendor && billDate ? addDays(billDate, vendor.payment_terms_days ?? 0) : "";
  const cancelHref = p.id ? `/admin/books/purchases/${p.id}` : "/admin/books/purchases";

  return <form action={formAction} className="admin-form admin-form-wide books-form purchase-form">
    {p.id && <input type="hidden" name="id" value={p.id} />}
    {locked && <input type="hidden" name="locked" value="1" />}
    <input type="hidden" name="items" value={JSON.stringify(lines.map((line) => ({ productId: line.productId, name: line.name, qty: Number(line.qty), unitCost: line.cost })))} />

    <fieldset>
      <legend className="eyebrow">VENDOR & DATES</legend>
      {locked
        ? <><input type="hidden" name="vendorId" value={vendorId} /><p className="stock-readonly"><strong>{vendor?.name ?? "Vendor"}</strong><span className="muted">Vendor, items and amounts are locked once stock has been received.</span></p></>
        : <label className="field" htmlFor="po-vendor"><span>Vendor</span>
            <select id="po-vendor" name="vendorId" value={vendorId} onChange={(event) => changeVendor(event.target.value)} required>
              <option value="" disabled>Choose a vendor</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>}
      <div className="field-row">
        <label className="field" htmlFor="po-date"><span>Order date</span><input id="po-date" name="orderDate" type="date" defaultValue={p.order_date ?? today} required /></label>
        <label className="field" htmlFor="po-expected"><span>Expected by <small>optional</small></span><input id="po-expected" name="expectedDate" type="date" defaultValue={p.expected_date ?? ""} /></label>
      </div>
    </fieldset>

    {!locked && <fieldset>
      <legend className="eyebrow">ITEMS</legend>
      {lines.length > 0 && <table className="admin-table table-cards purchase-lines">
        <thead><tr><th>Product</th><th className="num">Qty</th><th className="num">Cost per piece (₹)</th><th className="num">Line total</th><th><span className="sr-only">Remove</span></th></tr></thead>
        <tbody>{lines.map((line) => {
          const qty = Number(line.qty);
          const cost = rupeesToPaise(line.cost);
          const valid = Number.isInteger(qty) && qty > 0 && Number.isInteger(cost);
          const stock = productById.get(line.productId)?.stock;
          return <tr key={line.key}>
            <td data-label="Product"><strong>{line.name}</strong>{stock != null && <small>{stock} in stock{lastCost.get(line.productId)?.last_cost_paise != null ? ` · last price ${formatPrice(lastCost.get(line.productId).last_cost_paise)}` : ""}</small>}</td>
            <td data-label="Qty" className="num"><input className="line-input" type="number" inputMode="numeric" min="1" step="1" value={line.qty} onChange={(event) => updateLine(line.key, "qty", event.target.value)} aria-label={`Quantity of ${line.name}`} required /></td>
            <td data-label="Cost per piece (₹)" className="num"><input className="line-input" inputMode="decimal" value={line.cost} onChange={(event) => {
              // ₹0 isn't a purchase: block it before submit too (free samples go through Adjust stock → Sample).
              event.target.setCustomValidity(rupeesToPaise(event.target.value) === 0 ? "Cost must be more than ₹0. For free samples, use Adjust stock → Sample." : "");
              updateLine(line.key, "cost", event.target.value);
            }} aria-label={`Cost per piece of ${line.name}, in rupees`} placeholder="0" required pattern="\s*₹?\s*[0-9,]+(\.[0-9]{1,2})?\s*" title="An amount in rupees, e.g. 120 or 120.50" /></td>
            <td data-label="Line total" className="num"><span className="cell-value">{valid ? formatPrice(qty * cost) : "—"}</span></td>
            <td className="table-action"><button type="button" className="text-link" onClick={() => removeLine(line.key)} aria-label={`Remove ${line.name}`}><X size={14} /> Remove</button></td>
          </tr>;
        })}</tbody>
      </table>}

      <div className="product-picker">
        <label className="field" htmlFor="po-search"><span>{lines.length ? "Add another product" : "Add products"}</span>
          <span className="picker-input"><Search size={15} aria-hidden="true" /><input id="po-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or SKU" autoComplete="off" enterKeyHint="search"
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (matches[0]) addLine(matches[0]); } }} /></span>
        </label>
        {matches.length > 0
          ? <ul className="picker-results" aria-label={term ? "Matching products" : "Products this vendor supplies"}>
              {!term && <li className="picker-hint">From {vendor?.name ?? "this vendor"}</li>}
              {matches.map((product) => <li key={product.id}><button type="button" onClick={() => addLine(product)}>
                <Plus size={14} aria-hidden="true" /><span>{product.name}{product.sku ? <small> {product.sku}</small> : null}</span>
                <small>{lastCost.get(product.id)?.last_cost_paise != null ? `last ${formatPrice(lastCost.get(product.id).last_cost_paise)}` : `${product.stock} in stock`}</small>
              </button></li>)}
            </ul>
          : term && <p className="admin-note">No product matches “{search}”.</p>}
        {lines.length === 0 && !term && matches.length === 0 && <p className="admin-note">{vendorId ? "Search for the products you're buying." : "Choose a vendor first — products they supply show up here with their last price."}</p>}
      </div>
    </fieldset>}

    {!locked && <fieldset>
      <legend className="eyebrow">AMOUNTS</legend>
      <div className="field-row">
        <label className="field" htmlFor="po-discount"><span>Discount (₹) <small>optional</small></span><input id="po-discount" name="discount" inputMode="decimal" value={money.discount} onChange={(event) => setMoney({ ...money, discount: event.target.value })} placeholder="0" /></label>
        <label className="field" htmlFor="po-shipping"><span>Shipping / freight (₹) <small>you paid</small></span><input id="po-shipping" name="shipping" inputMode="decimal" value={money.shipping} onChange={(event) => setMoney({ ...money, shipping: event.target.value })} placeholder="0" /></label>
        <label className="field" htmlFor="po-tax"><span>Tax (₹) <small>optional</small></span><input id="po-tax" name="tax" inputMode="decimal" value={money.tax} onChange={(event) => setMoney({ ...money, tax: event.target.value })} placeholder="0" /></label>
      </div>
      <dl className="purchase-totals" aria-live="polite">
        <div><dt>Items</dt><dd>{formatPrice(subtotalPaise)}</dd></div>
        {paise(money.discount) > 0 && <div><dt>Discount</dt><dd>−{formatPrice(paise(money.discount))}</dd></div>}
        {paise(money.shipping) > 0 && <div><dt>Shipping</dt><dd>{formatPrice(paise(money.shipping))}</dd></div>}
        {paise(money.tax) > 0 && <div><dt>Tax</dt><dd>{formatPrice(paise(money.tax))}</dd></div>}
        <div className="purchase-total"><dt>Total</dt><dd>{formatPrice(totalPaise)}</dd></div>
      </dl>
      <p className="admin-note">Shipping and discount are shared across the items by value, so each piece's cost includes its share.</p>
    </fieldset>}

    <fieldset>
      <legend className="eyebrow">VENDOR'S BILL <small>add when it arrives</small></legend>
      <div className="field-row">
        <label className="field" htmlFor="po-bill"><span>Bill number</span><input id="po-bill" name="billNumber" defaultValue={p.bill_number ?? ""} maxLength={60} /></label>
        <label className="field" htmlFor="po-billdate"><span>Bill date</span><input id="po-billdate" name="billDate" type="date" value={billDate} onChange={(event) => setBillDate(event.target.value)} /></label>
        <label className="field" htmlFor="po-due"><span>Pay by <small>{autoDue ? `blank = ${formatDate(autoDue)} (${vendor.payment_terms_days} days)` : "blank = bill date + vendor's terms"}</small></span><input id="po-due" name="dueDate" type="date" defaultValue={p.due_date ?? ""} /></label>
      </div>
      <BillUploader initialFiles={p.bill_attachments ?? []} />
    </fieldset>

    <fieldset>
      <legend className="eyebrow">NOTES</legend>
      <label className="field" htmlFor="po-notes"><span>Notes <small>internal — never shared with the vendor</small></span><textarea id="po-notes" name="notes" rows={3} maxLength={2000} defaultValue={p.notes ?? ""} /></label>
    </fieldset>

    {state?.error && <p className="admin-error" role="alert">{state.error}</p>}
    <Buttons isNew={!p.id} isDraft={p.status === "draft"} locked={locked} cancelHref={cancelHref} />
  </form>;
}
