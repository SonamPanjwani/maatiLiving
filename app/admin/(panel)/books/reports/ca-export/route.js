import { NextResponse } from "next/server";
import { strToU8, zipSync } from "fflate";
import { getCurrentAdmin } from "@/src/lib/auth";
import { caPackFiles } from "@/src/lib/books/report-csv";
import { caExportData } from "@/src/lib/books/report-data";
import { reportParams } from "@/src/lib/books/report-params";

export const dynamic = "force-dynamic";

// CA export pack: one ZIP of CSVs for a month (sales, purchases, purchase items, vendor payments, expenses,
// stock valuation at month end). Admin only.
export async function GET(request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  const { caMonth } = reportParams(Object.fromEntries(new URL(request.url).searchParams));
  const data = await caExportData(caMonth);
  const files = caPackFiles(data);
  const readme = [
    `Maati Living — books for ${caMonth} (${data.from} to ${data.to}).`,
    "Amounts are in rupees. Dates are India time (YYYY-MM-DD).",
    "sales.csv: every order paid this month, including ones later refunded or cancelled (see status / refunded).",
    "purchases.csv / purchase_items.csv: purchases with a bill dated this month, or ordered this month with no bill yet.",
    "vendor_payments.csv / expenses.csv: everything dated this month; voided rows are kept with status = voided.",
    `stock_valuation.csv: stock and cost at the end of ${data.to}.`,
  ].join("\r\n");
  const zip = zipSync({
    "README.txt": strToU8(readme),
    ...Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])),
  });
  return new NextResponse(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="maati-books-${caMonth}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
