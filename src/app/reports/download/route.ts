import { NextResponse } from "next/server";
import {
  buildReportMetrics,
  buildReportPdf,
  filteredReportInvoices,
  parseReportFilters,
  reportFileName,
} from "@/lib/reports";
import { requireApUser } from "@/lib/session";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireApUser();
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const filters = parseReportFilters(query);
  const data = await readData();
  const invoices = filteredReportInvoices(data, filters);
  const metrics = buildReportMetrics(data, invoices, filters);
  const pdf = await buildReportPdf({
    data,
    filters,
    generatedAt: new Date(),
    invoices,
    metrics,
  });

  const headers = new Headers();
  headers.set("Content-Type", "application/pdf");
  headers.set(
    "Content-Disposition",
    `attachment; filename="${reportFileName(filters)}"`,
  );
  headers.set("Content-Length", String(pdf.length));
  headers.set("Cache-Control", "no-store");

  return new NextResponse(pdf, { headers });
}
