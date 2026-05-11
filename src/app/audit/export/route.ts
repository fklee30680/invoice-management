import type { NextRequest } from "next/server";
import {
  auditLogCsv,
  auditLogQueryFromSearchParams,
  filterAuditEvents,
  sortAuditEvents,
} from "@/lib/audit-log";
import { requireApUser } from "@/lib/session";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await requireApUser();
  const data = await readData();
  const query = auditLogQueryFromSearchParams(request.nextUrl.searchParams, data.auditLogSettings);
  const filteredEvents = filterAuditEvents(data, query.filters);
  const sortedEvents = sortAuditEvents(data, filteredEvents, query.sort, query.direction);
  const csv = auditLogCsv(data, sortedEvents);
  const today = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="audit-log-${today}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
