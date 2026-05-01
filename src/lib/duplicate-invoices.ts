import type { Invoice } from "./types";
import { normalizeVendorName } from "./utils";

export const DUPLICATE_ATTENTION_REASON = "Potential duplicate invoice.";

export type DuplicateInvoiceMatch = {
  invoiceId: string;
  vendorNumber?: string;
  vendorName?: string;
  invoiceNumber?: string;
  fileId?: string;
  uploadedAt?: string;
  status?: string;
  amount?: number;
};

export type DuplicateInvoiceResult = {
  status: "No Duplicate" | "Potential Duplicate";
  message: string;
  matchedInvoices: DuplicateInvoiceMatch[];
};

export function normalizeInvoiceDuplicateState(invoice: Invoice): Invoice {
  return {
    ...invoice,
    duplicateCheckStatus: invoice.duplicateCheckStatus || "Not Checked",
    duplicateCheckMessage: invoice.duplicateCheckMessage || "",
    duplicateCheckCheckedAt: invoice.duplicateCheckCheckedAt || "",
    duplicateMatchedInvoiceIds: invoice.duplicateMatchedInvoiceIds || [],
    duplicateReviewedAt: invoice.duplicateReviewedAt || "",
    duplicateReviewedBy: invoice.duplicateReviewedBy || "",
    duplicateReviewNote: invoice.duplicateReviewNote || "",
  };
}

export function findDuplicateInvoices(
  invoice: Invoice,
  invoices: Invoice[],
): DuplicateInvoiceResult {
  const invoiceNumber = normalizeInvoiceNumber(invoice.invoiceNumber);
  if (!invoiceNumber) {
    return {
      status: "No Duplicate",
      message: "",
      matchedInvoices: [],
    };
  }

  const vendorNumber = normalizeVendorNumber(invoice.vendorNumber || "");
  const vendorName = normalizeVendorName(invoice.vendorName || "");
  if (!vendorNumber && !vendorName) {
    return {
      status: "No Duplicate",
      message: "",
      matchedInvoices: [],
    };
  }

  const matchedInvoices = invoices
    .filter((candidate) => candidate.id !== invoice.id)
    .filter((candidate) => !invoiceIsDeleted(candidate))
    .filter((candidate) => {
      if (normalizeInvoiceNumber(candidate.invoiceNumber) !== invoiceNumber) {
        return false;
      }

      if (vendorNumber) {
        return normalizeVendorNumber(candidate.vendorNumber || "") === vendorNumber;
      }

      return normalizeVendorName(candidate.vendorName || "") === vendorName;
    })
    .map(toDuplicateMatch);

  return {
    status: matchedInvoices.length > 0 ? "Potential Duplicate" : "No Duplicate",
    message:
      matchedInvoices.length > 0
        ? "Potential duplicate invoice found."
        : "",
    matchedInvoices,
  };
}

function toDuplicateMatch(invoice: Invoice): DuplicateInvoiceMatch {
  return {
    invoiceId: invoice.id,
    vendorNumber: invoice.vendorNumber || "",
    vendorName: invoice.vendorName || "",
    invoiceNumber: invoice.invoiceNumber || "",
    fileId: invoice.fileId || "",
    uploadedAt: invoice.dateUploaded || invoice.createdAt || "",
    status: invoice.status || "",
    amount: amountValue(invoice.amount || ""),
  };
}

function invoiceIsDeleted(invoice: Invoice) {
  return invoice.status.trim().toLowerCase().includes("deleted");
}

function normalizeVendorNumber(value: string) {
  return value.trim().toUpperCase();
}

function normalizeInvoiceNumber(value: string) {
  return value.trim().toUpperCase().replace(/[\s\-_/.]+/g, "");
}

function amountValue(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}
