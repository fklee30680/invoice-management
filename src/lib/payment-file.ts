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
  { source: "invoiceNumber", label: "Invoice Number" },
  { source: "invoiceDate", label: "Invoice Date" },
  { source: "amount", label: "Amount" },
  { source: "poNumber", label: "PO Number" },
  { source: "department", label: "Department" },
  { source: "departmentDecision", label: "Department Decision" },
  { source: "dateReceived", label: "Date Received" },
  { source: "dateApproved", label: "Date Approved" },
  { source: "dateUploaded", label: "Date Uploaded" },
  { source: "dateSubmittedToDepartment", label: "Date Submitted To Department" },
  { source: "statusDate", label: "Status Date" },
  { source: "paymentProcessed", label: "Payment Processed" },
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

function departmentName(data: AppData, departmentId: string) {
  return data.departments.find((department) => department.id === departmentId)?.name || "";
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function rawAmount(value: string) {
  return value.replace(/[$,]/g, "");
}

function valueForColumn(invoice: Invoice, column: PaymentFileColumn, data: AppData) {
  switch (column.source) {
    case "vendorName":
      return invoice.vendorName;
    case "invoiceNumber":
      return invoice.invoiceNumber;
    case "invoiceDate":
      return formatDate(invoice.invoiceDate);
    case "amount":
      return rawAmount(invoice.amount) || currencyDisplay(invoice.amount);
    case "poNumber":
      return invoice.poNumber;
    case "department":
      return departmentName(data, invoice.departmentId);
    case "departmentDecision":
      return invoice.departmentDecision;
    case "dateReceived":
      return formatDate(invoice.dateReceived);
    case "dateApproved":
      return formatDate(invoice.dateApproved);
    case "dateUploaded":
      return formatDate(invoice.dateUploaded);
    case "dateSubmittedToDepartment":
      return formatDate(invoice.dateSubmittedToDepartment);
    case "statusDate":
      return formatDate(invoice.statusDate);
    case "paymentProcessed":
      return invoice.paymentProcessed ? "Processed" : "Not processed";
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
