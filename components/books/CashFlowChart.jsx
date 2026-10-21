"use client";

import { useState } from "react";
import { formatMonth, formatPrice, formatSignedPrice } from "@/src/lib/format";

// Money in vs money out per month (two series, one axis from 0). In = madder, as on the revenue chart; out = the
// chart indigo --chart-out (validated with madder on cotton-2: lightness, chroma, CVD and contrast all pass).
// Identity never rests on colour alone: legend above, net figure under every month, tooltip and table view.
// A month whose money in is negative (more refunds than sales) draws no "in" bar; the tooltip and table show it.
const monthLabel = (month) => formatMonth(month, { short: true });
const compact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });
const signed = (paise) => formatSignedPrice(paise, { plus: true });
// Short net under each month ("+₹12K", "−₹3.4K") so six fit across a phone.
const shortSigned = (paise) => `${paise < 0 ? "−" : "+"}${compact.format(Math.abs(paise) / 100)}`;

function niceMaxRupees(maxRupees) {
  if (maxRupees <= 0) return 1000;
  const power = 10 ** Math.floor(Math.log10(maxRupees));
  return [1, 2, 4, 5, 10].find((multiple) => multiple * power >= maxRupees) * power;
}

export default function CashFlowChart({ months }) {
  const [active, setActive] = useState(null);
  const top = niceMaxRupees(Math.max(...months.flatMap((m) => [m.moneyInPaise, m.moneyOutPaise])) / 100);
  const ticks = [top, top / 2, 0];
  const height = (paise) => `${Math.max(paise, 0) / 100 / top * 100}%`;

  return <figure className="rev-chart cash-chart">
    <figcaption><span className="eyebrow">CASH FLOW</span><span>Last 6 months · money from orders (after refunds), and money paid to vendors and for expenses</span></figcaption>
    <ul className="cash-legend" aria-label="Legend">
      <li><span className="cash-swatch cash-in" aria-hidden="true" />Money in</li>
      <li><span className="cash-swatch cash-out" aria-hidden="true" />Money out</li>
    </ul>
    <div className="rev-plot">
      <div className="rev-axis" aria-hidden="true">
        {ticks.map((tick) => <span key={tick} style={{ bottom: `${(tick / top) * 100}%` }}>{compact.format(tick)}</span>)}
      </div>
      <div className="rev-area" onPointerLeave={() => setActive(null)}>
        {ticks.map((tick) => <span key={tick} className="rev-grid" style={{ bottom: `${(tick / top) * 100}%` }} aria-hidden="true" />)}
        <div className="rev-columns cash-columns" style={{ gridTemplateColumns: `repeat(${months.length}, 1fr)` }}>
          {months.map((m, index) => <button type="button" key={m.month} className={`rev-col cash-col${active === index ? " is-active" : ""}`}
            aria-label={`${monthLabel(m.month)}: money in ${formatPrice(m.moneyInPaise)}, money out ${formatPrice(m.moneyOutPaise)}, net ${signed(m.netPaise)}`}
            onPointerEnter={() => setActive(index)} onFocus={() => setActive(index)} onBlur={() => setActive(null)}>
            <span className="cash-pair">
              <span className="cash-bar cash-in" style={{ height: height(m.moneyInPaise) }} />
              <span className="cash-bar cash-out" style={{ height: height(m.moneyOutPaise) }} />
            </span>
            {active === index && <span className={`rev-tip${index > months.length - 3 ? " rev-tip-left" : index < 2 ? " rev-tip-right" : ""}`} role="presentation">
              <strong>{monthLabel(m.month)}</strong>
              <span>In {formatPrice(m.moneyInPaise)}{m.refundsPaise ? ` (after ${formatPrice(m.refundsPaise)} refunds)` : ""}</span>
              <span>Out {formatPrice(m.moneyOutPaise)}: vendors {formatPrice(m.vendorsPaise)}, expenses {formatPrice(m.expensesPaise)}</span>
              <span>Net {signed(m.netPaise)}</span>
            </span>}
          </button>)}
        </div>
      </div>
      <div className="rev-x cash-x" style={{ gridTemplateColumns: `repeat(${months.length}, 1fr)` }} aria-hidden="true">
        {months.map((m) => <span key={m.month} className="is-major">{monthLabel(m.month)}<small className={m.netPaise < 0 ? "cash-neg" : ""}>{shortSigned(m.netPaise)}</small></span>)}
      </div>
    </div>
    <details className="rev-table">
      <summary>Show as table</summary>
      <table className="admin-table">
        <thead><tr><th>Month</th><th className="num">Money in</th><th className="num">Vendors</th><th className="num">Expenses</th><th className="num">Net</th></tr></thead>
        <tbody>{[...months].reverse().map((m) => <tr key={m.month}><td>{monthLabel(m.month)}</td><td className="num">{formatPrice(m.moneyInPaise)}</td><td className="num">{formatPrice(m.vendorsPaise)}</td><td className="num">{formatPrice(m.expensesPaise)}</td><td className="num">{signed(m.netPaise)}</td></tr>)}</tbody>
      </table>
    </details>
  </figure>;
}
