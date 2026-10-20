"use client";

import { Printer } from "lucide-react";

// Opens the browser's print dialog (choose "Save as PDF" to get a PDF).
export default function PrintButton({ label = "Print / save as PDF" }) {
  return <button type="button" className="button button-dark" onClick={() => window.print()}><Printer size={14} /> {label}</button>;
}
