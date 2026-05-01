import type { AppData, Invoice, Vendor } from "./types";
import { normalizeVendorName } from "./utils";

export type VendorValidationResult = {
  found: boolean;
  vendor?: Vendor;
  vendorNameInput: string;
  normalizedVendorName: string;
  confidence: number;
  status: "Validated" | "Warning" | "Blocked";
  message: string;
  suggestions: Vendor[];
};

export function findVendorByNumber(data: AppData, vendorNumber: string) {
  const normalized = normalizeVendorNumber(vendorNumber);
  if (!normalized) return undefined;
  return data.vendors.find(
    (vendor) => normalizeVendorNumber(vendor.vendorNumber) === normalized,
  );
}

export function findVendorByNameInFile(data: AppData, vendorName: string) {
  const normalized = normalizeVendorName(vendorName);
  if (!normalized) return undefined;
  return data.vendors.find((vendor) => vendor.normalizedVendorName === normalized);
}

export function vendorDropdownOptions(data: AppData) {
  return data.vendors
    .filter((vendor) => vendor.active !== false)
    .sort((left, right) =>
      left.vendorName.localeCompare(right.vendorName, undefined, {
        sensitivity: "base",
      }),
    )
    .map((vendor) => ({
      value: vendor.vendorNumber || vendor.id,
      label: `${vendor.vendorName}${vendor.vendorNumber ? ` - ${vendor.vendorNumber}` : ""}`,
      vendorNumber: vendor.vendorNumber,
      vendorName: vendor.vendorName,
      vendorId: vendor.id,
    }));
}

export function validateVendorAgainstFile(
  data: AppData,
  vendorNameInput: string,
  options: {
    vendorNumber?: string;
    allowFuzzy?: boolean;
    autoSelectThreshold?: number;
    suggestionThreshold?: number;
    blockWhenMissing?: boolean;
  } = {},
): VendorValidationResult {
  const vendorNumber = options.vendorNumber || "";
  const normalizedVendorName = normalizeVendorName(vendorNameInput);
  const autoSelectThreshold = options.autoSelectThreshold ?? 0.95;
  const suggestionThreshold = options.suggestionThreshold ?? 0.75;
  const allowFuzzy = options.allowFuzzy !== false;
  const blockWhenMissing = options.blockWhenMissing === true;

  const numberMatch = vendorNumber ? findVendorByNumber(data, vendorNumber) : undefined;
  if (numberMatch) return validated(vendorNameInput, normalizedVendorName, numberMatch, 1);

  const exactMatch = findVendorByNameInFile(data, vendorNameInput);
  if (exactMatch) return validated(vendorNameInput, normalizedVendorName, exactMatch, 1);

  const scored = data.vendors
    .filter((vendor) => vendor.active !== false)
    .map((vendor) => ({
      vendor,
      score: allowFuzzy
        ? vendorMatchScore(normalizedVendorName, vendor.normalizedVendorName)
        : 0,
    }))
    .sort((left, right) => right.score - left.score);
  const best = scored[0];
  if (best && best.score >= autoSelectThreshold) {
    return validated(vendorNameInput, normalizedVendorName, best.vendor, best.score);
  }

  const suggestions = scored
    .filter((item) => item.score >= suggestionThreshold)
    .slice(0, 5)
    .map((item) => item.vendor);

  return {
    found: false,
    vendorNameInput,
    normalizedVendorName,
    confidence: best?.score || 0,
    status: blockWhenMissing ? "Blocked" : "Warning",
    message: blockWhenMissing
      ? "Select a valid vendor from the vendor file before routing this invoice."
      : "Vendor was not found in the vendor file. Select a vendor before routing.",
    suggestions,
  };
}

export function applyVendorToInvoice(
  invoice: Invoice,
  vendor: Vendor,
  source: Invoice["vendorMatchSource"],
  nowIso = new Date().toISOString(),
) {
  invoice.vendorId = vendor.id;
  invoice.vendorRecordId = vendor.id;
  invoice.vendorName = vendor.vendorName;
  invoice.vendorNumber = vendor.vendorNumber;
  invoice.vendorValidationStatus = "Validated";
  invoice.vendorValidationMessage = "";
  invoice.vendorValidationCheckedAt = nowIso;
  invoice.vendorMatchConfidence = 1;
  invoice.vendorMatchSource = source;
}

export function applyVendorValidationWarning(
  invoice: Invoice,
  result: VendorValidationResult,
  source: Invoice["vendorMatchSource"],
  nowIso = new Date().toISOString(),
) {
  invoice.vendorValidationStatus = result.status;
  invoice.vendorValidationMessage = result.message;
  invoice.vendorValidationCheckedAt = nowIso;
  invoice.vendorMatchConfidence = result.confidence;
  invoice.vendorMatchSource = source;
  invoice.vendorId = "";
  invoice.vendorRecordId = "";
  invoice.vendorNumber = "";
}

export function invoiceVendorValidated(invoice: Invoice) {
  return (
    invoice.vendorValidationStatus === "Validated" &&
    Boolean(invoice.vendorNumber || invoice.vendorId || invoice.vendorRecordId)
  );
}

export function normalizeVendorValidationState(invoice: Invoice, data: AppData) {
  const vendorNumber = invoice.vendorNumber || "";
  const vendorId = invoice.vendorId || invoice.vendorRecordId || "";
  if (vendorNumber || vendorId) {
    const vendor =
      findVendorByNumber(data, vendorNumber) ||
      data.vendors.find((item) => item.id === vendorId);
    if (vendor) {
      return {
        ...invoice,
        vendorId: vendor.id,
        vendorRecordId: vendor.id,
        vendorName: vendor.vendorName,
        vendorNumber: vendor.vendorNumber,
        vendorValidationStatus: "Validated" as const,
        vendorValidationMessage: "",
        vendorValidationCheckedAt: invoice.vendorValidationCheckedAt || "",
        vendorMatchConfidence: invoice.vendorMatchConfidence ?? 1,
        vendorMatchSource: invoice.vendorMatchSource || "Import",
      };
    }
  }

  const result = validateVendorAgainstFile(data, invoice.vendorName || "");
  if (result.found && result.vendor) {
    return {
      ...invoice,
      vendorId: result.vendor.id,
      vendorRecordId: result.vendor.id,
      vendorName: result.vendor.vendorName,
      vendorNumber: result.vendor.vendorNumber,
      vendorValidationStatus: "Validated" as const,
      vendorValidationMessage: "",
      vendorValidationCheckedAt: invoice.vendorValidationCheckedAt || "",
      vendorMatchConfidence: result.confidence,
      vendorMatchSource: invoice.vendorMatchSource || "Import",
    };
  }

  return {
    ...invoice,
    vendorId: invoice.vendorId || invoice.vendorRecordId || "",
    vendorNumber: invoice.vendorNumber || "",
    vendorValidationStatus: invoice.vendorValidationStatus || "Warning",
    vendorValidationMessage:
      invoice.vendorValidationMessage || "Vendor was not found in the vendor file.",
    vendorValidationCheckedAt: invoice.vendorValidationCheckedAt || "",
    vendorMatchConfidence: invoice.vendorMatchConfidence || 0,
    vendorMatchSource: invoice.vendorMatchSource || "Unknown",
  };
}

function validated(
  vendorNameInput: string,
  normalizedVendorName: string,
  vendor: Vendor,
  confidence: number,
): VendorValidationResult {
  return {
    found: true,
    vendor,
    vendorNameInput,
    normalizedVendorName,
    confidence,
    status: "Validated",
    message: "",
    suggestions: [],
  };
}

function normalizeVendorNumber(value: string) {
  return value.trim().toUpperCase();
}

function vendorMatchScore(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftTokens = new Set(left.split(/\s+/).filter(Boolean));
  const rightTokens = new Set(right.split(/\s+/).filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return intersection / Math.max(leftTokens.size, rightTokens.size);
}
