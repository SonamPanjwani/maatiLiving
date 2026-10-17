import "server-only";
import { siteConfig } from "@/src/config/site";
import { formatPrice } from "./format";

// Optional order emails via Resend (https://resend.com). Without RESEND_API_KEY + EMAIL_FROM
// this is a no-op; orders still work and show in /admin/orders.
const apiKey = process.env.RESEND_API_KEY || "";
const from = process.env.EMAIL_FROM || "";
const notifyTo = process.env.ORDER_NOTIFY_EMAIL || "";
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export const isEmailConfigured = Boolean(apiKey && from);

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

export const ORDER_EMAIL_COLUMNS = "*, order_items(*)";

// extra: optional HTML block shown under the heading (e.g. tracking details).
function orderHtml(order, intro, extra = "") {
  const rows = order.order_items.map((item) => `<tr><td style="padding:8px 0;border-bottom:1px solid #ddd2bf">${escape(item.product_name)} × ${item.quantity}</td><td style="padding:8px 0;border-bottom:1px solid #ddd2bf;text-align:right">${formatPrice(item.unit_price_paise * item.quantity)}</td></tr>`).join("");
  const link = `${siteUrl}/orders/${order.order_number}?t=${order.access_token}`;
  return `<div style="background:#EDE4D3;padding:32px;font-family:Arial,sans-serif;color:#2A2622">
  <div style="max-width:520px;margin:0 auto;background:#F5EFE4;padding:32px">
    <p style="font-size:11px;letter-spacing:2px;color:#C68A2E;margin:0 0 12px">MAATI LIVING · ORDER ${escape(order.order_number)}</p>
    <h1 style="font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0 0 16px">${intro}</h1>
    ${extra}
    <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
      <tr><td style="padding:8px 0">Delivery</td><td style="padding:8px 0;text-align:right">${order.shipping_paise ? formatPrice(order.shipping_paise) : "Free"}</td></tr>
      <tr><td style="padding:8px 0;font-weight:bold">Total paid</td><td style="padding:8px 0;text-align:right;font-weight:bold">${formatPrice(order.total_paise)}</td></tr>
    </table>
    <p style="font-size:14px;line-height:1.6;margin:24px 0 0"><strong>Delivering to</strong><br>${escape(order.customer_name)}<br>${escape(order.address_line1)}${order.address_line2 ? `<br>${escape(order.address_line2)}` : ""}<br>${escape(order.city)}, ${escape(order.state)} ${escape(order.pincode)}<br>${escape(order.phone)}</p>
    <p style="margin:28px 0 0"><a href="${link}" style="background:#2A2622;color:#EDE4D3;padding:12px 16px;text-decoration:none;font-size:12px;letter-spacing:1.5px">VIEW YOUR ORDER</a></p>
  </div></div>`;
}

async function send(to, subject, html) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, reply_to: siteConfig.email }),
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
}

// Never throws: a failed email must not fail a paid order.
export async function sendOrderEmails(order) {
  if (!isEmailConfigured) return;
  const jobs = [send(order.email, `Your Maati Living order ${order.order_number}`, orderHtml(order, `Thank you, ${escape(order.customer_name.split(" ")[0])}.<br>We're getting your order ready.`))];
  if (notifyTo) jobs.push(send(notifyTo, `New order ${order.order_number} — ${formatPrice(order.total_paise)}`, orderHtml(order, "A new order just came in.")));
  const results = await Promise.allSettled(jobs);
  results.filter((result) => result.status === "rejected").forEach((result) => console.error("Order email failed:", result.reason));
}

// "On its way" email with courier + tracking number. Never throws.
export async function sendShippedEmail(order) {
  if (!isEmailConfigured) return;
  const tracking = order.tracking_number
    ? `<p style="font-size:14px;line-height:1.6;margin:0 0 20px;padding:12px 16px;background:#EDE4D3"><strong>${escape(order.tracking_courier || "Courier")}</strong><br>Tracking number: ${escape(order.tracking_number)}</p>`
    : "";
  try {
    await send(order.email, `Your Maati Living order ${order.order_number} is on its way`, orderHtml(order, "It's on its way.", tracking));
  } catch (cause) {
    console.error("Shipped email failed:", cause);
  }
}
