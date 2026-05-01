import type { AppData, InvoiceFieldConfig, InvoiceFieldKey } from "./types";

export const DEFAULT_INVOICE_FIELDS: InvoiceFieldConfig[] = [
  {
    key: "vendorName",
    label: "Vendor Name",
    enabled: true,
    sortOrder: 10,
  },
  {
    key: "vendorNumber",
    label: "Vendor Number",
    enabled: true,
    readOnly: true,
    systemControlled: true,
    sortOrder: 15,
  },
  {
    key: "invoiceNumber",
    label: "Invoice Number",
    enabled: true,
    sortOrder: 20,
  },
  {
    key: "invoiceDate",
    label: "Invoice Date",
    enabled: true,
    sortOrder: 30,
  },
  {
    key: "amount",
    label: "Amount",
    enabled: true,
    sortOrder: 40,
  },
  {
    key: "poNumber",
    label: "PO Number",
    enabled: true,
    sortOrder: 50,
  },
  {
    key: "dateReceived",
    label: "Date Received",
    enabled: true,
    sortOrder: 60,
  },
  {
    key: "dateUploaded",
    label: "Date Uploaded",
    enabled: true,
    sortOrder: 70,
  },
  {
    key: "departmentId",
    label: "Department",
    enabled: true,
    locked: true,
    requiredForAp: true,
    sortOrder: 80,
  },
  {
    key: "status",
    label: "Status",
    enabled: true,
    locked: true,
    readOnly: true,
    systemControlled: true,
    sortOrder: 90,
  },
  {
    key: "dateApproved",
    label: "Date Approved",
    enabled: true,
    readOnly: true,
    systemControlled: true,
    sortOrder: 100,
  },
  {
    key: "routedAt",
    label: "Routed Date",
    enabled: true,
    readOnly: true,
    systemControlled: true,
    sortOrder: 110,
  },
  {
    key: "notificationSentAt",
    label: "Notification Sent Date",
    enabled: true,
    readOnly: true,
    systemControlled: true,
    sortOrder: 120,
  },
  {
    key: "ocrSummary",
    label: "OCR Summary",
    enabled: true,
    readOnly: true,
    systemControlled: true,
    sortOrder: 130,
  },
];

export function normalizeInvoiceFields(
  fields: InvoiceFieldConfig[] | undefined,
): InvoiceFieldConfig[] {
  const configured = Array.isArray(fields) ? fields : [];
  return DEFAULT_INVOICE_FIELDS.map((defaultField) => {
    const existing = configured.find((field) => field.key === defaultField.key);
    return {
      ...defaultField,
      ...(existing || {}),
      label: defaultField.label,
      enabled: defaultField.locked ? true : existing?.enabled ?? defaultField.enabled,
      locked: defaultField.locked,
      readOnly: defaultField.readOnly,
      systemControlled: defaultField.systemControlled,
      sortOrder: defaultField.sortOrder,
    };
  }).sort((left, right) => left.sortOrder - right.sortOrder);
}

export function invoiceFieldEnabled(data: AppData, key: InvoiceFieldKey) {
  return normalizeInvoiceFields(data.invoiceFields).find((field) => field.key === key)
    ?.enabled !== false;
}

export function visibleInvoiceFields(data: AppData) {
  return normalizeInvoiceFields(data.invoiceFields).filter((field) => field.enabled);
}

export function invoiceFieldLabel(data: AppData, key: InvoiceFieldKey) {
  return normalizeInvoiceFields(data.invoiceFields).find((field) => field.key === key)
    ?.label || key;
}

export function isSystemInvoiceField(data: AppData, key: InvoiceFieldKey) {
  return normalizeInvoiceFields(data.invoiceFields).find((field) => field.key === key)
    ?.systemControlled === true;
}
