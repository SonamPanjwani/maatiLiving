import { PAY_STATE } from "@/src/lib/books/payments";
import { formatPrice } from "@/src/lib/format";

// Payment state of a purchase: Paid / Part paid / Unpaid (+ overdue), or a dash when it isn't a bill yet.
export default function PayStatus({ pay, showBalance = true }) {
  if (!pay?.state) return <span className="muted">—</span>;
  return <span className="cell-value">
    <span className={`badge pay-status pay-status-${pay.state}${pay.overdueDays > 0 ? " is-overdue" : ""}`}>{PAY_STATE[pay.state]}</span>
    {showBalance && pay.balancePaise > 0 && <small className={pay.overdueDays > 0 ? "admin-warn" : ""}>{formatPrice(pay.balancePaise)} to pay{pay.overdueDays > 0 ? ` · ${pay.overdueDays} ${pay.overdueDays === 1 ? "day" : "days"} overdue` : ""}</small>}
  </span>;
}
