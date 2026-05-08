import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import type { ExtractionSource, ValidationStatus } from "./types";
import { normalizePoNumber } from "./utils";

export type ExtractedLineItem = {
  quantity: string;
  description: string;
  unitPrice: string;
  lineTotal: string;
  confidence: number;
};

export type ExtractedFieldCandidate = {
  fieldName: string;
  rawValue: string;
  normalizedValue: string;
  pageNumber?: number;
  boundingBox?: number[];
  nearbyLabel?: string;
  extractionSource: ExtractionSource;
  confidence: number;
  selected: boolean;
  validationStatus: ValidationStatus;
  validationMessage?: string;
};

export type ExtractedInvoiceMetadata = {
  vendorName: string;
  vendorNumber: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: string;
  poNumber: string;
  paymentTerms: string;
  currency: string;
  subtotal: string;
  tax: string;
  shipping: string;
  totalDue: string;
  buyerName: string;
  buyerAddress: string;
  shipToName: string;
  shipToAddress: string;
  lineItems: ExtractedLineItem[];
  summary: string;
  provider: ExtractionSource;
  providerModel: string;
  rawText: string;
  rawJson?: unknown;
  documentType: "invoice" | "non_invoice" | "unknown";
  documentConfidence: number;
  ocrConfidence: number;
  extractionConfidence: number;
  candidates: ExtractedFieldCandidate[];
  fallbackReason?: string;
};

const API_VERSION = "2024-11-30";

type PdfTextRun = {
  x: number;
  y: number;
  text: string;
};

type TextCandidateInput = {
  fieldName: string;
  rawValue: string;
  nearbyLabel?: string;
  confidence?: number;
  normalize?: (value: string) => string;
};

function emptyMetadata(
  provider: ExtractionSource,
  providerModel: string,
  summary: string,
  rawText = "",
): ExtractedInvoiceMetadata {
  return {
    vendorName: "",
    vendorNumber: "",
    invoiceNumber: "",
    invoiceDate: "",
    dueDate: "",
    amount: "",
    poNumber: "",
    paymentTerms: "",
    currency: "USD",
    subtotal: "",
    tax: "",
    shipping: "",
    totalDue: "",
    buyerName: "",
    buyerAddress: "",
    shipToName: "",
    shipToAddress: "",
    lineItems: [],
    summary,
    provider,
    providerModel,
    rawText,
    documentType: "unknown",
    documentConfidence: 0,
    ocrConfidence: 0,
    extractionConfidence: 0,
    candidates: [],
  };
}

function makeCandidate(
  source: ExtractionSource,
  input: TextCandidateInput,
): ExtractedFieldCandidate {
  const rawValue = cleanCapturedValue(input.rawValue);
  const normalizedValue = input.normalize ? input.normalize(rawValue) : rawValue;
  return {
    fieldName: input.fieldName,
    rawValue,
    normalizedValue,
    nearbyLabel: input.nearbyLabel || "",
    extractionSource: source,
    confidence: input.confidence ?? 0.82,
    selected: Boolean(normalizedValue),
    validationStatus: normalizedValue ? "not_checked" : "failed",
    validationMessage: normalizedValue ? "" : "No value extracted.",
  };
}

function applyCandidates(metadata: ExtractedInvoiceMetadata) {
  const selected = new Map(
    metadata.candidates
      .filter((candidate) => candidate.selected)
      .map((candidate) => [candidate.fieldName, candidate.normalizedValue]),
  );
  metadata.vendorName = selected.get("vendor_name") || metadata.vendorName;
  metadata.vendorNumber = selected.get("vendor_number") || metadata.vendorNumber;
  metadata.invoiceNumber = selected.get("invoice_number") || metadata.invoiceNumber;
  metadata.invoiceDate = selected.get("invoice_date") || metadata.invoiceDate;
  metadata.dueDate = selected.get("due_date") || metadata.dueDate;
  metadata.poNumber = selected.get("po_number") || metadata.poNumber;
  metadata.paymentTerms = selected.get("payment_terms") || metadata.paymentTerms;
  metadata.currency = selected.get("currency") || metadata.currency || "USD";
  metadata.subtotal = selected.get("subtotal") || metadata.subtotal;
  metadata.tax = selected.get("tax") || metadata.tax;
  metadata.shipping = selected.get("shipping") || metadata.shipping;
  metadata.totalDue = selected.get("total_due") || metadata.totalDue;
  metadata.amount = metadata.totalDue || metadata.amount;
  metadata.buyerName = selected.get("buyer_name") || metadata.buyerName;
  metadata.buyerAddress = selected.get("buyer_address") || metadata.buyerAddress;
  metadata.shipToName = selected.get("ship_to_name") || metadata.shipToName;
  metadata.shipToAddress = selected.get("ship_to_address") || metadata.shipToAddress;
  const selectedConfidences = metadata.candidates
    .filter((candidate) => candidate.selected)
    .map((candidate) => candidate.confidence);
  metadata.extractionConfidence =
    selectedConfidences.length > 0
      ? roundConfidence(
          selectedConfidences.reduce((sum, item) => sum + item, 0) /
            selectedConfidences.length,
        )
      : 0;
  return metadata;
}

function fromFileName(fileName: string, reason = ""): ExtractedInvoiceMetadata {
  const cleaned = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
  const poMatch = fileName.match(/(?:PO[-_\s]?)(\d{3,})/i);
  const invoiceMatch = fileName.match(/(?:INV|INVOICE)[-_\s]?([A-Z0-9-]+)/i);
  const amountMatch = fileName.match(/\$?(\d{2,}(?:\.\d{2})?)/);
  const metadata = emptyMetadata(
    "filename_fallback",
    "filename-patterns",
    reason ||
      "Filename fallback used. The extracted values are low confidence and require AP review.",
    fileName,
  );
  metadata.documentType = "unknown";
  metadata.documentConfidence = 0.2;
  metadata.ocrConfidence = 0.2;
  metadata.fallbackReason = reason;
  metadata.candidates = [
    makeCandidate("filename_fallback", {
      fieldName: "vendor_name",
      rawValue: cleaned.split(/\s+/).slice(0, 3).join(" ") || "Unknown Vendor",
      nearbyLabel: "filename",
      confidence: 0.2,
      normalize: normalizeInvoiceVendorName,
    }),
    makeCandidate("filename_fallback", {
      fieldName: "invoice_number",
      rawValue: invoiceMatch?.[1] || "",
      nearbyLabel: "filename",
      confidence: 0.25,
      normalize: normalizeIdentifier,
    }),
    makeCandidate("filename_fallback", {
      fieldName: "po_number",
      rawValue: poMatch ? `PO-${poMatch[1]}` : "",
      nearbyLabel: "filename",
      confidence: 0.25,
      normalize: normalizePoNumber,
    }),
    makeCandidate("filename_fallback", {
      fieldName: "total_due",
      rawValue: amountMatch?.[1] || "",
      nearbyLabel: "filename",
      confidence: 0.2,
      normalize: normalizeAmount,
    }),
  ];
  return applyCandidates(metadata);
}

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

  const sorted = runs.sort((a, b) => (Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x - b.x));
  const lines: { y: number; parts: string[] }[] = [];

  for (const run of sorted) {
    const line = lines.find((item) => Math.abs(item.y - run.y) <= 2);
    if (line) line.parts.push(run.text);
    else lines.push({ y: run.y, parts: [run.text] });
  }

  return lines
    .map((line) => line.parts.join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function cleanCapturedValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeText(text: string) {
  return text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
}

function classifyInvoiceText(text: string) {
  const normalized = text.toLowerCase();
  const signals = [
    /\binvoice\b/.test(normalized),
    /\binvoice\s*#|\binvoice\s*(number|no\.?)/.test(normalized),
    /\bpo\b|\bpurchase order\b/.test(normalized),
    /\binvoice date\b|\bdate\b/.test(normalized),
    /\bbill[-\s]?to\b|\bpurchased[-\s]?by\b|\bship[-\s]?to\b/.test(normalized),
    /\bsubtotal\b/.test(normalized),
    /\bsales tax\b|\btax\b/.test(normalized),
    /\bshipping\b|\bfreight\b/.test(normalized),
    /\btotal due\b|\bamount due\b|\binvoice total\b/.test(normalized),
    /\b(qty|quantity|unit price|line total|description)\b/.test(normalized),
  ];
  const score = signals.filter(Boolean).length / signals.length;
  return {
    documentType: score >= 0.45 ? "invoice" as const : "unknown" as const,
    confidence: roundConfidence(Math.min(0.98, Math.max(0.2, score))),
  };
}

export function extractInvoiceMetadataFromText(
  text: string,
  source: ExtractionSource = "embedded_pdf_text",
  providerModel = "embedded-pdf-text-parser",
): ExtractedInvoiceMetadata | null {
  const normalized = normalizeText(text);
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const classification = classifyInvoiceText(normalized);
  const metadata = emptyMetadata(
    source,
    providerModel,
    source === "embedded_pdf_text"
      ? "Extracted from embedded PDF text using the local fallback parser."
      : "Extracted from document text.",
    normalized,
  );
  metadata.documentType = classification.documentType;
  metadata.documentConfidence = classification.confidence;
  metadata.ocrConfidence = source === "embedded_pdf_text" ? 0.72 : 0.85;

  const vendorName = firstLikelyVendorLine(lines);
  const invoiceNumber = matchValue(normalized, [
    /\bINVOICE\s*#\s*[:\-]?\s*([A-Z0-9-]+)/i,
    /\bINVOICE\s*(?:NUMBER|NO\.?)\s*[:#\-]?\s*([A-Z0-9-]+)/i,
  ]);
  const poNumber = matchValue(normalized, [
    /\bPO\b\s*[:#\-]?\s*([A-Z0-9][A-Z0-9 \-]{1,24})/i,
    /\bPURCHASE\s+ORDER\b\s*[:#\-]?\s*([A-Z0-9][A-Z0-9 \-]{1,24})/i,
  ]).replace(/\s+(DATE|PURCHASED|SHIP|COMMENTS|SUBTOTAL)\b.*$/i, "");
  const invoiceDate = matchValue(normalized, [
    /\bINVOICE\s+DATE\b\s*[:\-]?\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i,
    /\bDATE\b\s*[:\-]?\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i,
  ]);
  const dueDate = matchValue(normalized, [
    /\bDUE\s+DATE\b\s*[:\-]?\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i,
  ]);
  const subtotal = matchMoney(normalized, [/\bSUBTOTAL\b\s*[:\-]?\s*\$?\s*([0-9][0-9,]*\.\d{2})/i]);
  const tax = matchMoney(normalized, [
    /\bSALES\s+TAX\b\s*[:\-]?\s*\$?\s*([0-9][0-9,]*\.\d{2})/i,
    /\bTAX\b\s*[:\-]?\s*\$?\s*([0-9][0-9,]*\.\d{2})/i,
  ]);
  const shipping = matchMoney(normalized, [
    /\bSHIPPING(?:\s+AND\s+HANDLING)?\b\s*[:\-]?\s*\$?\s*([0-9][0-9,]*\.\d{2})/i,
    /\bFREIGHT\b\s*[:\-]?\s*\$?\s*([0-9][0-9,]*\.\d{2})/i,
  ]);
  const totalDue = matchMoney(normalized, [
    /\bTOTAL\s+DUE\b\s*[:\-]?\s*\$?\s*([0-9][0-9,]*\.\d{2})/i,
    /\bAMOUNT\s+DUE\b\s*[:\-]?\s*\$?\s*([0-9][0-9,]*\.\d{2})/i,
    /\bINVOICE\s+TOTAL\b\s*[:\-]?\s*\$?\s*([0-9][0-9,]*\.\d{2})/i,
    /\bTOTAL\b\s*[:\-]?\s*\$?\s*([0-9][0-9,]*\.\d{2})/i,
  ]);
  const buyerName = sectionValue(lines, /^(purchased[-\s]?by|buyer|bill[-\s]?to)\b/i);
  const buyerAddress = sectionAddress(lines, /^(purchased[-\s]?by|buyer|bill[-\s]?to)\b/i);
  const shipToName = sectionValue(lines, /^ship[-\s]?to\b/i);
  const shipToAddress = sectionAddress(lines, /^ship[-\s]?to\b/i);

  metadata.candidates = [
    { fieldName: "vendor_name", rawValue: vendorName, nearbyLabel: "vendor header", normalize: normalizeInvoiceVendorName },
    { fieldName: "invoice_number", rawValue: invoiceNumber, nearbyLabel: "INVOICE #", normalize: normalizeIdentifier },
    { fieldName: "invoice_date", rawValue: invoiceDate, nearbyLabel: "DATE", normalize: normalizeDate },
    { fieldName: "due_date", rawValue: dueDate, nearbyLabel: "DUE DATE", normalize: normalizeDate },
    { fieldName: "po_number", rawValue: poNumber, nearbyLabel: "PO", normalize: normalizePoNumber },
    { fieldName: "subtotal", rawValue: subtotal, nearbyLabel: "SUBTOTAL", normalize: normalizeAmount },
    { fieldName: "tax", rawValue: tax, nearbyLabel: "SALES TAX", normalize: normalizeAmount },
    { fieldName: "shipping", rawValue: shipping, nearbyLabel: "SHIPPING", normalize: normalizeAmount },
    { fieldName: "total_due", rawValue: totalDue, nearbyLabel: "TOTAL DUE", normalize: normalizeAmount },
    { fieldName: "buyer_name", rawValue: buyerName, nearbyLabel: "PURCHASED BY", normalize: cleanCapturedValue },
    { fieldName: "buyer_address", rawValue: buyerAddress, nearbyLabel: "PURCHASED BY", normalize: cleanCapturedValue },
    { fieldName: "ship_to_name", rawValue: shipToName, nearbyLabel: "SHIP TO", normalize: cleanCapturedValue },
    { fieldName: "ship_to_address", rawValue: shipToAddress, nearbyLabel: "SHIP TO", normalize: cleanCapturedValue },
  ].map((item) => makeCandidate(source, item));

  metadata.lineItems = extractLineItems(lines);
  for (const lineItem of metadata.lineItems.slice(0, 1)) {
    metadata.candidates.push(
      makeCandidate(source, {
        fieldName: "line_item_quantity",
        rawValue: lineItem.quantity,
        nearbyLabel: "line item quantity",
        confidence: lineItem.confidence,
      }),
      makeCandidate(source, {
        fieldName: "line_item_description",
        rawValue: lineItem.description,
        nearbyLabel: "line item description",
        confidence: lineItem.confidence,
      }),
      makeCandidate(source, {
        fieldName: "line_item_unit_price",
        rawValue: lineItem.unitPrice,
        nearbyLabel: "unit price",
        confidence: lineItem.confidence,
        normalize: normalizeAmount,
      }),
      makeCandidate(source, {
        fieldName: "line_item_total",
        rawValue: lineItem.lineTotal,
        nearbyLabel: "line total",
        confidence: lineItem.confidence,
        normalize: normalizeAmount,
      }),
    );
  }

  if (!metadata.vendorName && !metadata.invoiceNumber && !metadata.poNumber && !metadata.totalDue) {
    return null;
  }

  return applyCandidates(metadata);
}

function getField(content: unknown): { value: string; confidence: number; pageNumber?: number; boundingBox?: number[] } {
  if (!content || typeof content !== "object") return { value: "", confidence: 0 };
  const record = content as Record<string, unknown>;
  const value =
    record.valueString ||
    record.valueDate ||
    record.valueCurrency ||
    record.valueNumber ||
    record.content;

  let output = "";
  if (typeof value === "string") output = value;
  else if (typeof value === "number") output = String(value);
  else if (value && typeof value === "object" && "amount" in value) {
    output = String((value as { amount?: unknown }).amount ?? "");
  }

  const boundingRegions = record.boundingRegions as
    | { pageNumber?: number; polygon?: number[] }[]
    | undefined;
  return {
    value: output,
    confidence: typeof record.confidence === "number" ? record.confidence : 0.85,
    pageNumber: boundingRegions?.[0]?.pageNumber,
    boundingBox: boundingRegions?.[0]?.polygon,
  };
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
      const document = documents?.[0];
      const fields = document?.fields as Record<string, unknown> | undefined;
      const rawText = String(analyzeResult?.content || "");
      const classification = classifyInvoiceText(rawText);
      const metadata = emptyMetadata(
        "azure_document_intelligence",
        "prebuilt-invoice",
        "Extracted with Azure Document Intelligence prebuilt invoice model.",
        rawText,
      );
      metadata.rawJson = body;
      metadata.documentType = classification.documentType;
      const azureDocumentConfidence = document?.confidence;
      metadata.documentConfidence =
        typeof azureDocumentConfidence === "number"
          ? roundConfidence(azureDocumentConfidence)
          : classification.confidence;
      metadata.ocrConfidence = metadata.documentConfidence;

      const fieldMap: Array<{
        fieldName: string;
        azureName: string;
        label: string;
        normalize?: (value: string) => string;
      }> = [
        { fieldName: "vendor_name", azureName: "VendorName", label: "Vendor Name", normalize: normalizeInvoiceVendorName },
        { fieldName: "vendor_number", azureName: "VendorTaxId", label: "Vendor Number", normalize: normalizeIdentifier },
        { fieldName: "invoice_number", azureName: "InvoiceId", label: "Invoice ID", normalize: normalizeIdentifier },
        { fieldName: "invoice_date", azureName: "InvoiceDate", label: "Invoice Date", normalize: normalizeDate },
        { fieldName: "due_date", azureName: "DueDate", label: "Due Date", normalize: normalizeDate },
        { fieldName: "po_number", azureName: "PurchaseOrder", label: "Purchase Order", normalize: normalizePoNumber },
        { fieldName: "payment_terms", azureName: "PaymentTerm", label: "Payment Terms" },
        { fieldName: "subtotal", azureName: "SubTotal", label: "Subtotal", normalize: normalizeAmount },
        { fieldName: "tax", azureName: "TotalTax", label: "Tax", normalize: normalizeAmount },
        { fieldName: "shipping", azureName: "Freight", label: "Freight", normalize: normalizeAmount },
        { fieldName: "total_due", azureName: "InvoiceTotal", label: "Invoice Total", normalize: normalizeAmount },
        { fieldName: "buyer_name", azureName: "CustomerName", label: "Customer Name" },
        { fieldName: "ship_to_name", azureName: "ShippingAddressRecipient", label: "Ship To" },
        { fieldName: "ship_to_address", azureName: "ShippingAddress", label: "Shipping Address" },
      ];

      metadata.candidates = fieldMap.map((mapping) => {
        const extracted = getField(fields?.[mapping.azureName]);
        return {
          ...makeCandidate("azure_document_intelligence", {
            fieldName: mapping.fieldName,
            rawValue: extracted.value,
            nearbyLabel: mapping.label,
            confidence: extracted.confidence,
            normalize: mapping.normalize,
          }),
          pageNumber: extracted.pageNumber,
          boundingBox: extracted.boundingBox,
        };
      });
      return applyCandidates(metadata);
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
    return fromFileName(
      originalName,
      error instanceof Error ? `OCR failed: ${error.message}` : "OCR failed.",
    );
  }

  if (mimeType === "application/pdf" || /\.pdf$/i.test(originalName)) {
    try {
      const file = await readFile(filePath);
      const extracted = extractInvoiceMetadataFromText(extractPdfText(file));
      if (extracted) return extracted;
    } catch {
      // Fall through to the filename fallback.
    }
  }

  return fromFileName(originalName);
}

function firstLikelyVendorLine(lines: string[]) {
  return (
    lines.find(
      (line) =>
        line.length <= 80 &&
        !/^(invoice|date|po|purchase order|bill[-\s]?to|ship[-\s]?to|subtotal|tax|total)/i.test(line),
    ) || ""
  );
}

function matchValue(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanCapturedValue(match[1]);
  }
  return "";
}

function matchMoney(text: string, patterns: RegExp[]) {
  return matchValue(text, patterns);
}

function sectionValue(lines: string[], label: RegExp) {
  const index = lines.findIndex((line) => label.test(line));
  if (index < 0) return "";
  const inline = lines[index].replace(label, "").replace(/^[:#\-\s]+/, "").trim();
  if (inline) return inline;
  return lines[index + 1] || "";
}

function sectionAddress(lines: string[], label: RegExp) {
  const index = lines.findIndex((line) => label.test(line));
  if (index < 0) return "";
  const values: string[] = [];
  for (let next = index + 2; next < lines.length; next += 1) {
    const line = lines[next];
    if (/^(ship[-\s]?to|purchased[-\s]?by|buyer|bill[-\s]?to|comments|subtotal|tax|shipping|total)/i.test(line)) {
      break;
    }
    if (values.length >= 3) break;
    values.push(line);
  }
  return values.join(", ");
}

function extractLineItems(lines: string[]) {
  const items: ExtractedLineItem[] = [];
  for (const line of lines) {
    const match = line.match(
      /^\s*([0-9]+(?:\s*(?:TB|GB|MB|EA|EACH|HR|HRS|HOUR|HOURS|DAY|DAYS))?)\s+(.+?)\s+\$?\s*([0-9][0-9,]*\.\d{2})\s+\$?\s*([0-9][0-9,]*\.\d{2})\s*$/i,
    );
    if (!match) continue;
    const description = match[2].trim();
    if (/subtotal|tax|shipping|total/i.test(description)) continue;
    items.push({
      quantity: cleanCapturedValue(match[1]),
      description,
      unitPrice: normalizeAmount(match[3]),
      lineTotal: normalizeAmount(match[4]),
      confidence: 0.78,
    });
  }
  return items;
}

function normalizeDate(value: string) {
  const cleaned = cleanCapturedValue(value);
  if (!cleaned) return "";
  const iso = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return cleaned;
  const match = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return cleaned;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function normalizeAmount(value: string) {
  const cleaned = cleanCapturedValue(value).replace(/[$,]/g, "");
  if (!cleaned) return "";
  const match = cleaned.match(/(-?)(\d+)(?:\.(\d{1,2}))?/);
  if (!match) return cleaned;
  const sign = match[1] || "";
  const dollars = match[2];
  const cents = (match[3] || "00").padEnd(2, "0").slice(0, 2);
  return `${sign}${dollars}.${cents}`;
}

function normalizeIdentifier(value: string) {
  return cleanCapturedValue(value).replace(/^#/, "");
}

function normalizeInvoiceVendorName(value: string) {
  return cleanCapturedValue(value).replace(/\s+/g, " ");
}

function roundConfidence(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}
