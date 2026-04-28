import Link from "next/link";
import { deleteInvoice } from "@/lib/actions";
import { filterableStatuses, statusBadgeClass } from "@/lib/status-config";
import type { AppData, Invoice } from "@/lib/types";
import { currencyDisplay, formatDate } from "@/lib/utils";

export type InvoiceFilters = {
  statuses: string[];
  department: string;
  search: string;
  sort: InvoiceSortKey;
  direction: InvoiceSortDirection;
};

export type InvoiceSortKey =
  | ""
  | "status"
  | "vendor"
  | "invoice"
  | "po"
  | "amount"
  | "department"
  | "decision"
  | "payment"
  | "received";

export type InvoiceSortDirection = "asc" | "desc";

export function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

export function many(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
}

export function sortKey(value: string | string[] | undefined): InvoiceSortKey {
  const key = one(value);
  return [
    "status",
    "vendor",
    "invoice",
    "po",
    "amount",
    "department",
    "decision",
    "payment",
    "received",
  ].includes(key)
    ? (key as InvoiceSortKey)
    : "";
}

export function sortDirection(
  value: string | string[] | undefined,
): InvoiceSortDirection {
  return one(value) === "desc" ? "desc" : "asc";
}

export function departmentName(data: AppData, id: string) {
  return data.departments.find((department) => department.id === id)?.name || "Unassigned";
}

function amountValue(amount: string) {
  const parsed = Number(amount.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortValue(invoice: Invoice, data: AppData, key: InvoiceSortKey) {
  if (key === "status") return invoice.status || "";
  if (key === "vendor") return invoice.vendorName || "";
  if (key === "invoice") return invoice.invoiceNumber || "";
  if (key === "po") return invoice.poNumber || "";
  if (key === "amount") return amountValue(invoice.amount || "");
  if (key === "department") return departmentName(data, invoice.departmentId);
  if (key === "decision") return invoice.departmentDecision || "Waiting";
  if (key === "payment") return invoice.paymentProcessed ? "Processed" : "Not processed";
  if (key === "received") return invoice.dateReceived || "";
  return "";
}

function compareValues(left: string | number, right: string | number) {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function filterInvoices(
  invoices: Invoice[],
  data: AppData,
  filters: InvoiceFilters,
) {
  const filtered = invoices.filter((invoice) => {
    const matchesStatus =
      filters.statuses.length === 0 || filters.statuses.includes(invoice.status);
    const matchesDepartment =
      !filters.department || invoice.departmentId === filters.department;
    const haystack = [
      invoice.vendorName,
      invoice.invoiceNumber,
      invoice.poNumber,
      invoice.amount,
      departmentName(data, invoice.departmentId),
      invoice.departmentDecision,
      invoice.paymentProcessed ? "payment processed" : "payment not processed",
      invoice.status,
    ]
      .join(" ")
      .toLowerCase();
    return matchesStatus && matchesDepartment && haystack.includes(filters.search.toLowerCase());
  });

  if (!filters.sort) return filtered;

  return filtered.slice().sort((left, right) => {
    const result = compareValues(
      sortValue(left, data, filters.sort),
      sortValue(right, data, filters.sort),
    );
    return filters.direction === "desc" ? -result : result;
  });
}

function sortHref({
  baseHref,
  filters,
  sort,
}: {
  baseHref: string;
  filters: InvoiceFilters;
  sort: Exclude<InvoiceSortKey, "">;
}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.department) params.set("department", filters.department);
  filters.statuses.forEach((status) => params.append("status", status));
  params.set("sort", sort);
  params.set(
    "direction",
    filters.sort === sort && filters.direction === "asc" ? "desc" : "asc",
  );
  const query = params.toString();
  return query ? `${baseHref}?${query}` : baseHref;
}

function SortHeader({
  baseHref,
  filters,
  label,
  sort,
}: {
  baseHref: string;
  filters: InvoiceFilters;
  label: string;
  sort: Exclude<InvoiceSortKey, "">;
}) {
  const isActive = filters.sort === sort;
  const indicator = isActive ? (filters.direction === "asc" ? " ^" : " v") : "";

  return (
    <th className="border-b border-[var(--line)] px-3 py-3">
      <Link
        className="focus-ring inline-flex items-center font-semibold hover:text-[var(--foreground)]"
        href={sortHref({ baseHref, filters, sort })}
        prefetch={false}
      >
        {label}
        <span aria-hidden="true">{indicator}</span>
      </Link>
    </th>
  );
}

export function FilterBar({
  data,
  filters,
  clearHref,
}: {
  data: AppData;
  filters: InvoiceFilters;
  clearHref: string;
}) {
  const filterKey = [
    filters.search,
    filters.department,
    filters.sort,
    filters.direction,
    ...filters.statuses,
  ].join("|");
  const statusOptions = filterableStatuses(data);
  const statusSummary =
    filters.statuses.length === 0
      ? "All statuses"
      : `${filters.statuses.length} selected`;

  return (
    <form
      className="grid gap-4 border border-[var(--line)] bg-[var(--panel)] p-4 xl:grid-cols-[1fr_2fr_220px_auto_auto]"
      key={filterKey || "clear"}
    >
      <input name="sort" type="hidden" value={filters.sort} />
      <input name="direction" type="hidden" value={filters.direction} />
      <input
        className="focus-ring min-h-10 border border-[var(--line)] bg-white px-3 text-sm"
        name="search"
        placeholder="Search vendor, PO, invoice, status"
        defaultValue={filters.search}
      />
      <details className="relative text-xs font-semibold uppercase text-[var(--muted)]">
        <summary className="focus-ring mt-1 flex min-h-10 cursor-pointer list-none items-center justify-between border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]">
          <span>{statusSummary}</span>
          <span aria-hidden="true">v</span>
        </summary>
        <div className="absolute z-10 mt-1 grid max-h-64 w-full min-w-64 gap-2 overflow-auto border border-[var(--line)] bg-white p-3 shadow-lg">
          {statusOptions.map((status) => (
            <label className="flex items-center gap-2 text-xs font-medium normal-case text-[var(--foreground)]" key={status.id}>
              <input
                className="h-4 w-4 accent-[var(--accent)]"
                defaultChecked={filters.statuses.includes(status.label)}
                name="status"
                type="checkbox"
                value={status.label}
              />
              {status.label}
            </label>
          ))}
        </div>
      </details>
      <label className="text-xs font-semibold uppercase text-[var(--muted)]">
        Department
        <select
          className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
          name="department"
          defaultValue={filters.department}
        >
          <option value="">All departments</option>
          {data.departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </label>
      <button className="focus-ring bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
        Filter
      </button>
      <Link
        className="focus-ring inline-flex items-center justify-center border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100"
        href={clearHref}
        prefetch={false}
        replace
      >
        Clear Filters
      </Link>
    </form>
  );
}

export function InvoiceTable({
  baseHref,
  data,
  filters,
  invoices,
}: {
  baseHref: string;
  data: AppData;
  filters: InvoiceFilters;
  invoices: Invoice[];
}) {
  return (
    <div className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
      <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
        <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
          <tr>
            <SortHeader baseHref={baseHref} filters={filters} label="Status" sort="status" />
            <SortHeader baseHref={baseHref} filters={filters} label="Vendor" sort="vendor" />
            <SortHeader baseHref={baseHref} filters={filters} label="Invoice" sort="invoice" />
            <SortHeader baseHref={baseHref} filters={filters} label="PO" sort="po" />
            <SortHeader baseHref={baseHref} filters={filters} label="Amount" sort="amount" />
            <SortHeader baseHref={baseHref} filters={filters} label="Department" sort="department" />
            <SortHeader baseHref={baseHref} filters={filters} label="Decision" sort="decision" />
            <SortHeader baseHref={baseHref} filters={filters} label="Payment" sort="payment" />
            <SortHeader baseHref={baseHref} filters={filters} label="Received" sort="received" />
            <th className="border-b border-[var(--line)] px-3 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="align-top hover:bg-slate-50">
              <td className="border-b border-[var(--line)] px-3 py-3">
                <span
                  className={`inline-flex border px-2 py-1 text-xs font-semibold ${statusBadgeClass(data, invoice.status)}`}
                >
                  {invoice.status}
                </span>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {formatDate(invoice.statusDate)}
                </div>
              </td>
              <td className="border-b border-[var(--line)] px-3 py-3 font-medium">
                {invoice.vendorName || "Unknown Vendor"}
                <div className="mt-1 text-xs font-normal text-[var(--muted)]">
                  Vendor record: {invoice.vendorValidationStatus || "Not Checked"}
                </div>
                <div className="mt-1 text-xs font-normal text-[var(--muted)]">
                  {invoice.ocrSummary}
                </div>
              </td>
              <td className="border-b border-[var(--line)] px-3 py-3">
                {invoice.invoiceNumber || "Not set"}
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {formatDate(invoice.invoiceDate)}
                </div>
              </td>
              <td className="border-b border-[var(--line)] px-3 py-3 font-mono text-xs">
                {invoice.poNumber || "Missing"}
              </td>
              <td className="border-b border-[var(--line)] px-3 py-3">
                {currencyDisplay(invoice.amount)}
              </td>
              <td className="border-b border-[var(--line)] px-3 py-3">
                {departmentName(data, invoice.departmentId)}
              </td>
              <td className="border-b border-[var(--line)] px-3 py-3">
                {invoice.departmentDecision || "Waiting"}
              </td>
              <td className="border-b border-[var(--line)] px-3 py-3">
                {invoice.paymentProcessed ? "Processed" : "Not processed"}
              </td>
              <td className="border-b border-[var(--line)] px-3 py-3">
                {formatDate(invoice.dateReceived)}
              </td>
              <td className="border-b border-[var(--line)] px-3 py-3">
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="focus-ring border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
                    href={`/review/${invoice.id}`}
                  >
                    Review
                  </Link>
                  <Link
                    className="focus-ring border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
                    href={`/files/${invoice.fileId}`}
                  >
                    Download
                  </Link>
                  <form action={deleteInvoice}>
                    <input type="hidden" name="invoiceId" value={invoice.id} />
                    <button className="focus-ring border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                      Delete
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
          {invoices.length === 0 ? (
            <tr>
              <td className="px-3 py-8 text-center text-[var(--muted)]" colSpan={10}>
                No invoices match the current view.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
