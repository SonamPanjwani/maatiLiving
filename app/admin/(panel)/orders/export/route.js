import { NextResponse } from "next/server";
import { adminExportOrders } from "@/src/lib/admin-catalog";
import { getCurrentAdmin } from "@/src/lib/auth";
import { ORDER_TABS, adminStatusLabel } from "@/src/lib/order-status";

export const dynamic = "force-dynamic";

const rupees = (paise) => (paise == null ? "" : (paise / 100).toFixed(2));
const ist = (value) => (value ? new Intl.DateTimeFormat("en-IN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value)) : "");

// Quote every cell; neutralise values a spreadsheet would run as a formula (=, +, -, @).
function cell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const COLUMNS = [
  ["Order", (o) => o.order_number],
  ["Placed (IST)", (o) => ist(o.created_at)],
  ["Paid (IST)", (o) => ist(o.paid_at)],
  ["Status", (o) => adminStatusLabel(o)],
  ["Payment", (o) => (o.payment_method === "upi_manual" ? "UPI (direct)" : "Razorpay")],
  ["Customer", (o) => o.customer_name],
  ["Email", (o) => o.email],
  ["Phone", (o) => o.phone],
  ["Address", (o) => [o.address_line1, o.address_line2].filter(Boolean).join(", ")],
  ["City", (o) => o.city],
  ["State", (o) => o.state],
  ["PIN", (o) => o.pincode],
  ["Items", (o) => o.order_items.map((item) => `${item.product_name} x ${item.quantity}`).join("; ")],
  ["Subtotal (₹)", (o) => rupees(o.subtotal_paise)],
  ["Delivery (₹)", (o) => rupees(o.shipping_paise)],
  ["Total (₹)", (o) => rupees(o.total_paise)],
  ["Refunded (₹)", (o) => rupees(o.refund_amount_paise)],
  ["Courier", (o) => o.tracking_courier],
  ["Tracking no.", (o) => o.tracking_number],
  ["Payment ref", (o) => o.razorpay_payment_id || o.payment_reference],
  ["Note", (o) => o.notes],
];

export async function GET(request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not authorised" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const tab = ORDER_TABS.find((item) => item.key === params.get("tab")) ?? ORDER_TABS.find((item) => item.key === "all");
  const orders = await adminExportOrders({ statuses: tab.statuses, paymentMethod: tab.paymentMethod, paidOnly: tab.paidOnly, q: params.get("q"), from: params.get("from"), to: params.get("to") });

  const lines = [COLUMNS.map(([title]) => cell(title)).join(","), ...orders.map((order) => COLUMNS.map(([, get]) => cell(get(order))).join(","))];
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  // BOM so Excel opens UTF-8 (₹, Indian names) correctly.
  return new NextResponse(`﻿${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="maati-orders-${tab.key}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
