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
  scoringReasons?: string[];
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
  selected?: boolean;
  validationStatus?: ValidationStatus;
  validationMessage?: string;
  pageNumber?: number;
  boundingBox?: number[];
  scoringReasons?: string[];
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
    pageNumber: input.pageNumber,
    boundingBox: input.boundingBox,
    nearbyLabel: input.nearbyLabel || "",
    extractionSource: source,
    confidence: roundConfidence(input.confidence ?? 0.5),
    selected: input.selected ?? false,
    validationStatus:
      input.validationStatus || (normalizedValue ? "not_checked" : "failed"),
    validationMessage:
      input.validationMessage || (normalizedValue ? "" : "No value extracted."),
    scoringReasons: input.scoringReasons || [],
  };
}

const FIELD_SELECTION_THRESHOLDS: Record<string, number> = {
  vendor_name: 0.65,
  vendor_number: 0.55,
  invoice_number: 0.7,
  invoice_date: 0.7,
  due_date: 0.65,
  po_number: 0.7,
  payment_terms: 0.55,
  currency: 0.55,
  subtotal: 0.65,
  tax: 0.6,
  shipping: 0.6,
  total_due: 0.75,
  buyer_name: 0.55,
  buyer_address: 0.55,
  ship_to_name: 0.55,
  ship_to_address: 0.55,
  line_item_quantity: 0.5,
  line_item_description: 0.5,
  line_item_unit_price: 0.5,
  line_item_total: 0.5,
};

function candidateThreshold(fieldName: string) {
  return FIELD_SELECTION_THRESHOLDS[fieldName] ?? 0.65;
}

function selectBestCandidates(candidates: ExtractedFieldCandidate[]) {
  const groups = new Map<string, ExtractedFieldCandidate[]>();
  for (const candidate of candidates) {
    const group = groups.get(candidate.fieldName) || [];
    group.push(candidate);
    groups.set(candidate.fieldName, group);
  }

  for (const group of groups.values()) {
    const best = group
      .filter((candidate) => candidate.normalizedValue)
      .sort((left, right) => right.confidence - left.confidence)[0];
    const threshold = best ? candidateThreshold(best.fieldName) : 1;
    for (const candidate of group) {
      const selected = Boolean(best && candidate === best && best.confidence >= threshold);
      candidate.selected = selected;
      if (!candidate.normalizedValue) {
        candidate.validationStatus = "failed";
        candidate.validationMessage = "No value extracted.";
      } else if (selected) {
        candidate.validationStatus = "passed";
        candidate.validationMessage = [
          "Selected as the best OCR candidate.",
          ...(candidate.scoringReasons || []),
        ].join(" ");
      } else {
        candidate.validationStatus = "warning";
        candidate.validationMessage = [
          best && candidate === best
            ? `Best candidate was below the ${Math.round(threshold * 100)}% selection threshold.`
            : "Alternate candidate was not selected.",
          ...(candidate.scoringReasons || []),
        ].join(" ");
      }
    }
  }

  return candidates;
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
      scoringReasons: ["Filename fallback is low confidence and requires AP review."],
    }),
    makeCandidate("filename_fallback", {
      fieldName: "invoice_number",
      rawValue: invoiceMatch?.[1] || "",
      nearbyLabel: "filename",
      confidence: 0.25,
      normalize: normalizeIdentifier,
      scoringReasons: ["Filename fallback is low confidence and requires AP review."],
    }),
    makeCandidate("filename_fallback", {
      fieldName: "po_number",
      rawValue: poMatch ? `PO-${poMatch[1]}` : "",
      nearbyLabel: "filename",
      confidence: 0.25,
      normalize: normalizePoNumber,
      scoringReasons: ["Filename fallback is low confidence and requires AP review."],
    }),
    makeCandidate("filename_fallback", {
      fieldName: "total_due",
      rawValue: amountMatch?.[1] || "",
      nearbyLabel: "filename",
      confidence: 0.2,
      normalize: normalizeAmount,
      scoringReasons: ["Filename fallback is low confidence and requires AP review."],
    }),
  ];
  selectBestCandidates(metadata.candidates);
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

type InvoiceTextBlockType =
  | "header"
  | "vendor"
  | "invoice_info"
  | "bill_to"
  | "ship_to"
  | "remit_to"
  | "line_items"
  | "totals"
  | "footer"
  | "unknown";

type InvoiceTextLine = {
  text: string;
  index: number;
  pageNumber?: number;
  x?: number;
  y?: number;
  blockType: InvoiceTextBlockType;
};

function analyzeInvoiceLines(lines: string[]): InvoiceTextLine[] {
  let currentBlock: InvoiceTextBlockType = "header";
  return lines.map((line, index) => {
    const normalized = line.toLowerCase();
    let blockType = currentBlock;

    if (/^(ship[-\s]?to|deliver[-\s]?to)\b/i.test(line)) {
      currentBlock = "ship_to";
      blockType = "ship_to";
    } else if (/^(bill[-\s]?to|purchased[-\s]?by|buyer|customer)\b/i.test(line)) {
      currentBlock = "bill_to";
      blockType = "bill_to";
    } else if (/^(remit[-\s]?to|vendor|payee)\b/i.test(line)) {
      currentBlock = "remit_to";
      blockType = "remit_to";
    } else if (/\b(qty|quantity)\b.*\b(description|unit price|line total|amount)\b/i.test(line)) {
      currentBlock = "line_items";
      blockType = "line_items";
    } else if (/\b(subtotal|sales tax|tax|shipping|freight|total due|amount due|invoice total|balance due)\b/i.test(line)) {
      currentBlock = "totals";
      blockType = "totals";
    } else if (/\b(invoice\s*#|invoice\s*(number|no\.?)|inv\s*(#|no\.?)|purchase order|p\.?\s*o\.?\s*#?\b|date|terms)\b/i.test(line)) {
      currentBlock = "invoice_info";
      blockType = "invoice_info";
    } else if (index <= 5 && !/^(bill[-\s]?to|ship[-\s]?to|purchased[-\s]?by|subtotal|tax|total)/i.test(line)) {
      blockType = "header";
    } else if (currentBlock === "line_items" && normalized.match(/\b(subtotal|tax|shipping|total)\b/)) {
      currentBlock = "totals";
      blockType = "totals";
    }

    return { text: line, index, blockType };
  });
}

function score(value: number) {
  return roundConfidence(value);
}

function pushCandidate(
  candidates: ExtractedFieldCandidate[],
  source: ExtractionSource,
  input: TextCandidateInput,
) {
  if (!input.rawValue) return;
  const candidate = makeCandidate(source, input);
  if (!candidate.normalizedValue) return;
  const duplicate = candidates.some(
    (existing) =>
      existing.fieldName === candidate.fieldName &&
      existing.normalizedValue.toLowerCase() === candidate.normalizedValue.toLowerCase() &&
      existing.nearbyLabel === candidate.nearbyLabel,
  );
  if (!duplicate) candidates.push(candidate);
}

function looksLikeDate(value: string) {
  return Boolean(normalizeDate(value).match(/^\d{4}-\d{2}-\d{2}$/));
}

function looksLikeAmount(value: string) {
  return /^\$?\s*-?\d[\d,]*(?:\.\d{1,2})?$/.test(cleanCapturedValue(value));
}

function invalidVendorCandidate(line: string) {
  const normalized = line.trim();
  if (!normalized) return true;
  if (normalized.length > 80) return true;
  if (/^(invoice|inv\s*#|date|po|p\.?\s*o\.?|purchase order|bill[-\s]?to|ship[-\s]?to|purchased[-\s]?by|buyer|customer|subtotal|tax|shipping|freight|total|amount due|qty|quantity|description|unit price|line total|terms)\b/i.test(normalized)) {
    return true;
  }
  if (/^\W*$/.test(normalized)) return true;
  if (/^[\d\s#.,:/-]+$/.test(normalized)) return true;
  if (/@|www\.|https?:\/\//i.test(normalized)) return true;
  if (/^\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}$/.test(normalized)) return true;
  if (/\b(street|st\.|road|rd\.|avenue|ave\.|suite|city|state|zip)\b/i.test(normalized) && !/[A-Za-z]{4,}/.test(normalized.replace(/\d/g, ""))) {
    return true;
  }
  return false;
}

function addVendorCandidates(
  candidates: ExtractedFieldCandidate[],
  analyzed: InvoiceTextLine[],
  source: ExtractionSource,
) {
  for (const line of analyzed.slice(0, 10)) {
    if (invalidVendorCandidate(line.text)) continue;
    const reasons: string[] = [];
    let confidence = 0.42;
    if (line.blockType === "header" || line.blockType === "vendor") {
      confidence += 0.25;
      reasons.push("Candidate appears in the header/vendor area.");
    }
    if (line.index <= 2) {
      confidence += 0.12;
      reasons.push("Candidate appears near the top of the document.");
    }
    const nextLines = analyzed.slice(line.index + 1, line.index + 4).map((item) => item.text).join(" ");
    if (/\b(st|street|rd|road|ave|avenue|suite|city|state|zip|[A-Z]{2}\s+\d{5})\b/i.test(nextLines)) {
      confidence += 0.08;
      reasons.push("Candidate is followed by address-like text.");
    }
    if (line.blockType === "bill_to" || line.blockType === "ship_to") {
      confidence -= 0.35;
      reasons.push("Candidate appears in a buyer or ship-to section.");
    }
    if (/^(city of|county of|town of|department of)\b/i.test(line.text)) {
      confidence -= 0.25;
      reasons.push("Candidate looks like a buyer/government organization.");
    }
    pushCandidate(candidates, source, {
      fieldName: "vendor_name",
      rawValue: line.text,
      nearbyLabel: line.blockType === "header" ? "header/vendor area" : line.blockType,
      confidence: score(confidence),
      normalize: normalizeInvoiceVendorName,
      scoringReasons: reasons,
    });
  }
}

function addLabelCandidates(
  candidates: ExtractedFieldCandidate[],
  analyzed: InvoiceTextLine[],
  source: ExtractionSource,
  input: {
    fieldName: string;
    labels: RegExp[];
    normalize?: (value: string) => string;
    baseConfidence: number;
    nearbyLabel: string;
    rejectLabel?: RegExp;
    valuePattern?: RegExp;
  },
) {
  for (const line of analyzed) {
    if (input.rejectLabel?.test(line.text)) continue;
    for (const label of input.labels) {
      const inline = line.text.match(label);
      const rawInline = inline?.[1] || "";
      const nextLine = !rawInline && analyzed[line.index + 1] ? analyzed[line.index + 1].text : "";
      const rawValue = rawInline || nextLine;
      if (!rawValue) continue;
      const value = input.valuePattern ? rawValue.match(input.valuePattern)?.[0] || "" : rawValue;
      if (!value) continue;
      const reasons = [`Candidate was found near ${input.nearbyLabel} label.`];
      let confidence = input.baseConfidence;
      if (line.blockType === "invoice_info" || line.blockType === "header") confidence += 0.08;
      if (looksLikeDate(value) && !input.fieldName.includes("date")) {
        confidence -= 0.3;
        reasons.push("Candidate looks like a date.");
      }
      if (looksLikeAmount(value) && !["subtotal", "tax", "shipping", "total_due"].includes(input.fieldName)) {
        confidence -= 0.25;
        reasons.push("Candidate looks like an amount.");
      }
      pushCandidate(candidates, source, {
        fieldName: input.fieldName,
        rawValue: value,
        nearbyLabel: input.nearbyLabel,
        confidence: score(confidence),
        normalize: input.normalize,
        scoringReasons: reasons,
      });
    }
  }
}

function addAmountCandidates(
  candidates: ExtractedFieldCandidate[],
  analyzed: InvoiceTextLine[],
  source: ExtractionSource,
) {
  const amountPattern = /\$?\s*-?\d[\d,]*(?:\.\d{1,2})?/;
  const amountFields = [
    {
      fieldName: "subtotal",
      label: "SUBTOTAL",
      labels: [/\bsubtotal\b\s*[:\-]?\s*(\$?\s*-?\d[\d,]*(?:\.\d{1,2})?)/i],
      confidence: 0.78,
    },
    {
      fieldName: "tax",
      label: "SALES TAX",
      labels: [
        /\bsales\s+tax\b\s*[:\-]?\s*(\$?\s*-?\d[\d,]*(?:\.\d{1,2})?)/i,
        /\btax\b\s*[:\-]?\s*(\$?\s*-?\d[\d,]*(?:\.\d{1,2})?)/i,
      ],
      confidence: 0.74,
    },
    {
      fieldName: "shipping",
      label: "SHIPPING",
      labels: [
        /\bshipping(?:\s+and\s+handling)?\b\s*[:\-]?\s*(\$?\s*-?\d[\d,]*(?:\.\d{1,2})?)/i,
        /\bfreight\b\s*[:\-]?\s*(\$?\s*-?\d[\d,]*(?:\.\d{1,2})?)/i,
      ],
      confidence: 0.74,
    },
    {
      fieldName: "total_due",
      label: "TOTAL DUE",
      labels: [
        /\btotal\s+due\b\s*[:\-]?\s*(\$?\s*-?\d[\d,]*(?:\.\d{1,2})?)/i,
        /\bamount\s+due\b\s*[:\-]?\s*(\$?\s*-?\d[\d,]*(?:\.\d{1,2})?)/i,
        /\binvoice\s+total\b\s*[:\-]?\s*(\$?\s*-?\d[\d,]*(?:\.\d{1,2})?)/i,
        /\bbalance\s+due\b\s*[:\-]?\s*(\$?\s*-?\d[\d,]*(?:\.\d{1,2})?)/i,
        /\btotal\b\s*[:\-]?\s*(\$?\s*-?\d[\d,]*(?:\.\d{1,2})?)/i,
      ],
      confidence: 0.82,
    },
  ];

  for (const field of amountFields) {
    for (const line of analyzed) {
      for (const label of field.labels) {
        const match = line.text.match(label);
        const amount = match?.[1]?.match(amountPattern)?.[0] || "";
        if (!amount) continue;
        let confidence = field.confidence;
        const reasons = [`Candidate was found near ${field.label} label.`];
        if (line.blockType === "totals") {
          confidence += 0.08;
          reasons.push("Candidate appears in the totals section.");
        }
        if (field.fieldName === "total_due" && /\b(subtotal|tax|shipping|freight)\b/i.test(line.text)) {
          confidence -= 0.35;
          reasons.push("Candidate appeared near subtotal/tax/freight wording.");
        }
        pushCandidate(candidates, source, {
          fieldName: field.fieldName,
          rawValue: amount,
          nearbyLabel: field.label,
          confidence: score(confidence),
          normalize: normalizeAmount,
          scoringReasons: reasons,
        });
      }
    }
  }
}

function addSectionCandidates(
  candidates: ExtractedFieldCandidate[],
  lines: string[],
  source: ExtractionSource,
) {
  const buyerName = sectionValue(lines, /^(purchased[-\s]?by|buyer|bill[-\s]?to|customer)\b/i);
  const buyerAddress = sectionAddress(lines, /^(purchased[-\s]?by|buyer|bill[-\s]?to|customer)\b/i);
  const shipToName = sectionValue(lines, /^ship[-\s]?to\b/i);
  const shipToAddress = sectionAddress(lines, /^ship[-\s]?to\b/i);

  [
    ["buyer_name", buyerName, "PURCHASED BY"],
    ["buyer_address", buyerAddress, "PURCHASED BY"],
    ["ship_to_name", shipToName, "SHIP TO"],
    ["ship_to_address", shipToAddress, "SHIP TO"],
  ].forEach(([fieldName, rawValue, nearbyLabel]) => {
    pushCandidate(candidates, source, {
      fieldName,
      rawValue,
      nearbyLabel,
      confidence: 0.72,
      normalize: cleanCapturedValue,
      scoringReasons: [`Candidate was extracted from the ${nearbyLabel} section.`],
    });
  });

  [
    [buyerName, "Bill To/Purchased By"],
    [shipToName, "Ship To"],
  ].forEach(([rawValue, section]) => {
    pushCandidate(candidates, source, {
      fieldName: "vendor_name",
      rawValue,
      nearbyLabel: section,
      confidence: 0.2,
      normalize: normalizeInvoiceVendorName,
      scoringReasons: [`Rejected as vendor because it appears in the ${section} section.`],
    });
  });
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

  const analyzed = analyzeInvoiceLines(lines);
  const candidates: ExtractedFieldCandidate[] = [];

  addVendorCandidates(candidates, analyzed, source);
  const weakVendor = firstLikelyVendorLine(lines);
  pushCandidate(candidates, source, {
    fieldName: "vendor_name",
    rawValue: weakVendor,
    nearbyLabel: "weak vendor fallback",
    confidence: 0.45,
    normalize: normalizeInvoiceVendorName,
    scoringReasons: ["Weak fallback candidate from the first plausible top-of-document line."],
  });
  addLabelCandidates(candidates, analyzed, source, {
    fieldName: "invoice_number",
    labels: [
      /\binvoice\s*#\s*[:\-]?\s*([A-Z0-9][A-Z0-9-]{0,30})/i,
      /\binvoice\s*(?:number|no\.?)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9-]{0,30})/i,
      /\binv\s*(?:#|no\.?)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9-]{0,30})/i,
    ],
    normalize: normalizeIdentifier,
    baseConfidence: 0.82,
    nearbyLabel: "INVOICE #",
    rejectLabel: /\b(po|purchase order|customer|account|vendor)\b/i,
    valuePattern: /[A-Z0-9][A-Z0-9-]{0,30}/i,
  });
  addLabelCandidates(candidates, analyzed, source, {
    fieldName: "po_number",
    labels: [
      /\bp\.?\s*o\.?\s*#?\s*[:\-]?\s*([A-Z0-9][A-Z0-9 -]{1,30})/i,
      /\bpurchase\s+order(?:\s*(?:number|no\.?|#))?\s*[:\-]?\s*([A-Z0-9][A-Z0-9 -]{1,30})/i,
    ],
    normalize: (value) => normalizePoNumber(value.replace(/\s+(DATE|PURCHASED|SHIP|COMMENTS|SUBTOTAL)\b.*$/i, "")),
    baseConfidence: 0.8,
    nearbyLabel: "PO",
    rejectLabel: /\binvoice\s*(#|number|no\.?)\b/i,
    valuePattern: /[A-Z0-9][A-Z0-9 -]{1,30}/i,
  });
  addLabelCandidates(candidates, analyzed, source, {
    fieldName: "invoice_date",
    labels: [
      /\binvoice\s+date\b\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i,
      /\bbill\s+date\b\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i,
      /\bdate\b\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i,
    ],
    normalize: normalizeDate,
    baseConfidence: 0.75,
    nearbyLabel: "INVOICE DATE",
    rejectLabel: /\bdue\s+date\b/i,
  });
  addLabelCandidates(candidates, analyzed, source, {
    fieldName: "due_date",
    labels: [
      /\bdue\s+date\b\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i,
      /\bpayment\s+due\b\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i,
      /\bdue\s+by\b\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i,
    ],
    normalize: normalizeDate,
    baseConfidence: 0.78,
    nearbyLabel: "DUE DATE",
  });
  addAmountCandidates(candidates, analyzed, source);
  addSectionCandidates(candidates, lines, source);

  const selectedCandidateValue = (fieldName: string) =>
    candidates
      .filter((candidate) => candidate.fieldName === fieldName && candidate.normalizedValue)
      .sort((left, right) => right.confidence - left.confidence)[0]?.normalizedValue || "";
  const subtotal = amountCentsFromString(selectedCandidateValue("subtotal"));
  const tax = amountCentsFromString(selectedCandidateValue("tax"));
  const shipping = amountCentsFromString(selectedCandidateValue("shipping"));
  const totalDue = amountCentsFromString(selectedCandidateValue("total_due"));
  if (
    subtotal !== null &&
    tax !== null &&
    shipping !== null &&
    totalDue !== null &&
    subtotal + tax + shipping === totalDue
  ) {
    for (const candidate of candidates.filter((item) => item.fieldName === "total_due")) {
      candidate.confidence = score(candidate.confidence + 0.08);
      candidate.scoringReasons = [
        ...(candidate.scoringReasons || []),
        "Subtotal, tax, and shipping reconcile to this total.",
      ];
    }
  }

  metadata.candidates = selectBestCandidates(candidates);

  metadata.lineItems = extractLineItems(lines);
  for (const lineItem of metadata.lineItems.slice(0, 1)) {
    metadata.candidates.push(
      makeCandidate(source, {
        fieldName: "line_item_quantity",
        rawValue: lineItem.quantity,
        nearbyLabel: "line item quantity",
        confidence: lineItem.confidence,
        selected: true,
        validationStatus: "passed",
        scoringReasons: ["Candidate was parsed from a line-item row."],
      }),
      makeCandidate(source, {
        fieldName: "line_item_description",
        rawValue: lineItem.description,
        nearbyLabel: "line item description",
        confidence: lineItem.confidence,
        selected: true,
        validationStatus: "passed",
        scoringReasons: ["Candidate was parsed from a line-item row."],
      }),
      makeCandidate(source, {
        fieldName: "line_item_unit_price",
        rawValue: lineItem.unitPrice,
        nearbyLabel: "unit price",
        confidence: lineItem.confidence,
        normalize: normalizeAmount,
        selected: true,
        validationStatus: "passed",
        scoringReasons: ["Candidate was parsed from a line-item row."],
      }),
      makeCandidate(source, {
        fieldName: "line_item_total",
        rawValue: lineItem.lineTotal,
        nearbyLabel: "line total",
        confidence: lineItem.confidence,
        normalize: normalizeAmount,
        selected: true,
        validationStatus: "passed",
        scoringReasons: ["Candidate was parsed from a line-item row."],
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
            scoringReasons: [`Azure Document Intelligence returned ${mapping.label}.`],
          }),
          pageNumber: extracted.pageNumber,
          boundingBox: extracted.boundingBox,
        };
      });
      selectBestCandidates(metadata.candidates);
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
  let azureFailureReason = "";
  try {
    const azure = await extractWithAzure(filePath, mimeType);
    if (azure) return azure;
  } catch (error) {
    azureFailureReason =
      error instanceof Error
        ? `Azure OCR failed: ${error.message}`
        : "Azure OCR failed.";
  }

  if (mimeType === "application/pdf" || /\.pdf$/i.test(originalName)) {
    try {
      const file = await readFile(filePath);
      const extracted = extractInvoiceMetadataFromText(extractPdfText(file));
      if (extracted) {
        if (azureFailureReason) {
          extracted.fallbackReason = `${azureFailureReason} Used embedded PDF text fallback.`;
          extracted.summary = `${extracted.summary} ${extracted.fallbackReason}`;
        }
        return extracted;
      }
    } catch (error) {
      const embeddedFailure =
        error instanceof Error
          ? `Embedded PDF text extraction failed: ${error.message}`
          : "Embedded PDF text extraction failed.";
      const reason = azureFailureReason
        ? `${azureFailureReason} ${embeddedFailure}`
        : embeddedFailure;
      return fromFileName(originalName, reason);
    }
  }

  return fromFileName(originalName, azureFailureReason);
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

function amountCentsFromString(value: string) {
  const normalized = normalizeAmount(value);
  if (!normalized) return null;
  const match = normalized.match(/^(-?)(\d+)\.(\d{2})$/);
  if (!match) return null;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 100 + Number(match[3]));
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
