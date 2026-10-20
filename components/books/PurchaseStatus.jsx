import { PURCHASE_STATUS } from "@/src/lib/books/purchases";

// Status label for a purchase: filled when received, outlined while open, muted when cancelled.
export default function PurchaseStatus({ status }) {
  return <span className={`badge po-status po-status-${status}`}>{PURCHASE_STATUS[status] ?? status}</span>;
}
