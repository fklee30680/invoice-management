import type { AppData, Invoice, PoValidationSettings, PurchaseOrder } from "./types";
import { normalizePoNumber, normalizeVendorName } from "./utils";

export type PoValidationResult = {
  enabled: boolean;
  poNumber: string;
  found: boolean;
  purchaseOrder?: PurchaseOrder;
  invoiceVendorName: string;
  poVendorName?: string;
  poVendorNumber?: string;
  vendorMatches: boolean;
  matchScore?: number;
  severity: "none" | "warning" | "blocking";
  message: string;
};

export function defaultPoValidationSettings(): PoValidationSettings {
  return {
    enabled: false,
    requirePoToExistInPoList: false,
    blockSaveOnVendorMismatch: true,
    allowVendorUpdateFromPo: true,
    fuzzyVendorMatch: true,
    vendorMatchThreshold: 0.85,
  };
}

export function normalizePoValidationSettings(
  settings: Partial<PoValidationSettings> | undefined,
): PoValidationSettings {
  const defaults = defaultPoValidationSettings();
  const threshold = Number(settings?.vendorMatchThreshold);
  return {
    ...defaults,
    ...(settings || {}),
    vendorMatchThreshold:
      Number.isFinite(threshold) && threshold >= 0 && threshold <= 1
        ? threshold
        : defaults.vendorMatchThreshold,
  };
}

export function validateInvoicePoNumber(
  data: AppData,
  input: {
    poNumber: string;
    invoiceVendorName: string;
    invoiceVendorNumber?: string;
  },
): PoValidationResult {
  const settings = normalizePoValidationSettings(data.poValidationSettings);
  const poNumber = input.poNumber.trim();
  const invoiceVendorName = input.invoiceVendorName.trim();

  if (!settings.enabled) {
    return baseResult(false, poNumber, invoiceVendorName, "none", "PO validation is disabled.");
  }

  if (!poNumber) {
    return baseResult(true, poNumber, invoiceVendorName, "none", "No PO number entered.");
  }

  const normalizedPoNumber = normalizePoNumber(poNumber);
  const purchaseOrder = data.purchaseOrders.find(
    (po) => po.normalizedPoNumber === normalizedPoNumber,
  );
  if (!purchaseOrder) {
    return {
      ...baseResult(
        true,
        poNumber,
        invoiceVendorName,
        settings.requirePoToExistInPoList ? "blocking" : "warning",
        `PO ${poNumber} was not found in the PO list.`,
      ),
      found: false,
    };
  }

  if (
    input.invoiceVendorNumber &&
    purchaseOrder.vendorNumber &&
    input.invoiceVendorNumber.trim().toLowerCase() ===
      purchaseOrder.vendorNumber.trim().toLowerCase()
  ) {
    return {
      enabled: true,
      poNumber,
      found: true,
      purchaseOrder,
      invoiceVendorName,
      poVendorName: purchaseOrder.vendorName,
      poVendorNumber: purchaseOrder.vendorNumber,
      vendorMatches: true,
      matchScore: 1,
      severity: "none",
      message: "PO matched.",
    };
  }

  const score = vendorMatchScore(
    invoiceVendorName,
    purchaseOrder.vendorName,
    settings.fuzzyVendorMatch,
  );
  const vendorMatches = score >= settings.vendorMatchThreshold;
  if (vendorMatches) {
    return {
      enabled: true,
      poNumber,
      found: true,
      purchaseOrder,
      invoiceVendorName,
      poVendorName: purchaseOrder.vendorName,
      poVendorNumber: purchaseOrder.vendorNumber,
      vendorMatches: true,
      matchScore: score,
      severity: "none",
      message: "PO matched.",
    };
  }

  return {
    enabled: true,
    poNumber,
    found: true,
    purchaseOrder,
    invoiceVendorName,
    poVendorName: purchaseOrder.vendorName,
    poVendorNumber: purchaseOrder.vendorNumber,
    vendorMatches: false,
    matchScore: score,
    severity: settings.blockSaveOnVendorMismatch ? "blocking" : "warning",
    message: `PO ${poNumber} was found, but the PO vendor does not match the invoice vendor.`,
  };
}

export function applyPoValidationState(
  invoice: Invoice,
  result: PoValidationResult,
  nowIso = new Date().toISOString(),
) {
  if (!result.enabled || !result.poNumber) return;
  invoice.poValidationCheckedAt = nowIso;
  invoice.poValidationMessage = result.message;
  invoice.poValidationPurchaseOrderId = result.purchaseOrder?.id || "";
  invoice.poVendorName = result.poVendorName || "";
  if (!result.found) {
    invoice.poValidationStatus = "PO Not Found";
    return;
  }
  invoice.poValidationStatus = result.vendorMatches ? "Matched" : "Vendor Mismatch";
}

export function invoiceHasBlockingPoValidation(invoice: Invoice, data: AppData) {
  if (!invoice.poNumber) return false;
  return validateInvoicePoNumber(data, {
    poNumber: invoice.poNumber,
    invoiceVendorName: invoice.vendorName,
  }).severity === "blocking";
}

function baseResult(
  enabled: boolean,
  poNumber: string,
  invoiceVendorName: string,
  severity: PoValidationResult["severity"],
  message: string,
): PoValidationResult {
  return {
    enabled,
    poNumber,
    found: false,
    invoiceVendorName,
    vendorMatches: false,
    severity,
    message,
  };
}

function vendorMatchScore(left: string, right: string, fuzzy: boolean) {
  const normalizedLeft = normalizeVendorName(left);
  const normalizedRight = normalizeVendorName(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  if (!fuzzy) return 0;

  const leftTokens = new Set(normalizedLeft.split(/\s+/).filter(Boolean));
  const rightTokens = new Set(normalizedRight.split(/\s+/).filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return intersection / Math.max(leftTokens.size, rightTokens.size);
}

export function normalizePoValidationStatus(invoice: Invoice): Invoice {
  return {
    ...invoice,
    poValidationStatus: invoice.poValidationStatus || "Not Checked",
    poValidationMessage: invoice.poValidationMessage || "",
    poValidationCheckedAt: invoice.poValidationCheckedAt || "",
    poValidationPurchaseOrderId: invoice.poValidationPurchaseOrderId || "",
    poVendorName: invoice.poVendorName || "",
    requiresApAttention: invoice.requiresApAttention === true,
    apAttentionReason: invoice.apAttentionReason || "",
  };
}
