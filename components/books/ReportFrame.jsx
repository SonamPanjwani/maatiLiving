import { Download } from "lucide-react";
import PrintButton from "@/components/books/PrintButton";
import { formatDate, formatMonth } from "@/src/lib/format";

// Shared frame for a Books report: heading, filters (GET form), CSV download and print.
// fields: any of "range" (from/to dates), "months" (from/to month), "asOf" (one date), plus `children` for extras.
// periodNote: extra words after the period (e.g. "by category"), so the printout says what it shows.
export default function ReportFrame({ title, intro, report, params, fields = [], hidden = {}, csvParams = {}, extraFilters = null, print = true, periodNote = "", children }) {
  const csv = `/admin/books/reports/csv?${new URLSearchParams({ report, ...csvParams })}`;
  const period = fields.includes("range") ? `${formatDate(params.from)} – ${formatDate(params.to)}`
    : fields.includes("months") ? `${formatMonth(params.fromMonth)} – ${formatMonth(params.toMonth)}`
    : fields.includes("asOf") ? `As of ${formatDate(params.asOf)}` : `As of ${formatDate(params.today)}`;

  return <>
    <div className="admin-heading">
      <div><p className="eyebrow"><a className="inline-link" href="/admin/books/reports">REPORTS</a></p><h1>{title}</h1><p className="admin-note report-period">{period}{periodNote && ` · ${periodNote}`}</p></div>
      <div className="vendor-actions no-print">
        <a className="stock-save" href={csv}><Download size={14} /> Download CSV</a>
        {print && <PrintButton label="Print / PDF" />}
      </div>
    </div>
    {intro && <p className="admin-note report-intro">{intro}</p>}
    <p className="print-only report-print-head">Maati Living · {title} · generated {formatDate(params.today)}</p>
    {(fields.length > 0 || extraFilters) && <form className="admin-filters no-print" action={`/admin/books/reports/${report}`}>
      {Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {extraFilters}
      {fields.includes("range") && <>
        <label className="field" htmlFor="rf-from"><span>From</span><input id="rf-from" type="date" name="from" defaultValue={params.from} max={params.today} /></label>
        <label className="field" htmlFor="rf-to"><span>To</span><input id="rf-to" type="date" name="to" defaultValue={params.to} max={params.today} /></label>
      </>}
      {fields.includes("months") && <>
        <label className="field" htmlFor="rf-fm"><span>From month</span><input id="rf-fm" type="month" name="fromMonth" defaultValue={params.fromMonth} max={params.today.slice(0, 7)} /></label>
        <label className="field" htmlFor="rf-tm"><span>To month</span><input id="rf-tm" type="month" name="toMonth" defaultValue={params.toMonth} max={params.today.slice(0, 7)} /></label>
      </>}
      {fields.includes("asOf") && <label className="field" htmlFor="rf-as"><span>As of</span><input id="rf-as" type="date" name="asOf" defaultValue={params.asOf} max={params.today} /></label>}
      <button type="submit" className="button button-dark">Show</button>
    </form>}
    {children}
  </>;
}
