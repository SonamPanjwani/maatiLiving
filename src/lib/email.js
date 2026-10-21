import "server-only";
import nodemailer from "nodemailer";
import { siteConfig } from "@/src/config/site";
import { formatPrice } from "./format";

// Order emails over SMTP (the shop's Hostinger mailbox: smtp.hostinger.com, port 465, SSL).
// Without SMTP_HOST / SMTP_USER / SMTP_PASS / MAIL_FROM this is a no-op; orders still work and show in /admin/orders.
const smtp = {
  host: process.env.SMTP_HOST || "",
  port: Number(process.env.SMTP_PORT || 465),
  user: process.env.SMTP_USER || "",
  pass: process.env.SMTP_PASS || "",
};
const from = process.env.MAIL_FROM || "";
const notifyTo = process.env.ORDER_NOTIFY_EMAIL || "";
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export const isEmailConfigured = Boolean(smtp.host && smtp.user && smtp.pass && from);

let transport = null;
function getTransport() {
  // Port 465 = SSL from the first byte; 587 = STARTTLS. Short timeouts so a slow mail server can't hold up an order.
  transport ??= nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
  return transport;
}

// Plain-text copy of an HTML email (spam filters like having one).
const toText = (html) => html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|tr|h1|div)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\n{3,}/g, "\n\n").trim();

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
  await getTransport().sendMail({ from, to, subject, html, text: toText(html), replyTo: siteConfig.email || from });
}

// One-off check from /admin → Delivery & email: sends a short email to `to`. Throws with the SMTP error so the
// admin sees what's wrong (wrong password, blocked port…).
export async function sendTestEmail(to) {
  if (!isEmailConfigured) throw new Error("Email isn't set up: add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM.");
  const html = `<div style="background:#EDE4D3;padding:32px;font-family:Arial,sans-serif;color:#2A2622">
  <div style="max-width:520px;margin:0 auto;background:#F5EFE4;padding:32px">
    <p style="font-size:11px;letter-spacing:2px;color:#C68A2E;margin:0 0 12px">MAATI LIVING · TEST EMAIL</p>
    <h1 style="font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0 0 16px">Email is working.</h1>
    <p style="font-size:14px;line-height:1.6;margin:0">This came from ${escape(from)} through ${escape(smtp.host)}. Order confirmations, payment confirmations and shipping emails will look like they come from the same address.</p>
  </div></div>`;
  await send(to, "Maati Living test email", html);
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

// Direct UPI: tell the customer how to get back to their payment page (it's the only place to pay).
export async function sendUpiOrderPlacedEmail(order) {
  if (!isEmailConfigured) return;
  const note = `<p style="font-size:14px;line-height:1.6;margin:0 0 20px;padding:12px 16px;background:#EDE4D3">Please pay <strong>${formatPrice(order.total_paise)}</strong> by UPI using the button below. We'll start packing as soon as your payment reaches us.</p>`;
  try {
    await send(order.email, `Complete your Maati Living order ${order.order_number}`, orderHtml(order, "Order placed.<br>Now, the payment.", note));
  } catch (cause) {
    console.error("UPI order email failed:", cause);
  }
}

// Direct UPI: tell the shop a customer says they've paid, so it gets checked quickly.
export async function sendUpiPaymentToCheckEmail(order) {
  if (!isEmailConfigured || !notifyTo) return;
  const note = `<p style="font-size:14px;line-height:1.6;margin:0 0 20px;padding:12px 16px;background:#EDE4D3">Customer says they paid <strong>${formatPrice(order.total_paise)}</strong>. Transaction ID: <strong>${escape(order.payment_reference ?? "—")}</strong>.<br>Check your own bank / UPI app before confirming in /admin → Orders → UPI to verify.</p>`;
  try {
    await send(notifyTo, `UPI payment to check: ${order.order_number}, ${formatPrice(order.total_paise)}`, orderHtml(order, "A UPI payment to check.", note));
  } catch (cause) {
    console.error("UPI check email failed:", cause);
  }
}
