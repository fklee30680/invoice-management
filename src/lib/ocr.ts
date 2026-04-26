import { readFile } from "node:fs/promises";

type ExtractedInvoiceMetadata = {
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  amount: string;
  poNumber: string;
  summary: string;
};

const API_VERSION = "2024-11-30";

function fromFileName(fileName: string): ExtractedInvoiceMetadata {
  const cleaned = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  const poMatch = fileName.match(/(?:PO[-_\s]?)(\d{3,})/i);
  const invoiceMatch = fileName.match(/(?:INV|INVOICE)[-_\s]?([A-Z0-9-]+)/i);
  const amountMatch = fileName.match(/\$?(\d{2,}(?:\.\d{2})?)/);

  return {
    vendorName: cleaned.split(/\s+/).slice(0, 3).join(" ") || "Unknown Vendor",
    invoiceNumber: invoiceMatch?.[1] || "",
    invoiceDate: "",
    amount: amountMatch?.[1] || "",
    poNumber: poMatch ? `PO-${poMatch[1]}` : "",
    summary:
      "Local OCR placeholder used. Add Azure Document Intelligence environment variables to enable live extraction.",
  };
}

function getField(content: unknown): string {
  if (!content || typeof content !== "object") return "";
  const record = content as Record<string, unknown>;
  const value =
    record.valueString ||
    record.valueDate ||
    record.valueCurrency ||
    record.valueNumber ||
    record.content;

  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && "amount" in value) {
    return String((value as { amount?: unknown }).amount ?? "");
  }
  return "";
}

async function extractWithAzure(
  filePath: string,
  mimeType: string,
): Promise<ExtractedInvoiceMetadata | null> {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  if (!endpoint || !key) return null;

  const file = await readFile(filePath);
  const analyze = await fetch(
    `${endpoint.replace(/\/$/, "")}/documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=${API_VERSION}`,
    {
      method: "POST",
      headers: {
        "Content-Type": mimeType || "application/octet-stream",
        "Ocp-Apim-Subscription-Key": key,
      },
      body: file,
    },
  );

  if (!analyze.ok) {
    throw new Error(`Azure OCR request failed with ${analyze.status}`);
  }

  const operationLocation = analyze.headers.get("operation-location");
  if (!operationLocation) {
    throw new Error("Azure OCR did not return an operation location.");
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const poll = await fetch(operationLocation, {
      headers: { "Ocp-Apim-Subscription-Key": key },
    });
    const body = (await poll.json()) as Record<string, unknown>;
    if (body.status === "succeeded") {
      const analyzeResult = body.analyzeResult as Record<string, unknown> | undefined;
      const documents = analyzeResult?.documents as Record<string, unknown>[] | undefined;
      const fields = documents?.[0]?.fields as Record<string, unknown> | undefined;
      return {
        vendorName: getField(fields?.VendorName),
        invoiceNumber: getField(fields?.InvoiceId),
        invoiceDate: getField(fields?.InvoiceDate),
        amount: getField(fields?.InvoiceTotal),
        poNumber: getField(fields?.PurchaseOrder),
        summary: "Extracted with Azure Document Intelligence prebuilt invoice model.",
      };
    }
    if (body.status === "failed") {
      throw new Error("Azure OCR failed to process the invoice.");
    }
  }

  throw new Error("Azure OCR timed out while processing the invoice.");
}

export async function extractInvoiceMetadata(
  filePath: string,
  originalName: string,
  mimeType: string,
): Promise<ExtractedInvoiceMetadata> {
  try {
    const azure = await extractWithAzure(filePath, mimeType);
    if (azure) return azure;
  } catch (error) {
    return {
      ...fromFileName(originalName),
      summary: error instanceof Error ? `OCR failed: ${error.message}` : "OCR failed.",
    };
  }

  return fromFileName(originalName);
}

