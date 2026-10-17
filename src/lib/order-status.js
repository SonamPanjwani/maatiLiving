export const STATUS_LABELS = {
  pending: "Awaiting payment",
  failed: "Payment failed",
  paid: "Paid — to ship",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

// Admin order list tabs (also used by the CSV export).
export const ORDER_TABS = [
  { key: "to-ship", label: "To ship", statuses: ["paid"] },
  { key: "shipped", label: "Shipped", statuses: ["shipped"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered"] },
  { key: "closed", label: "Cancelled / refunded", statuses: ["cancelled", "refunded"] },
  { key: "all", label: "All paid", statuses: ["paid", "shipped", "delivered", "cancelled", "refunded"] },
  { key: "unpaid", label: "Unpaid / failed", statuses: ["pending", "failed"] },
];
