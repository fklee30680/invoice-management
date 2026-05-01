import { NextRequest } from "next/server";
import { invoiceFieldEnabled } from "@/lib/invoice-fields";
import { validateInvoicePoNumber } from "@/lib/po-validation";
import { canAccessInvoice, currentUser } from "@/lib/session";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    invoiceId?: string;
    poNumber?: string;
    vendorName?: string;
    vendorNumber?: string;
  } | null;
  if (!body) return Response.json({ error: "Invalid request" }, { status: 400 });

  const data = await readData();
  const invoice = body.invoiceId
    ? data.invoices.find((item) => item.id === body.invoiceId)
    : undefined;

  if (body.invoiceId && (!invoice || !canAccessInvoice(user, invoice))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (!invoiceFieldEnabled(data, "poNumber")) {
    return Response.json({
      enabled: false,
      poNumber: body.poNumber || "",
      found: false,
      invoiceVendorName: body.vendorName || invoice?.vendorName || "",
      vendorMatches: false,
      severity: "none",
      message: "PO Number is disabled in Invoice Fields.",
    });
  }

  const result = validateInvoicePoNumber(data, {
    poNumber: body.poNumber || invoice?.poNumber || "",
    invoiceVendorName: body.vendorName || invoice?.vendorName || "",
    invoiceVendorNumber: body.vendorNumber || invoice?.vendorNumber || "",
  });

  return Response.json({
    ...result,
    allowVendorUpdateFromPo: data.poValidationSettings.allowVendorUpdateFromPo,
    purchaseOrder: result.purchaseOrder
      ? {
          id: result.purchaseOrder.id,
          poNumber: result.purchaseOrder.poNumber,
          vendorName: result.purchaseOrder.vendorName,
          vendorNumber: result.purchaseOrder.vendorNumber,
        }
      : undefined,
  });
}
