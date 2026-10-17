"use client";

import { useState } from "react";
import { formatPrice } from "@/src/lib/format";

// Daily revenue, single series (madder columns on cotton-2; validated ≥3:1). Text stays in ink tokens.
// Hover/focus on any column shows its value; the table view below carries every value too.
const compact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });
const dayLabel = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const fmtDay = (day) => dayLabel.format(new Date(`${day}T00:00:00Z`));

// Round the top of the axis up to a clean number of rupees whose half is also clean (1, 2, 4, 5 × 10^n).
function niceMaxRupees(maxRupees) {
  if (maxRupees <= 0) return 1000;
  const power = 10 ** Math.floor(Math.log10(maxRupees));
  const step = [1, 2, 4, 5, 10].find((multiple) => multiple * power >= maxRupees);
  return step * power;
}

export default function RevenueChart({ days }) {
  const [active, setActive] = useState(null);
  const top = niceMaxRupees(Math.max(...days.map((entry) => entry.revenuePaise)) / 100);
  const ticks = [top, top / 2, 0];
  const peakIndex = days.reduce((best, entry, index) => (entry.revenuePaise > (days[best]?.revenuePaise ?? 0) ? index : best), -1);
  const labelEvery = 7;

  return <figure className="rev-chart">
    <figcaption><span className="eyebrow">REVENUE PER DAY</span><span>Last 30 days, paid orders</span></figcaption>
    <div className="rev-plot">
      <div className="rev-axis" aria-hidden="true">
        {ticks.map((tick) => <span key={tick} style={{ bottom: `${(tick / top) * 100}%` }}>{compact.format(tick)}</span>)}
      </div>
      <div className="rev-area" onPointerLeave={() => setActive(null)}>
        {ticks.map((tick) => <span key={tick} className="rev-grid" style={{ bottom: `${(tick / top) * 100}%` }} aria-hidden="true" />)}
        <div className="rev-columns">
          {days.map((entry, index) => {
            const height = (entry.revenuePaise / 100 / top) * 100;
            const label = `${fmtDay(entry.day)}: ${formatPrice(entry.revenuePaise)}, ${entry.orders} ${entry.orders === 1 ? "order" : "orders"}`;
            return <button
              type="button"
              key={entry.day}
              className={`rev-col${active === index ? " is-active" : ""}`}
              aria-label={label}
              onPointerEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
            >
              {entry.revenuePaise > 0 && <span className="rev-bar" style={{ height: `${height}%` }} />}
              {index === peakIndex && entry.revenuePaise > 0 && <span className="rev-peak" style={{ bottom: `${height}%` }}>{compact.format(entry.revenuePaise / 100)}</span>}
              {active === index && <span className={`rev-tip${index > days.length - 6 ? " rev-tip-left" : ""}`} role="presentation">
                <strong>{formatPrice(entry.revenuePaise)}</strong>
                <span>{fmtDay(entry.day)} · {entry.orders} {entry.orders === 1 ? "order" : "orders"}</span>
              </span>}
            </button>;
          })}
        </div>
      </div>
      <div className="rev-x" aria-hidden="true">
        {days.map((entry, index) => {
          const fromEnd = days.length - 1 - index; // anchor labels on today so the last one never collides
          return <span key={entry.day} className={fromEnd % (labelEvery * 2) === 0 ? "is-major" : ""}>{fromEnd % labelEvery === 0 ? fmtDay(entry.day) : ""}</span>;
        })}
      </div>
    </div>
    <details className="rev-table">
      <summary>Show as table</summary>
      <table className="admin-table">
        <thead><tr><th>Day</th><th>Orders</th><th>Revenue</th></tr></thead>
        <tbody>{[...days].reverse().map((entry) => <tr key={entry.day}><td>{fmtDay(entry.day)}</td><td>{entry.orders}</td><td>{formatPrice(entry.revenuePaise)}</td></tr>)}</tbody>
      </table>
    </details>
  </figure>;
}
