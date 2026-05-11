import type { AppData, AuditEvent, AuditLogSettings, Invoice } from "./types";
import { normalizePoNumber } from "./utils";

export type AuditLogSortKey =
  | "auditDate"
  | "actor"
  | "type"
  | "department"
  | "vendor"
  | "invoiceNumber"
  | "invoiceDate"
  | "amount"
  | "poNumber";

export type AuditLogDirection = "asc" | "desc";

export type AuditLogFilters = {
  auditFrom: string;
  auditTo: string;
  departmentId: string;
  vendor: string;
  invoiceDateFrom: string;
  invoiceDateTo: string;
  amountMin: string;
  amountMax: string;
  poNumber: string;
  invoiceNumber: string;
  actor: string;
  type: string;
  q: string;
};

export type AuditLogQuery = {
  filters: AuditLogFilters;
  sort: AuditLogSortKey;
  direction: AuditLogDirection;
  page: number;
  pageSize: number;
};

export type AuditLogPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  start: number;
  end: number;
};

type SearchParamsLike = URLSearchParams | Record<string, string | string[] | undefined>;

export const auditLogSortKeys: AuditLogSortKey[] = [
  "auditDate",
  "actor",
  "type",
  "department",
  "vendor",
  "invoiceNumber",
  "invoiceDate",
  "amount",
  "poNumber",
];

export const auditLogPageSizes = [25, 50, 100, 250];

const defaultFilters: AuditLogFilters = {
  auditFrom: "",
  auditTo: "",
  departmentId: "",
  vendor: "",
  invoiceDateFrom: "",
  invoiceDateTo: "",
  amountMin: "",
  amountMax: "",
  poNumber: "",
  invoiceNumber: "",
  actor: "",
  type: "",
  q: "",
};

export function defaultAuditLogSettings(): AuditLogSettings {
  return {
    retentionYears: 7,
    retainSecurityEventsPermanently: true,
    retainInvoiceEventsPermanently: true,
    allowManualPurge: false,
  };
}

export function normalizeAuditLogSettings(
  settings: Partial<AuditLogSettings> | undefined,
): AuditLogSettings {
  const defaults = defaultAuditLogSettings();
  const retentionYears = Math.max(Number(settings?.retentionYears) || defaults.retentionYears, 3);
  return {
    retentionYears,
    retainSecurityEventsPermanently:
      settings?.retainSecurityEventsPermanently ?? defaults.retainSecurityEventsPermanently,
    retainInvoiceEventsPermanently:
      settings?.retainInvoiceEventsPermanently ?? defaults.retainInvoiceEventsPermanently,
    allowManualPurge: settings?.allowManualPurge ?? defaults.allowManualPurge,
  };
}

function firstParam(params: SearchParamsLike, key: string) {
  if (params instanceof URLSearchParams) return params.get(key) || "";
  const value = params[key];
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function numberParam(params: SearchParamsLike, key: string, fallback: number) {
  const value = Number(firstParam(params, key));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function auditLogQueryFromSearchParams(params: SearchParamsLike): AuditLogQuery {
  const sortValue = firstParam(params, "sort") as AuditLogSortKey;
  const directionValue = firstParam(params, "direction") as AuditLogDirection;
  const pageSizeValue = numberParam(params, "pageSize", 50);
  return {
    filters: {
      ...defaultFilters,
      auditFrom: firstParam(params, "auditFrom"),
      auditTo: firstParam(params, "auditTo"),
      departmentId: firstParam(params, "departmentId"),
      vendor: firstParam(params, "vendor"),
      invoiceDateFrom: firstParam(params, "invoiceDateFrom"),
      invoiceDateTo: firstParam(params, "invoiceDateTo"),
      amountMin: firstParam(params, "amountMin"),
      amountMax: firstParam(params, "amountMax"),
      poNumber: firstParam(params, "poNumber"),
      invoiceNumber: firstParam(params, "invoiceNumber"),
      actor: firstParam(params, "actor"),
      type: firstParam(params, "type"),
      q: firstParam(params, "q"),
    },
    sort: auditLogSortKeys.includes(sortValue) ? sortValue : "auditDate",
    direction: directionValue === "asc" ? "asc" : "desc",
    page: numberParam(params, "page", 1),
    pageSize: auditLogPageSizes.includes(pageSizeValue) ? pageSizeValue : 50,
  };
}

export function auditLogQueryToSearchParams(
  query: AuditLogQuery,
  overrides: Partial<Record<keyof AuditLogFilters | "sort" | "direction" | "page" | "pageSize", string | number | undefined>> = {},
) {
  const params = new URLSearchParams();
  const values: Record<string, string | number | undefined> = {
    ...query.filters,
    sort: query.sort,
    direction: query.direction,
    page: query.page,
    pageSize: query.pageSize,
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params;
}

export function auditEventInvoice(data: AppData, event: AuditEvent) {
  if (!event.invoiceId) return undefined;
  return data.invoices.find((invoice) => invoice.id === event.invoiceId);
}

export function auditEventDepartment(data: AppData, invoice: Invoice | undefined) {
  if (!invoice?.departmentId) return undefined;
  return data.departments.find((department) => department.id === invoice.departmentId);
}

function lower(value: string | undefined) {
  return (value || "").trim().toLowerCase();
}

function dateOnly(value: string | undefined) {
  return (value || "").slice(0, 10);
}

export function amountToCents(value: string | undefined) {
  const cleaned = (value || "").replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const negative = cleaned.startsWith("-");
  const absolute = negative ? cleaned.slice(1) : cleaned;
  const [whole, decimal = ""] = absolute.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isFinite(cents)) return null;
  return negative ? -cents : cents;
}

function matchesDateRange(value: string, from: string, to: string) {
  if (!from && !to) return true;
  if (!value) return false;
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

function matchesAmountRange(value: string, min: string, max: string) {
  if (!min && !max) return true;
  const cents = amountToCents(value);
  if (cents === null) return false;
  const minCents = amountToCents(min);
  const maxCents = amountToCents(max);
  if (min && minCents !== null && cents < minCents) return false;
  if (max && maxCents !== null && cents > maxCents) return false;
  return true;
}

export function filterAuditEvents(data: AppData, filters: AuditLogFilters) {
  const vendor = lower(filters.vendor);
  const poNumber = normalizePoNumber(filters.poNumber || "");
  const invoiceNumber = lower(filters.invoiceNumber);
  const actor = lower(filters.actor);
  const q = lower(filters.q);

  return data.auditEvents.filter((event) => {
    const invoice = auditEventInvoice(data, event);
    const department = auditEventDepartment(data, invoice);

    if (!matchesDateRange(dateOnly(event.createdAt), filters.auditFrom, filters.auditTo)) {
      return false;
    }
    if (filters.departmentId && invoice?.departmentId !== filters.departmentId) return false;
    if (vendor && !invoice) return false;
    if (
      vendor &&
      invoice &&
      !lower(invoice.vendorName).includes(vendor) &&
      !lower(invoice.vendorNumber).includes(vendor)
    ) {
      return false;
    }
    if (!matchesDateRange(invoice?.invoiceDate || "", filters.invoiceDateFrom, filters.invoiceDateTo)) {
      return false;
    }
    if (!matchesAmountRange(invoice?.amount || "", filters.amountMin, filters.amountMax)) {
      return false;
    }
    if (poNumber && !normalizePoNumber(invoice?.poNumber || "").includes(poNumber)) return false;
    if (invoiceNumber && !lower(invoice?.invoiceNumber).includes(invoiceNumber)) return false;
    if (actor && !lower(event.actor).includes(actor)) return false;
    if (filters.type && event.type !== filters.type) return false;
    if (q) {
      const haystack = [
        event.message,
        event.type,
        event.actor,
        invoice?.vendorName,
        invoice?.vendorNumber,
        invoice?.invoiceNumber,
        invoice?.poNumber,
        invoice?.amount,
        invoice?.status,
        department?.name,
      ]
        .map((item) => lower(item))
        .join(" ");
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

type SortValue = string | number | null;

export function auditEventSortValue(
  data: AppData,
  event: AuditEvent,
  sort: AuditLogSortKey,
): SortValue {
  const invoice = auditEventInvoice(data, event);
  const department = auditEventDepartment(data, invoice);
  switch (sort) {
    case "auditDate":
      return new Date(event.createdAt).getTime();
    case "actor":
      return lower(event.actor);
    case "type":
      return lower(event.type);
    case "department":
      return lower(department?.name);
    case "vendor":
      return lower(invoice?.vendorName || invoice?.vendorNumber);
    case "invoiceNumber":
      return lower(invoice?.invoiceNumber);
    case "invoiceDate":
      return invoice?.invoiceDate || null;
    case "amount":
      return amountToCents(invoice?.amount) ?? null;
    case "poNumber":
      return normalizePoNumber(invoice?.poNumber || "");
  }
}

export function sortAuditEvents(
  data: AppData,
  events: AuditEvent[],
  sort: AuditLogSortKey,
  direction: AuditLogDirection,
) {
  return [...events].sort((left, right) => {
    const leftValue = auditEventSortValue(data, left, sort);
    const rightValue = auditEventSortValue(data, right, sort);
    const leftMissing = leftValue === null || leftValue === "";
    const rightMissing = rightValue === null || rightValue === "";
    if (leftMissing && rightMissing) return 0;
    if (leftMissing) return 1;
    if (rightMissing) return -1;
    const comparison =
      typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue));
    return direction === "asc" ? comparison : -comparison;
  });
}

export function paginateAuditEvents<T>(
  events: T[],
  pageInput: number,
  pageSizeInput: number,
): AuditLogPage<T> {
  const pageSize = auditLogPageSizes.includes(pageSizeInput) ? pageSizeInput : 50;
  const total = events.length;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const page = Math.min(Math.max(Math.floor(pageInput) || 1, 1), totalPages);
  const startIndex = (page - 1) * pageSize;
  const items = events.slice(startIndex, startIndex + pageSize);
  return {
    items,
    page,
    pageSize,
    total,
    totalPages,
    start: total === 0 ? 0 : startIndex + 1,
    end: Math.min(startIndex + pageSize, total),
  };
}

function csvCell(value: string | number | undefined) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export function auditLogCsv(data: AppData, events: AuditEvent[]) {
  const headers = [
    "Audit Date",
    "Actor",
    "Type",
    "Department",
    "Vendor",
    "Vendor Number",
    "Invoice Number",
    "Invoice Date",
    "Amount",
    "PO Number",
    "Status",
    "Message",
    "Invoice ID",
    "Audit Event ID",
  ];
  const rows = events.map((event) => {
    const invoice = auditEventInvoice(data, event);
    const department = auditEventDepartment(data, invoice);
    return [
      event.createdAt,
      event.actor,
      event.type,
      department?.name || "",
      invoice?.vendorName || "",
      invoice?.vendorNumber || "",
      invoice?.invoiceNumber || "",
      invoice?.invoiceDate || "",
      invoice?.amount || "",
      invoice?.poNumber || "",
      invoice?.status || "",
      event.message,
      invoice?.id || "",
      event.id,
    ];
  });
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}
