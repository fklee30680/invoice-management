import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

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

type PdfTextRun = {
  x: number;
  y: number;
  text: string;
};

function unescapePdfString(value: string) {
  return value
    .replace(/\\([\\()])/g, "$1")
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\\d{1,3}/g, " ");
}

function decodePdfTextOperand(operand: string) {
  const parts = operand.match(/\((?:\\.|[^\\()])*\)/g) || [];
  return parts
    .map((part) => unescapePdfString(part.slice(1, -1)))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPdfTextRuns(streamText: string) {
  const runs: PdfTextRun[] = [];
  const blocks = streamText.match(/BT[\s\S]*?ET/g) || [];

  for (const block of blocks) {
    const textMatches = [...block.matchAll(/(?:\[([\s\S]*?)\]|(\((?:\\.|[^\\()])*\)))\s*TJ?/g)];
    if (textMatches.length === 0) continue;

    const tmMatch = block.match(/1\s+0\s+0\s+1\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm/);
    const x = tmMatch ? Number(tmMatch[1]) : 0;
    const y = tmMatch ? Number(tmMatch[2]) : 0;

    for (const match of textMatches) {
      const operand = match[1] ? `[${match[1]}]` : match[2] || "";
      const text = decodePdfTextOperand(operand);
      if (!text) continue;
      runs.push({ x, y, text });
    }
  }

  return runs;
}

function extractPdfText(content: Buffer) {
  const binary = content.toString("latin1");
  const streamRegex = /stream\r?\n/g;
  const runs: PdfTextRun[] = [];
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(binary))) {
    const start = match.index + match[0].length;
    const end = binary.indexOf("endstream", start);
    if (end < 0) continue;

    const chunk = content.subarray(start, end).toString("latin1").replace(/[\r\n]+$/, "");
    try {
      const inflated = inflateSync(Buffer.from(chunk, "latin1")).toString("latin1");
      runs.push(...extractPdfTextRuns(inflated));
    } catch {
      continue;
    }
  }

  const sorted = runs
    .sort((a, b) => (Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x));
  const lines: { y: number; parts: string[] }[] = [];

  for (const run of sorted) {
    const line = lines.find((item) => Math.abs(item.y - run.y) <= 2);
    if (line) {
      line.parts.push(run.text);
    } else {
      lines.push({ y: run.y, parts: [run.text] });
    }
  }

  return lines
    .map((line) => line.parts.join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function cleanCapturedValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractFromText(text: string): ExtractedInvoiceMetadata | null {
  const normalized = text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const vendorName = lines[0] || "";
  const invoiceNumber = cleanCapturedValue(
    normalized.match(/\bINVOICE\s*#?\s*[:\-]?\s*([A-Z0-9-]+)/i)?.[1] || "",
  );
  const poNumberRaw = cleanCapturedValue(
    normalized.match(/\bPO\b\s*[:#-]?\s*([A-Z0-9][A-Z0-9 \-]{1,20})/i)?.[1] || "",
  )
    .replace(/\s+(DATE|PURCHASED|SHIP|COMMENTS)\b.*$/i, "")
    .trim();
  const invoiceDate = cleanCapturedValue(
    normalized.match(/\bDATE\b\s*[:\-]?\s*((?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/\d{4})/i)?.[1] || "",
  );
  const amount =
    cleanCapturedValue(
      normalized.match(/\bTOTAL DUE\b\s*[:\-]?\s*\$?\s*([0-9][0-9,]*\.\d{2})/i)?.[1] || "",
    ) ||
    cleanCapturedValue(
      normalized.match(/\bINVOICE TOTAL\b\s*[:\-]?\s*\$?\s*([0-9][0-9,]*\.\d{2})/i)?.[1] || "",
    ) ||
    cleanCapturedValue(
      normalized.match(/\bTOTAL\b\s*[:\-]?\s*\$?\s*([0-9][0-9,]*\.\d{2})/i)?.[1] || "",
    );

  if (!vendorName && !invoiceNumber && !poNumberRaw && !amount) return null;

  return {
    vendorName,
    invoiceNumber,
    invoiceDate,
    amount,
    poNumber: poNumberRaw,
    summary: "Extracted from embedded PDF text using the local fallback parser.",
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

  if (mimeType === "application/pdf" || /\.pdf$/i.test(originalName)) {
    try {
      const file = await readFile(filePath);
      const extracted = extractFromText(extractPdfText(file));
      if (extracted) return extracted;
    } catch {
      // Fall through to the filename fallback.
    }
  }

  return fromFileName(originalName);
}
