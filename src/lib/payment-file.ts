import type {
  AppData,
  Invoice,
  PaymentFileColumn,
  PaymentFileFieldSource,
  PaymentFileSettings,
} from "./types";
import { currencyDisplay, formatDate } from "./utils";

export const PAYMENT_FILE_FIELD_OPTIONS: {
  source: PaymentFileFieldSource;
  label: string;
}[] = [
  { source: "vendorName", label: "Vendor Name" },
  { source: "vendorNumber", label: "Vendor Number" },
  { source: "vendorValidationStatus", label: "Vendor Validation Status" },
  { source: "vendorValidationMessage", label: "Vendor Validation Message" },
  { source: "invoiceNumber", label: "Invoice Number" },
  { source: "invoiceDate", label: "Invoice Date" },
  { source: "amount", label: "Amount" },
  { source: "poNumber", label: "PO Number" },
  { source: "poValidationStatus", label: "PO Validation Status" },
  { source: "poValidationMessage", label: "PO Validation Message" },
  { source: "poVendorName", label: "PO Vendor Name" },
  { source: "department", label: "Department" },
  { source: "departmentDecision", label: "Department Decision" },
  { source: "status", label: "Status" },
  { source: "dateReceived", label: "Date Invoice Received" },
  { source: "dateApproved", label: "Date Approved" },
  { source: "dateUploaded", label: "Date Uploaded" },
  { source: "dateSubmittedToDepartment", label: "Date Submitted To Department" },
  { source: "routedAt", label: "Routed Date" },
  { source: "notificationSentAt", label: "Notification Sent Date" },
  { source: "statusDate", label: "Status Date" },
  { source: "dateProcessedForPayment", label: "Date Processed for Payment" },
  { source: "paymentProcessed", label: "Processed for Payment" },
  { source: "requiresApAttention", label: "Requires AP Attention" },
  { source: "apAttentionReason", label: "AP Attention Reason" },
  { source: "duplicateCheckStatus", label: "Duplicate Check Status" },
  { source: "duplicateCheckMessage", label: "Duplicate Check Message" },
  { source: "duplicateCheckCheckedAt", label: "Duplicate Check Date" },
  { source: "ocrSummary", label: "OCR Summary" },
  { source: "validationSummary", label: "Validation Summary" },
  { source: "apReviewReasonCodes", label: "AP Review Reason Codes" },
  { source: "processingStatus", label: "Processing Status" },
  { source: "extractionConfidence", label: "Extraction Confidence" },
  { source: "fileOriginalName", label: "File Name" },
  { source: "fileHash", label: "File Hash" },
];

const validSources = new Set(PAYMENT_FILE_FIELD_OPTIONS.map((option) => option.source));

export function defaultPaymentFileSettings(): PaymentFileSettings {
  return {
    columns: [
      {
        id: "payment-vendor",
        header: "Vendor Name",
        source: "vendorName",
        included: true,
      },
      {
        id: "payment-invoice-number",
        header: "Invoice Number",
        source: "invoiceNumber",
        included: true,
      },
      {
        id: "payment-invoice-date",
        header: "Invoice Date",
        source: "invoiceDate",
        included: true,
      },
      {
        id: "payment-amount",
        header: "Amount",
        source: "amount",
        included: true,
      },
      {
        id: "payment-po-number",
        header: "PO Number",
        source: "poNumber",
        included: true,
      },
    ],
  };
}

export function normalizePaymentFileSettings(
  settings: PaymentFileSettings | undefined,
) {
  const defaults = defaultPaymentFileSettings();
  if (!settings?.columns?.length) return defaults;

  const columns = settings.columns
    .filter((column) => validSources.has(column.source))
    .map((column) => ({
      ...column,
      header: column.header || sourceLabel(column.source),
      included: column.included !== false,
    }));

  return { columns: columns.length > 0 ? columns : defaults.columns };
}

export function sourceLabel(source: PaymentFileFieldSource) {
  return (
    PAYMENT_FILE_FIELD_OPTIONS.find((option) => option.source === source)?.label ||
    source
  );
}

export function isPaymentFileFieldSource(
  value: string,
): value is PaymentFileFieldSource {
  return validSources.has(value as PaymentFileFieldSource);
}

export function paymentFileEligibleStatuses(data: AppData) {
  return data.statuses
    .filter((status) => status.includeInPaymentFile)
    .map((status) => status.label);
}

export function paymentFileEligibleDecisionLabels(data: AppData) {
  return data.departmentDecisions
    .filter((decision) => decision.active && decision.includeInPaymentFile)
    .map((decision) => decision.label);
}

export function invoiceEligibleForPaymentFile(invoice: Invoice, data: AppData) {
  if (invoice.paymentProcessed) return false;
  if (invoice.duplicateCheckStatus === "Potential Duplicate") return false;
  if (!invoice.departmentDecision) return false;

  const status = data.statuses.find((item) => item.label === invoice.status);
  if (!status?.includeInPaymentFile) return false;

  const decision = data.departmentDecisions.find(
    (item) => item.label === invoice.departmentDecision,
  );
  if (!decision?.active || !decision.includeInPaymentFile) return false;
  if (
    data.paymentFile.columns.some(
      (column) => column.included && column.source === "vendorNumber",
    ) &&
    !invoice.vendorNumber
  ) {
    return false;
  }

  return true;
}

function departmentName(data: AppData, departmentId: string) {
  return data.departments.find((department) => department.id === departmentId)?.name || "";
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function rawAmount(value: string) {
  return value.replace(/[$,]/g, "");
}

function formatDateOnly(value: string | undefined) {
  if (!value) return "";
  return formatDate(value.slice(0, 10));
}

function invoiceFile(data: AppData, invoice: Invoice) {
  return data.invoiceFiles.find((file) => file.id === invoice.fileId);
}

function valueForColumn(invoice: Invoice, column: PaymentFileColumn, data: AppData) {
  switch (column.source) {
    case "vendorName":
      return invoice.vendorName;
    case "vendorNumber":
      return invoice.vendorNumber || "";
    case "vendorValidationStatus":
      return invoice.vendorValidationStatus || "";
    case "vendorValidationMessage":
      return invoice.vendorValidationMessage || "";
    case "invoiceNumber":
      return invoice.invoiceNumber;
    case "invoiceDate":
      return formatDate(invoice.invoiceDate);
    case "amount":
      return rawAmount(invoice.amount) || currencyDisplay(invoice.amount);
    case "poNumber":
      return invoice.poNumber;
    case "poValidationStatus":
      return invoice.poValidationStatus || "";
    case "poValidationMessage":
      return invoice.poValidationMessage || "";
    case "poVendorName":
      return invoice.poVendorName || "";
    case "department":
      return departmentName(data, invoice.departmentId);
    case "departmentDecision":
      return invoice.departmentDecision;
    case "status":
      return invoice.status;
    case "dateReceived":
      return formatDate(invoice.dateReceived);
    case "dateApproved":
      return formatDate(invoice.dateApproved);
    case "dateUploaded":
      return formatDate(invoice.dateUploaded);
    case "dateSubmittedToDepartment":
      return formatDate(invoice.dateSubmittedToDepartment);
    case "routedAt":
      return formatDateOnly(invoice.routedAt);
    case "notificationSentAt":
      return formatDateOnly(invoice.notificationSentAt);
    case "statusDate":
      return formatDate(invoice.statusDate);
    case "dateProcessedForPayment":
      return formatDate(invoice.dateProcessedForPayment);
    case "paymentProcessed":
      return invoice.paymentProcessed ? "Processed" : "Not processed";
    case "requiresApAttention":
      return invoice.requiresApAttention ? "Yes" : "No";
    case "apAttentionReason":
      return invoice.apAttentionReason || "";
    case "duplicateCheckStatus":
      return invoice.duplicateCheckStatus || "";
    case "duplicateCheckMessage":
      return invoice.duplicateCheckMessage || "";
    case "duplicateCheckCheckedAt":
      return formatDateOnly(invoice.duplicateCheckCheckedAt || "");
    case "ocrSummary":
      return invoice.ocrSummary || "";
    case "validationSummary":
      return invoice.validationSummary || "";
    case "apReviewReasonCodes":
      return (invoice.apReviewReasonCodes || []).join("; ");
    case "processingStatus":
      return invoice.processingStatus || "";
    case "extractionConfidence":
      return typeof invoice.extractionConfidence === "number"
        ? String(invoice.extractionConfidence)
        : "";
    case "fileOriginalName":
      return invoiceFile(data, invoice)?.originalName || "";
    case "fileHash":
      return invoiceFile(data, invoice)?.fileHash || "";
  }
}

export function buildPaymentCsv(data: AppData, invoices: Invoice[]) {
  const columns = data.paymentFile.columns.filter((column) => column.included);
  const headers = columns.map((column) => csvCell(column.header));
  const rows = invoices.map((invoice) =>
    columns.map((column) => csvCell(valueForColumn(invoice, column, data))).join(","),
  );

  return [headers.join(","), ...rows].join("\r\n");
}
