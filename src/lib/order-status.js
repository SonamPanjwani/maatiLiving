export const STATUS_LABELS = {
  pending: "Awaiting payment",
  failed: "Payment failed",
  paid: "Paid — to ship",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

// Admin label, aware of direct-UPI orders waiting for the payment to be checked.
export function adminStatusLabel(order) {
  if (order.status === "pending" && order.payment_method === "upi_manual") return order.payment_reference ? "UPI — check payment" : "UPI — awaiting payment";
  return STATUS_LABELS[order.status] ?? order.status;
}

// Admin order list tabs (also used by the CSV export). paymentMethod narrows a tab further.
export const ORDER_TABS = [
  { key: "to-ship", label: "To ship", statuses: ["paid"] },
  { key: "upi", label: "UPI to verify", statuses: ["pending"], paymentMethod: "upi_manual" },
  { key: "shipped", label: "Shipped", statuses: ["shipped"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "closed", label: "Cancelled / refunded", statuses: ["cancelled", "refunded"] },
  { key: "all", label: "All paid", statuses: ["paid", "shipped", "delivered", "cancelled", "refunded"], paidOnly: true },
  { key: "unpaid", label: "Unpaid / failed", statuses: ["pending", "failed"], paymentMethod: "razorpay" },
];
