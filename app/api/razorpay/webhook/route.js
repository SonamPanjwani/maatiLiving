import { NextResponse } from "next/server";
import { markOrderFailed, markOrderPaid } from "@/src/lib/orders";
import { verifyWebhookSignature } from "@/src/lib/razorpay";

// Razorpay → Settings → Webhooks: URL https://<site>/api/razorpay/webhook,
// events payment.captured, order.paid, payment.failed; secret = RAZORPAY_WEBHOOK_SECRET.
// Backstop for customers who pay but close the tab before the browser confirms.
export async function POST(request) {
  const rawBody = await request.text();
  if (!verifyWebhookSignature(rawBody, request.headers.get("x-razorpay-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(rawBody);
  const payment = event?.payload?.payment?.entity;
  try {
    if ((event.event === "payment.captured" || event.event === "order.paid") && payment?.order_id) {
      await markOrderPaid(payment.order_id, payment.id);
    } else if (event.event === "payment.failed" && payment?.order_id) {
      await markOrderFailed(payment.order_id);
    }
  } catch (cause) {
    console.error("Razorpay webhook:", cause);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 }); // Razorpay retries
  }
  return NextResponse.json({ ok: true });
}
