import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/src/lib/auth";
import { ageingCsv, expensesCsv, marginCsv, movementsCsv, pnlCsv, statementCsv, valuationCsv } from "@/src/lib/books/report-csv";
import { reportExpenses, reportPayablesAgeing, reportProductMargins, reportProfitAndLoss, reportStockMovements, reportStockValuation, reportVendorStatement } from "@/src/lib/books/report-data";
import { reportParams } from "@/src/lib/books/report-params";

export const dynamic = "force-dynamic";

// CSV download of any Books report, same filters as its page (admin only).
export async function GET(request) {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  const search = Object.fromEntries(new URL(request.url).searchParams);
  const p = reportParams(search);
  let body;
  let name;
  switch (search.report) {
    case "pnl": body = pnlCsv(await reportProfitAndLoss(p.fromMonth, p.toMonth)); name = `profit-loss-${p.fromMonth}-to-${p.toMonth}`; break;
    case "margin": {
      const margins = await reportProductMargins(p.from, p.to);
      body = marginCsv(search.by === "category" ? margins.categories : margins.products); name = `margin-${search.by === "category" ? "categories" : "products"}-${p.from}-to-${p.to}`; break;
    }
    case "statement": {
      const statement = search.vendor ? await reportVendorStatement(search.vendor, p.from, p.to) : null;
      if (!statement) return NextResponse.json({ error: "Choose a vendor" }, { status: 400 });
      body = statementCsv(statement); name = `statement-${statement.vendor.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${p.from}-to-${p.to}`; break;
    }
    case "ageing": body = ageingCsv(await reportPayablesAgeing()); name = `payables-ageing-${p.today}`; break;
    case "valuation": body = valuationCsv(await reportStockValuation(p.asOf)); name = `stock-valuation-${p.asOf}`; break;
    case "movements": body = movementsCsv(await reportStockMovements(p.from, p.to)); name = `stock-ledger-${p.from}-to-${p.to}`; break;
    case "expenses": body = expensesCsv((await reportExpenses(p.from, p.to)).expenses); name = `expenses-${p.from}-to-${p.to}`; break;
    default: return NextResponse.json({ error: "Unknown report" }, { status: 400 });
  }
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="maati-${name}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
