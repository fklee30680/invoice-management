import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { currentUser, canAccessInvoice } from "@/lib/session";
import { getInvoiceFile, getUploadPath, readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const data = await readData();
  const user = await currentUser();
  const file = getInvoiceFile(data, id);

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const invoice = data.invoices.find((item) => item.id === file.invoiceId);
  if (!user || !invoice || !canAccessInvoice(user, invoice)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readFile(getUploadPath(file.storedName));
  const headers = new Headers();
  headers.set("Content-Type", file.mimeType);
  headers.set(
    "Content-Disposition",
    `attachment; filename="${file.originalName.replace(/"/g, "")}"`,
  );
  headers.set("Content-Length", String(body.length));

  return new NextResponse(body, { headers });
}
