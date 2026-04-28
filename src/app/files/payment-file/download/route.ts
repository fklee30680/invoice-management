import { NextRequest } from "next/server";
import { buildPaymentCsv } from "@/lib/payment-file";
import { requireApUser } from "@/lib/session";
import { statusesForCompleted } from "@/lib/status-config";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await requireApUser();
  const data = await readData();
  const ids = new Set(request.nextUrl.searchParams.getAll("invoiceId"));
  const completedStatuses = statusesForCompleted(data);
  const invoices = data.invoices.filter((invoice) => {
    const inManualPaymentQueue =
      completedStatuses.includes(invoice.status) && !invoice.paymentProcessed;
    if (!inManualPaymentQueue) return false;
    return ids.size === 0 || ids.has(invoice.id);
  });
  const csv = buildPaymentCsv(data, invoices);
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="payment-file-${stamp}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
