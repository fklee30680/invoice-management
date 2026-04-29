import { NextResponse } from "next/server";
import { runEscalationCheck } from "@/lib/escalations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenFromRequest(request: Request) {
  const header = request.headers.get("authorization") || "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return request.headers.get("x-cron-secret") || "";
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || tokenFromRequest(request) !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runEscalationCheck({ dryRun: false });
  return NextResponse.json({
    runAt: result.runAt,
    sentCount: result.sentCount,
    failedCount: result.failedCount,
    evaluatedEscalations: result.candidates.length,
    errors: result.errors,
  });
}
