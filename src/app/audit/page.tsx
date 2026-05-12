import Link from "next/link";
import {
  auditEventDepartment,
  auditEventCategoryLabel,
  auditEventDisplayType,
  auditEventInvoice,
  auditEventCategoryOptions,
  auditLogFilterEnabled,
  auditLogPageSizes,
  auditLogQueryFromSearchParams,
  auditLogQueryToSearchParams,
  filterAuditEvents,
  paginateAuditEvents,
  sortAuditEvents,
  type AuditLogDirection,
  type AuditLogQuery,
  type AuditLogSortKey,
} from "@/lib/audit-log";
import { requireApUser } from "@/lib/session";
import { readData } from "@/lib/store";
import type { AppData } from "@/lib/types";
import { currencyDisplay, formatDate, formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuditPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const filterInputClass =
  "focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)]";
const filterLabelClass = "text-xs font-semibold uppercase text-[var(--muted)]";

const sortableColumns: Array<{ key: AuditLogSortKey; label: string }> = [
  { key: "auditDate", label: "Audit Date" },
  { key: "actor", label: "Actor" },
  { key: "type", label: "Action" },
  { key: "department", label: "Department" },
  { key: "vendor", label: "Vendor" },
  { key: "invoiceNumber", label: "Invoice #" },
  { key: "invoiceDate", label: "Invoice Date" },
  { key: "amount", label: "Amount" },
  { key: "poNumber", label: "PO #" },
];

function auditHref(query: AuditLogQuery, overrides = {}) {
  const params = auditLogQueryToSearchParams(query, overrides);
  const search = params.toString();
  return search ? `/audit?${search}` : "/audit";
}

function exportHref(query: AuditLogQuery) {
  const params = auditLogQueryToSearchParams(query, { page: undefined });
  const search = params.toString();
  return search ? `/audit/export?${search}` : "/audit/export";
}

function nextDirection(query: AuditLogQuery, key: AuditLogSortKey): AuditLogDirection {
  if (query.sort !== key) return key === "auditDate" ? "desc" : "asc";
  return query.direction === "asc" ? "desc" : "asc";
}

function SortHeader({
  query,
  sortKey,
  label,
}: {
  query: AuditLogQuery;
  sortKey: AuditLogSortKey;
  label: string;
}) {
  const active = query.sort === sortKey;
  return (
    <Link
      className="focus-ring inline-flex items-center gap-1 font-semibold hover:text-[var(--foreground)]"
      href={auditHref(query, {
        sort: sortKey,
        direction: nextDirection(query, sortKey),
        page: 1,
      })}
    >
      {label}
      {active ? <span aria-hidden="true">{query.direction === "asc" ? "ASC" : "DESC"}</span> : null}
    </Link>
  );
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right),
  );
}

function RetentionSummary({ data }: { data: AppData }) {
  const settings = data.auditLogSettings;
  return (
    <section className="border border-[var(--line)] bg-[var(--panel)] p-4 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold">Audit Retention</h2>
          <p className="mt-1 text-[var(--muted)]">
            Retention defaults are defined for future cleanup policy. No audit records are deleted
            automatically by this page.
          </p>
        </div>
        <div className="grid gap-1 text-xs text-[var(--muted)] sm:text-right">
          <span>Retention: {settings.retentionYears} years minimum</span>
          <span>
            Security events:{" "}
            {settings.retainSecurityEventsPermanently ? "retained permanently" : "standard retention"}
          </span>
          <span>
            Invoice events:{" "}
            {settings.retainInvoiceEventsPermanently ? "retained permanently" : "standard retention"}
          </span>
          <span>
            Setup changes:{" "}
            {settings.retainSetupEventsPermanently ? "retained permanently" : "standard retention"}
          </span>
          <span>Manual purge: {settings.allowManualPurge ? "allowed" : "disabled"}</span>
          <span>
            System diagnostics default:{" "}
            {settings.includeSystemEventsByDefault ? "shown" : "hidden"}
          </span>
        </div>
      </div>
    </section>
  );
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  await requireApUser();
  const data = await readData();
  const settings = data.auditLogSettings;
  const query = auditLogQueryFromSearchParams((await searchParams) || {}, settings);
  const filteredEvents = filterAuditEvents(data, query.filters, {
    includeSystemEvents: query.includeSystemEvents,
  });
  const sortedEvents = sortAuditEvents(data, filteredEvents, query.sort, query.direction);
  const page = paginateAuditEvents(sortedEvents, query.page, query.pageSize);
  const actorOptions = uniqueSorted(data.auditEvents.map((event) => event.actor));
  const typeOptions = uniqueSorted(data.auditEvents.map((event) => event.type));
  const statusOptions = uniqueSorted(data.invoices.map((invoice) => invoice.status));
  const hasFilter = (field: Parameters<typeof auditLogFilterEnabled>[1]) =>
    auditLogFilterEnabled(settings, field);
  const activeFilterCount =
    Object.values(query.filters).filter(Boolean).length +
    (query.includeSystemEvents ? 1 : 0);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal">Audit Log</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Review staff actions and business-significant activity, including invoice updates,
              routing, department decisions, notifications, setup changes, payment processing, and
              deletion activity.
            </p>
          </div>
          <Link
            className="focus-ring inline-flex self-start border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 sm:self-auto"
            href="/settings/audit-log"
          >
            Configure Audit Log Filters
          </Link>
        </header>

        <section className="border border-[var(--line)] bg-[var(--panel)]">
          <details open={activeFilterCount > 0}>
            <summary className="focus-ring flex cursor-pointer list-none flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <span>
                <span className="font-semibold">Filters</span>
                <span className="ml-2 text-[var(--muted)]">
                  {activeFilterCount > 0
                    ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}`
                    : "Collapsed"}
                </span>
              </span>
              <span className="text-xs font-semibold uppercase text-[var(--muted)]">
                Expand / Collapse
              </span>
            </summary>
            <div className="border-t border-[var(--line)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-sm text-[var(--muted)]">
                  Filter staff and business audit events by audit details and related invoice
                  fields. System and diagnostic events are hidden unless explicitly included.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className="focus-ring inline-flex border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
                    href="/audit"
                  >
                    Clear Filters
                  </Link>
                  <Link
                    className="focus-ring inline-flex border border-[var(--accent)] bg-white px-3 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-teal-50"
                    href={exportHref(query)}
                  >
                    Export CSV
                  </Link>
                </div>
              </div>

              <form action="/audit" className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input name="sort" type="hidden" value={query.sort} />
            <input name="direction" type="hidden" value={query.direction} />
            <label className="flex items-start gap-3 text-sm md:col-span-2 xl:col-span-4">
              <input
                className="mt-1 h-4 w-4 accent-[var(--accent)]"
                defaultChecked={query.includeSystemEvents}
                name="includeSystemEvents"
                type="checkbox"
                value="true"
              />
              <span>
                <span className="block font-semibold">Include system/diagnostic events</span>
                <span className="text-[var(--muted)]">
                  Use this for troubleshooting OCR, storage, email, and processing diagnostics.
                </span>
              </span>
            </label>
            {hasFilter("department") ? (
              <label className={filterLabelClass}>
                Department
                <select
                  className={filterInputClass}
                  defaultValue={query.filters.departmentId}
                  name="departmentId"
                >
                  <option value="">All departments</option>
                  {data.departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {hasFilter("vendor") ? (
              <label className={filterLabelClass}>
                Vendor
                <input
                  className={filterInputClass}
                  defaultValue={query.filters.vendor}
                  name="vendor"
                  placeholder="Vendor"
                />
              </label>
            ) : null}
            {hasFilter("vendorNumber") ? (
              <label className={filterLabelClass}>
                Vendor Number
                <input
                  className={filterInputClass}
                  defaultValue={query.filters.vendorNumber}
                  name="vendorNumber"
                  placeholder="Vendor number"
                />
              </label>
            ) : null}
            {hasFilter("invoiceDate") ? (
              <>
                <label className={filterLabelClass}>
                  Invoice Date From
                  <input
                    className={filterInputClass}
                    defaultValue={query.filters.invoiceDateFrom}
                    name="invoiceDateFrom"
                    type="date"
                  />
                </label>
                <label className={filterLabelClass}>
                  Invoice Date To
                  <input
                    className={filterInputClass}
                    defaultValue={query.filters.invoiceDateTo}
                    name="invoiceDateTo"
                    type="date"
                  />
                </label>
              </>
            ) : null}
            {hasFilter("amount") ? (
              <>
                <label className={filterLabelClass}>
                  Amount Min
                  <input
                    className={filterInputClass}
                    defaultValue={query.filters.amountMin}
                    inputMode="decimal"
                    name="amountMin"
                    placeholder="0.00"
                  />
                </label>
                <label className={filterLabelClass}>
                  Amount Max
                  <input
                    className={filterInputClass}
                    defaultValue={query.filters.amountMax}
                    inputMode="decimal"
                    name="amountMax"
                    placeholder="0.00"
                  />
                </label>
              </>
            ) : null}
            {hasFilter("poNumber") ? (
              <label className={filterLabelClass}>
                PO Number
                <input
                  className={filterInputClass}
                  defaultValue={query.filters.poNumber}
                  name="poNumber"
                  placeholder="PO number"
                />
              </label>
            ) : null}
            {hasFilter("invoiceNumber") ? (
              <label className={filterLabelClass}>
                Invoice Number
                <input
                  className={filterInputClass}
                  defaultValue={query.filters.invoiceNumber}
                  name="invoiceNumber"
                  placeholder="Invoice number"
                />
              </label>
            ) : null}
            {hasFilter("auditDate") ? (
              <>
                <label className={filterLabelClass}>
                  Audit Date From
                  <input
                    className={filterInputClass}
                    defaultValue={query.filters.auditFrom}
                    name="auditFrom"
                    type="date"
                  />
                </label>
                <label className={filterLabelClass}>
                  Audit Date To
                  <input
                    className={filterInputClass}
                    defaultValue={query.filters.auditTo}
                    name="auditTo"
                    type="date"
                  />
                </label>
              </>
            ) : null}
            {hasFilter("actor") ? (
              <label className={filterLabelClass}>
                Actor
                <select className={filterInputClass} defaultValue={query.filters.actor} name="actor">
                  <option value="">All actors</option>
                  {actorOptions.map((actor) => (
                    <option key={actor} value={actor}>
                      {actor}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {hasFilter("eventType") ? (
              <label className={filterLabelClass}>
                Action
                <select className={filterInputClass} defaultValue={query.filters.type} name="type">
                  <option value="">All actions</option>
                  {typeOptions.map((type) => (
                    <option key={type} value={type}>
                      {auditEventDisplayType({ type })}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {hasFilter("category") ? (
              <label className={filterLabelClass}>
                Category
                <select className={filterInputClass} defaultValue={query.filters.category} name="category">
                  <option value="">All staff/business categories</option>
                  {auditEventCategoryOptions.map((category) => (
                    <option key={category.key} value={category.key}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {hasFilter("status") ? (
              <label className={filterLabelClass}>
                Invoice Status
                <select className={filterInputClass} defaultValue={query.filters.status} name="status">
                  <option value="">All statuses</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {hasFilter("ocrProvider") ? (
              <label className={filterLabelClass}>
                OCR Provider
                <select
                  className={filterInputClass}
                  defaultValue={query.filters.ocrProvider}
                  name="ocrProvider"
                >
                  <option value="">All providers</option>
                  <option value="azure_document_intelligence">Azure Document Intelligence</option>
                  <option value="embedded_pdf_text">Embedded PDF Text</option>
                  <option value="filename_fallback">Filename Fallback</option>
                </select>
              </label>
            ) : null}
            {hasFilter("apAttention") ? (
              <label className={filterLabelClass}>
                AP Attention
                <select
                  className={filterInputClass}
                  defaultValue={query.filters.apAttention}
                  name="apAttention"
                >
                  <option value="">All</option>
                  <option value="yes">Requires AP attention</option>
                  <option value="no">No AP attention</option>
                </select>
              </label>
            ) : null}
            {hasFilter("paymentProcessed") ? (
              <label className={filterLabelClass}>
                Payment Processed
                <select
                  className={filterInputClass}
                  defaultValue={query.filters.paymentProcessed}
                  name="paymentProcessed"
                >
                  <option value="">All</option>
                  <option value="yes">Processed</option>
                  <option value="no">Not processed</option>
                </select>
              </label>
            ) : null}
            {hasFilter("messageSearch") ? (
              <label className={`${filterLabelClass} md:col-span-2 xl:col-span-3`}>
                Search
                <input
                  className={filterInputClass}
                  defaultValue={query.filters.q}
                  name="q"
                  placeholder="Search message, actor, type, vendor, invoice, PO, or department"
                />
              </label>
            ) : null}
            <label className={filterLabelClass}>
              Page Size
              <select className={filterInputClass} defaultValue={query.pageSize} name="pageSize">
                {auditLogPageSizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end justify-end md:col-span-2 xl:col-span-4">
              <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
                Apply Filters
              </button>
            </div>
              </form>
            </div>
          </details>
        </section>

        <RetentionSummary data={data} />

        <section className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
          <table className="w-full min-w-[1350px] border-collapse text-left text-sm">
            <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
              <tr>
                {sortableColumns.map((column) => (
                <th className="border-b border-[var(--line)] px-3 py-3" key={column.key}>
                  <SortHeader label={column.label} query={query} sortKey={column.key} />
                </th>
              ))}
                <th className="border-b border-[var(--line)] px-3 py-3">Category</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Message</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((event) => {
                const invoice = auditEventInvoice(data, event);
                const department = auditEventDepartment(data, invoice);

                return (
                  <tr className="align-top hover:bg-slate-50" key={event.id}>
                    <td className="border-b border-[var(--line)] px-3 py-3 text-[var(--muted)]">
                      {formatDateTime(event.createdAt)}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">{event.actor}</td>
                    <td className="border-b border-[var(--line)] px-3 py-3 font-mono text-xs uppercase text-[var(--muted)]">
                      {auditEventDisplayType(event)}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {department?.name || (
                        <span className="text-[var(--muted)]">Not invoice-specific</span>
                      )}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {invoice?.vendorName || <span className="text-[var(--muted)]">Not set</span>}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {invoice ? (
                        <Link
                          className="focus-ring font-semibold text-[var(--accent)] hover:underline"
                          href={`/review/${invoice.id}`}
                        >
                          {invoice.invoiceNumber || invoice.id}
                        </Link>
                      ) : (
                        <span className="text-[var(--muted)]">Not invoice-specific</span>
                      )}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {invoice?.invoiceDate ? formatDate(invoice.invoiceDate) : "Not set"}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {invoice?.amount ? currencyDisplay(invoice.amount) : "Not set"}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {invoice?.poNumber || <span className="text-[var(--muted)]">Not set</span>}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      <span className="inline-flex border border-[var(--line)] bg-white px-2 py-1 text-xs font-semibold">
                        {auditEventCategoryLabel(event)}
                      </span>
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">{event.message}</td>
                  </tr>
                );
              })}
              {page.items.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-[var(--muted)]" colSpan={11}>
                    No audit events match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <nav
          aria-label="Audit log pagination"
          className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="text-[var(--muted)]">
            Showing {page.start}-{page.end} of {page.total} events
          </div>
          <div className="flex gap-2">
            {page.page > 1 ? (
              <Link
                className="focus-ring border border-[var(--line)] bg-white px-3 py-2 font-semibold hover:bg-slate-100"
                href={auditHref(query, { page: page.page - 1 })}
              >
                Previous
              </Link>
            ) : (
              <span className="border border-[var(--line)] px-3 py-2 font-semibold text-[var(--muted)]">
                Previous
              </span>
            )}
            <span className="border border-[var(--line)] bg-white px-3 py-2 font-semibold">
              Page {page.page} of {page.totalPages}
            </span>
            {page.page < page.totalPages ? (
              <Link
                className="focus-ring border border-[var(--line)] bg-white px-3 py-2 font-semibold hover:bg-slate-100"
                href={auditHref(query, { page: page.page + 1 })}
              >
                Next
              </Link>
            ) : (
              <span className="border border-[var(--line)] px-3 py-2 font-semibold text-[var(--muted)]">
                Next
              </span>
            )}
          </div>
        </nav>
      </div>
    </main>
  );
}
