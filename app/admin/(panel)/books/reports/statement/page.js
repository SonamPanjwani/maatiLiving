import { MessageCircle } from "lucide-react";
import ReportFrame from "@/components/books/ReportFrame";
import { siteConfig } from "@/src/config/site";
import { booksGetVendors } from "@/src/lib/books/data";
import { statementText } from "@/src/lib/books/payments";
import { reportVendorStatement } from "@/src/lib/books/report-data";
import { reportParams } from "@/src/lib/books/report-params";
import { formatDate, formatPrice } from "@/src/lib/format";

const balance = (paise) => (paise < 0 ? <span className="cell-value">{formatPrice(-paise)} <small>advance</small></span> : formatPrice(paise));

export default async function StatementReportPage({ searchParams }) {
  // Default: this financial year (from 1 April) to today.
  const { today } = reportParams();
  const fyStart = `${Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 4 ? 1 : 0)}-04-01`;
  const params = reportParams({ from: fyStart, ...searchParams });
  const [active, archived] = await Promise.all([booksGetVendors({ status: "active" }), booksGetVendors({ status: "archived" })]);
  const vendors = [...active, ...archived];
  const vendorId = vendors.some((v) => v.id === searchParams?.vendor) ? searchParams.vendor : vendors[0]?.id;
  const s = vendorId ? await reportVendorStatement(vendorId, params.from, params.to) : null;
  const share = s && `https://wa.me/${s.vendor.whatsapp ? `91${s.vendor.whatsapp}` : ""}?text=${encodeURIComponent(statementText(s.vendor, s, { formatPrice, formatDate, businessName: siteConfig.name ?? "Maati Living", asOf: params.to }))}`;

  return <ReportFrame title={s ? `Statement · ${s.vendor.name}` : "Vendor statement"} report="statement" params={params} fields={["range"]}
    csvParams={{ vendor: vendorId ?? "", from: params.from, to: params.to }}
    extraFilters={<label className="field" htmlFor="rf-vendor"><span>Vendor</span>
      <select id="rf-vendor" name="vendor" defaultValue={vendorId}>
        {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}{v.status === "archived" ? " (archived)" : ""}</option>)}
      </select></label>}>
    {!s
      ? <div className="books-empty"><p>Add a vendor first.</p></div>
      : <>
          <section className="kpi-row kpi-row-4" aria-label="Statement figures">
            <div className="kpi"><span className="kpi-label">Opening</span><span className="kpi-value">{formatPrice(Math.abs(s.openingPaise))}</span><span className="kpi-note">{s.openingPaise < 0 ? "advance" : `on ${formatDate(params.from)}`}</span></div>
            <div className="kpi"><span className="kpi-label">Bills</span><span className="kpi-value">{formatPrice(s.billedPaise)}</span></div>
            <div className="kpi"><span className="kpi-label">Paid</span><span className="kpi-value">{formatPrice(s.paidPaise)}</span></div>
            <div className="kpi"><span className="kpi-label">{s.closingPaise < 0 ? "Advance with them" : "Balance due"}</span><span className="kpi-value">{formatPrice(Math.abs(s.closingPaise))}</span><span className="kpi-note">on {formatDate(params.to)}</span></div>
          </section>
          <p className="no-print"><a className="stock-save" href={share} target="_blank" rel="noreferrer"><MessageCircle size={14} /> Share on WhatsApp</a></p>
          <table className="admin-table table-cards statement">
            <thead><tr><th>Date</th><th>Entry</th><th className="num">Bill</th><th className="num">Paid</th><th className="num">Balance</th></tr></thead>
            <tbody>
              <tr><td data-label="Date">{formatDate(params.from)}</td><td data-label="Entry">Opening balance</td><td data-label="Bill" className="num"><span className="muted">—</span></td><td data-label="Paid" className="num"><span className="muted">—</span></td><td data-label="Balance" className="num">{balance(s.openingPaise)}</td></tr>
              {s.lines.map((line) => <tr key={`${line.kind}-${line.id}`} className={line.voided ? "is-void" : ""}>
                <td data-label="Date">{formatDate(line.date)}</td>
                <td data-label="Entry"><span className="cell-value"><a href={`/admin/books/${line.kind === "bill" ? "purchases" : "payments"}/${line.id}`}><strong>{line.label}</strong></a>{line.detail && <small>{line.voided ? `Voided · ${line.detail}` : line.detail}</small>}</span></td>
                <td data-label="Bill" className="num">{line.debitPaise ? formatPrice(line.debitPaise) : <span className="muted">—</span>}</td>
                <td data-label="Paid" className="num">{line.creditPaise ? formatPrice(line.creditPaise) : <span className="muted">—</span>}</td>
                <td data-label="Balance" className="num">{balance(line.balancePaise)}</td>
              </tr>)}
            </tbody>
            <tfoot><tr><th colSpan={4} scope="row">{s.closingPaise < 0 ? "Advance with them" : "Balance due"}</th><td className="num"><strong>{formatPrice(Math.abs(s.closingPaise))}</strong></td></tr></tfoot>
          </table>
        </>}
  </ReportFrame>;
}
