import Link from "next/link";
import { CollapsibleSection } from "@/components/collapsible-section";
import { DeleteInvoiceConfirmation } from "@/components/delete-invoice-confirmation";
import { MultiSelectDropdown } from "@/components/multi-select-dropdown";
import { invoiceFieldEnabled } from "@/lib/invoice-fields";
import { filterableStatuses, statusBadgeClass } from "@/lib/status-config";
import type { AppData, Invoice } from "@/lib/types";
import { currencyDisplay, formatDate } from "@/lib/utils";

export type InvoiceFilters = {
  statuses: string[];
  departments: string[];
  decisionType: string;
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

const filterLabelClass = "text-xs font-semibold uppercase text-[var(--muted)]";
const filterControlClass =
  "focus-ring mt-1 min-h-11 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]";
const multiSelectTriggerClass =
  "focus-ring flex min-h-11 w-full items-center justify-between gap-3 border border-[var(--line)] bg-white px-3 py-2 text-left text-sm font-normal normal-case text-[var(--foreground)]";
const filterButtonClass = "focus-ring min-h-11 px-4 text-sm font-semibold";

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
  if (key === "payment") {
    return invoice.paymentProcessed ? "Processed for Payment" : "Not processed";
  }
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
      filters.departments.length === 0 ||
      filters.departments.includes(invoice.departmentId);
    const matchesDecision =
      !filters.decisionType || invoice.departmentDecision === filters.decisionType;
    const haystack = [
      invoice.vendorName,
      invoice.invoiceNumber,
      invoice.poNumber,
      invoice.amount,
      departmentName(data, invoice.departmentId),
      invoice.departmentDecision,
      invoice.paymentProcessed
        ? "processed for payment"
        : "not processed for payment",
      invoice.status,
    ]
      .join(" ")
      .toLowerCase();
    return (
      matchesStatus &&
      matchesDepartment &&
      matchesDecision &&
      haystack.includes(filters.search.toLowerCase())
    );
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
  filters.departments.forEach((department) => params.append("department", department));
  if (filters.decisionType) params.set("decisionType", filters.decisionType);
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
  showDecisionTypeFilter = false,
}: {
  data: AppData;
  filters: InvoiceFilters;
  clearHref: string;
  showDecisionTypeFilter?: boolean;
}) {
  const filterKey = [
    filters.search,
    filters.decisionType,
    filters.sort,
    filters.direction,
    ...filters.departments,
    ...filters.statuses,
  ].join("|");
  const statusOptions = filterableStatuses(data);
  const statusSummary =
    filters.statuses.length === 0
      ? "All statuses"
      : `${filters.statuses.length} selected`;
  const activeFilterCount =
    (filters.search ? 1 : 0) +
    (filters.decisionType ? 1 : 0) +
    filters.statuses.length +
    filters.departments.length;
  const summaryText =
    activeFilterCount > 0
      ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`
      : "Collapsed";

  return (
    <CollapsibleSection
      defaultOpen={activeFilterCount > 0}
      summaryText={summaryText}
      title="Filters"
    >
      <form
        className={`grid gap-4 md:grid-cols-2 ${
          showDecisionTypeFilter
            ? "xl:grid-cols-[minmax(240px,1fr)_minmax(220px,1fr)_minmax(220px,1fr)_minmax(220px,1fr)_auto]"
            : "xl:grid-cols-[minmax(240px,1fr)_minmax(220px,1fr)_minmax(220px,1fr)_auto]"
        }`}
        key={filterKey || "clear"}
      >
        <input name="sort" type="hidden" value={filters.sort} />
        <input name="direction" type="hidden" value={filters.direction} />
        <label className={filterLabelClass}>
          Search
          <input
            className={filterControlClass}
            name="search"
            placeholder="Search vendor, PO, invoice, status"
            defaultValue={filters.search}
          />
        </label>
        <div className={filterLabelClass}>
          Status
          <details className="relative">
            <summary className={`${filterControlClass} flex cursor-pointer list-none items-center justify-between`}>
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
        </div>
        <div>
          <div className={filterLabelClass}>Department</div>
          <div className="mt-1">
            <MultiSelectDropdown
              emptyLabel="No departments are available."
              initialSelected={filters.departments}
              name="department"
              options={data.departments.map((department) => ({
                id: department.id,
                label: department.name,
              }))}
              placeholder="All departments"
              summaryPluralLabel="departments"
              triggerClassName={multiSelectTriggerClass}
            />
          </div>
        </div>
        {showDecisionTypeFilter ? (
          <label className={filterLabelClass}>
            Decision Type
            <select
              className={filterControlClass}
              defaultValue={filters.decisionType}
              name="decisionType"
            >
              <option value="">All Decision Types</option>
              {data.departmentDecisions.map((decision) => (
                <option key={decision.id} value={decision.label}>
                  {decision.label}
                  {decision.active ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex items-end gap-2 self-end">
          <button
            className={`${filterButtonClass} bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]`}
          >
            Filter
          </button>
          <Link
            className={`${filterButtonClass} inline-flex items-center justify-center border border-[var(--line)] bg-white text-[var(--foreground)] hover:bg-slate-100`}
            href={clearHref}
            prefetch={false}
            replace
          >
            Clear Filters
          </Link>
        </div>
      </form>
    </CollapsibleSection>
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
  const showStatus = invoiceFieldEnabled(data, "status");
  const showVendor = invoiceFieldEnabled(data, "vendorName");
  const showInvoice =
    invoiceFieldEnabled(data, "invoiceNumber") || invoiceFieldEnabled(data, "invoiceDate");
  const showPo = invoiceFieldEnabled(data, "poNumber");
  const showAmount = invoiceFieldEnabled(data, "amount");
  const showDepartment = invoiceFieldEnabled(data, "departmentId");
  const showReceived = invoiceFieldEnabled(data, "dateReceived");
  const showDateProcessedForPayment = invoiceFieldEnabled(
    data,
    "dateProcessedForPayment",
  );
  const visibleColumnCount =
    [
      showStatus,
      showVendor,
      showInvoice,
      showPo,
      showAmount,
      showDepartment,
      true,
      true,
      showReceived,
      true,
    ].filter(Boolean).length || 1;

  return (
    <div className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
      <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
        <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
          <tr>
            {showStatus ? <SortHeader baseHref={baseHref} filters={filters} label="Status" sort="status" /> : null}
            {showVendor ? <SortHeader baseHref={baseHref} filters={filters} label="Vendor" sort="vendor" /> : null}
            {showInvoice ? <SortHeader baseHref={baseHref} filters={filters} label="Invoice" sort="invoice" /> : null}
            {showPo ? <SortHeader baseHref={baseHref} filters={filters} label="PO" sort="po" /> : null}
            {showAmount ? <SortHeader baseHref={baseHref} filters={filters} label="Amount" sort="amount" /> : null}
            {showDepartment ? <SortHeader baseHref={baseHref} filters={filters} label="Department" sort="department" /> : null}
            <SortHeader baseHref={baseHref} filters={filters} label="Decision" sort="decision" />
            <SortHeader baseHref={baseHref} filters={filters} label="Payment" sort="payment" />
            {showReceived ? <SortHeader baseHref={baseHref} filters={filters} label="Date Invoice Received" sort="received" /> : null}
            <th className="border-b border-[var(--line)] px-3 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr
              key={invoice.id}
              className={`align-top hover:bg-slate-50 ${
                invoice.requiresApAttention ? "bg-amber-50/50" : ""
              }`}
            >
              {showStatus ? (
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
              ) : null}
              {showVendor ? (
                <td className="border-b border-[var(--line)] px-3 py-3 font-medium">
                {invoice.vendorName || "Unknown Vendor"}
                <div className="mt-1 text-xs font-normal text-[var(--muted)]">
                  Vendor validation: {invoice.vendorValidationStatus || "Not Checked"}
                </div>
                {invoiceFieldEnabled(data, "vendorNumber") ? (
                  <div className="mt-1 text-xs font-normal text-[var(--muted)]">
                    Vendor number: {invoice.vendorNumber || "Not selected"}
                  </div>
                ) : null}
                {invoice.vendorValidationStatus && invoice.vendorValidationStatus !== "Validated" ? (
                  <div className="mt-2 inline-flex border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                    Vendor not validated
                  </div>
                ) : null}
                {invoice.requiresApAttention ? (
                  <div className="mt-2 inline-flex border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                    AP Attention
                  </div>
                ) : null}
                {invoice.duplicateCheckStatus === "Potential Duplicate" ? (
                  <div className="mt-2 inline-flex border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                    Potential Duplicate
                  </div>
                ) : null}
                {invoice.poValidationStatus &&
                invoice.poValidationStatus !== "Not Checked" ? (
                  <div className="mt-1 text-xs font-normal text-[var(--muted)]">
                    {invoice.poValidationStatus}
                  </div>
                ) : null}
                {invoiceFieldEnabled(data, "ocrSummary") ? (
                  <div className="mt-1 text-xs font-normal text-[var(--muted)]">
                  {invoice.ocrSummary}
                </div>
                ) : null}
              </td>
              ) : null}
              {showInvoice ? (
                <td className="border-b border-[var(--line)] px-3 py-3">
                  {invoiceFieldEnabled(data, "invoiceNumber") ? invoice.invoiceNumber || "Not set" : null}
                  {invoiceFieldEnabled(data, "invoiceDate") ? (
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {formatDate(invoice.invoiceDate)}
                    </div>
                  ) : null}
                </td>
              ) : null}
              {showPo ? (
                <td className="border-b border-[var(--line)] px-3 py-3 font-mono text-xs">
                {invoice.poNumber || "Missing"}
              </td>
              ) : null}
              {showAmount ? (
                <td className="border-b border-[var(--line)] px-3 py-3">
                {currencyDisplay(invoice.amount)}
              </td>
              ) : null}
              {showDepartment ? (
                <td className="border-b border-[var(--line)] px-3 py-3">
                {departmentName(data, invoice.departmentId)}
              </td>
              ) : null}
              <td className="border-b border-[var(--line)] px-3 py-3">
                {invoice.departmentDecision || "Waiting"}
              </td>
              <td className="border-b border-[var(--line)] px-3 py-3">
                {invoice.paymentProcessed ? "Processed for Payment" : "Not processed"}
                {showDateProcessedForPayment && invoice.paymentProcessed ? (
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {invoice.dateProcessedForPayment
                      ? formatDate(invoice.dateProcessedForPayment)
                      : "Date not set"}
                  </div>
                ) : null}
              </td>
              {showReceived ? (
                <td className="border-b border-[var(--line)] px-3 py-3">
                {formatDate(invoice.dateReceived)}
              </td>
              ) : null}
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
                  <DeleteInvoiceConfirmation invoiceId={invoice.id} />
                </div>
              </td>
            </tr>
          ))}
          {invoices.length === 0 ? (
            <tr>
              <td className="px-3 py-8 text-center text-[var(--muted)]" colSpan={visibleColumnCount}>
                No invoices match the current view.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
