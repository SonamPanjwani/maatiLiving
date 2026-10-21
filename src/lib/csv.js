// CSV for spreadsheets (Excel, Google Sheets, Zoho/Tally imports). Pure; used by every admin export.

// Quote every cell; neutralise values a spreadsheet would run as a formula (=, +, -, @, tab, CR).
export function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

// columns: [[title, (row) => value], …]. bom: prefix so Excel reads UTF-8 (₹, Indian names) correctly.
export function toCsv(columns, rows, { bom = true } = {}) {
  const lines = [columns.map(([title]) => csvCell(title)).join(","), ...rows.map((row) => columns.map(([, get]) => csvCell(get(row))).join(","))];
  return `${bom ? "﻿" : ""}${lines.join("\r\n")}`;
}

// Paise → "1234.50" (plain number, no ₹ or grouping, so spreadsheets and accounting imports read it).
export const csvRupees = (paise) => (paise == null ? "" : (paise / 100).toFixed(2));
