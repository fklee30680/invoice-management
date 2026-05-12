import {
  buildReportMetrics,
  dateFieldLabel,
  filteredReportInvoices,
  parseReportFilters,
  reportTitle,
} from "@/lib/reports";
import { buildInvoiceProcessingMetrics } from "@/lib/processing-metrics";
import { requireApUser } from "@/lib/session";
import { readData } from "@/lib/store";
import { currencyDisplay, formatDate } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReportsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function days(value: number | null) {
  return value === null ? "N/A" : `${value.toFixed(value % 1 ? 1 : 0)} days`;
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function dateInputValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10) === value ? value : "";
}

function addParam(params: URLSearchParams, name: string, value: string) {
  if (value) params.set(name, value);
}

function processingRangeDescription(fromDate: string, toDate: string) {
  if (fromDate && toDate) {
    return `Showing metrics for invoices uploaded/imported from ${formatDate(fromDate)} to ${formatDate(toDate)}.`;
  }
  if (fromDate) {
    return `Showing metrics for invoices uploaded/imported on or after ${formatDate(fromDate)}.`;
  }
  if (toDate) {
    return `Showing metrics for invoices uploaded/imported on or before ${formatDate(toDate)}.`;
  }
  return "Showing metrics for all invoice processing data.";
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  await requireApUser();
  const query = (await searchParams) || {};
  const data = await readData();
  const filters = parseReportFilters(query);
  const processingFromDate = dateInputValue(one(query.processingFromDate));
  const processingToDate = dateInputValue(one(query.processingToDate));
  const processingDateRangeInvalid =
    Boolean(processingFromDate && processingToDate) &&
    processingFromDate > processingToDate;
  const invoices = filteredReportInvoices(data, filters);
  const metrics = buildReportMetrics(data, invoices, filters);
  const processingMetrics = buildInvoiceProcessingMetrics(data, {
    fromDate: processingFromDate,
    toDate: processingToDate,
  });

  const pdfParams = new URLSearchParams();
  pdfParams.set("reportType", filters.reportType);
  pdfParams.set("dateField", filters.dateField);
  addParam(pdfParams, "fromDate", filters.fromDate);
  addParam(pdfParams, "toDate", filters.toDate);
  addParam(pdfParams, "vendor", filters.vendor);
  addParam(pdfParams, "departmentId", filters.departmentId);

  const processingClearParams = new URLSearchParams();
  processingClearParams.set("reportType", filters.reportType);
  processingClearParams.set("dateField", filters.dateField);
  addParam(processingClearParams, "fromDate", filters.fromDate);
  addParam(processingClearParams, "toDate", filters.toDate);
  addParam(processingClearParams, "vendor", filters.vendor);
  addParam(processingClearParams, "departmentId", filters.departmentId);
  const processingClearHref = processingClearParams.toString()
    ? `/reports?${processingClearParams.toString()}`
    : "/reports";

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="border-b border-[var(--line)] pb-5">
          <h1 className="text-3xl font-semibold tracking-normal">
            Reports
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
            Run branded PDF reports using invoice information filters.
          </p>
        </header>

        <form
          className="grid gap-4 border border-[var(--line)] bg-[var(--panel)] p-4 lg:grid-cols-3"
        >
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Report
            <select
              className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
              defaultValue={filters.reportType}
              name="reportType"
            >
              <option value="total-activity">Total Activity Report</option>
              <option value="department">Department Report</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Date Field
            <select
              className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
              defaultValue={filters.dateField}
              name="dateField"
            >
              <option value="dateUploaded">Upload Date</option>
              <option value="invoiceDate">Invoice Date</option>
              <option value="dateApproved">Date Approved</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Department
            <select
              className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
              defaultValue={filters.departmentId}
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
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            From Date
            <input
              className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
              defaultValue={filters.fromDate}
              name="fromDate"
              type="date"
            />
          </label>
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            To Date
            <input
              className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
              defaultValue={filters.toDate}
              name="toDate"
              type="date"
            />
          </label>
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Vendor
            <input
              className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
              defaultValue={filters.vendor}
              name="vendor"
              placeholder="All vendors"
            />
          </label>
          <div className="flex flex-wrap gap-2 lg:col-span-3">
            <button className="focus-ring bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              Run Report
            </button>
            <a
              className="focus-ring inline-flex items-center justify-center bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
              href={`/reports/download?${pdfParams.toString()}`}
            >
              Download PDF
            </a>
          </div>
          {processingFromDate ? (
            <input name="processingFromDate" type="hidden" value={processingFromDate} />
          ) : null}
          {processingToDate ? (
            <input name="processingToDate" type="hidden" value={processingToDate} />
          ) : null}
        </form>

        <section className="border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">{reportTitle(filters.reportType)}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {invoices.length} invoices selected by {dateFieldLabel(filters.dateField)}.
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="border-b border-[var(--line)] px-3 py-3">Group</th>
                  <th className="border-b border-[var(--line)] px-3 py-3">Total Invoices</th>
                  <th className="border-b border-[var(--line)] px-3 py-3">Total Dollars</th>
                  <th className="border-b border-[var(--line)] px-3 py-3">Approved/Completed</th>
                  <th className="border-b border-[var(--line)] px-3 py-3">Average Approval</th>
                  <th className="border-b border-[var(--line)] px-3 py-3">Median Approval</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr className="align-top hover:bg-slate-50" key={metric.label}>
                    <td className="border-b border-[var(--line)] px-3 py-3 font-semibold">
                      {metric.label}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {metric.totalInvoices}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {currencyDisplay(String(metric.totalDollars))}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {metric.approvedInvoices}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {days(metric.averageApprovalDays)}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {days(metric.medianApprovalDays)}
                    </td>
                  </tr>
                ))}
                {metrics.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-[var(--muted)]" colSpan={6}>
                      No invoices match the current report filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border border-[var(--line)] bg-[var(--panel)] p-4">
          <h2 className="text-xl font-semibold">Invoice Processing Metrics</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Filters processing metrics by invoice upload/import date or the date
            the invoice was created in the system.
          </p>
          <form className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-[220px_220px_auto]">
            <input name="reportType" type="hidden" value={filters.reportType} />
            <input name="dateField" type="hidden" value={filters.dateField} />
            {filters.fromDate ? (
              <input name="fromDate" type="hidden" value={filters.fromDate} />
            ) : null}
            {filters.toDate ? (
              <input name="toDate" type="hidden" value={filters.toDate} />
            ) : null}
            {filters.vendor ? (
              <input name="vendor" type="hidden" value={filters.vendor} />
            ) : null}
            {filters.departmentId ? (
              <input name="departmentId" type="hidden" value={filters.departmentId} />
            ) : null}
            <label className="text-xs font-semibold uppercase text-[var(--muted)]">
              Start Date
              <input
                className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                defaultValue={processingFromDate}
                name="processingFromDate"
                type="date"
              />
            </label>
            <label className="text-xs font-semibold uppercase text-[var(--muted)]">
              End Date
              <input
                className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                defaultValue={processingToDate}
                name="processingToDate"
                type="date"
              />
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <button className="focus-ring min-h-10 bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
                Apply Dates
              </button>
              <a
                className="focus-ring inline-flex min-h-10 items-center justify-center border border-[var(--line)] bg-white px-4 text-sm font-semibold hover:bg-slate-100"
                href={processingClearHref}
              >
                Clear Dates
              </a>
            </div>
          </form>
          <p className="mt-3 text-sm text-[var(--muted)]">
            {processingRangeDescription(processingFromDate, processingToDate)}
          </p>
          {processingDateRangeInvalid ? (
            <p className="mt-2 border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
              Start Date is after End Date, so no processing records match this
              range.
            </p>
          ) : null}
          <div className="mt-4 grid gap-px bg-[var(--line)] text-sm sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Uploaded", String(processingMetrics.totalUploaded)],
              ["Auto-routed", `${processingMetrics.percentAutoRouted}%`],
              ["Sent to AP Review", `${processingMetrics.percentSentToApReview}%`],
              ["OCR Failure Rate", `${processingMetrics.ocrFailureRate}%`],
              ["Field Accuracy", `${processingMetrics.fieldExtractionAccuracy}%`],
              ["Human Correction Rate", `${processingMetrics.humanCorrectionRate}%`],
              ["Vendor Match Rate", `${processingMetrics.vendorMatchRate}%`],
              ["PO Match Rate", `${processingMetrics.poMatchRate}%`],
              ["Duplicate Detection Rate", `${processingMetrics.duplicateDetectionRate}%`],
              ["Math Failure Rate", `${processingMetrics.mathValidationFailureRate}%`],
              [
                "Average Processing Time",
                `${Math.round(processingMetrics.averageProcessingTimeMs / 1000)}s`,
              ],
            ].map(([label, value]) => (
              <div className="bg-white p-3" key={label}>
                <div className="text-xs font-semibold uppercase text-[var(--muted)]">
                  {label}
                </div>
                <div className="mt-1 text-lg font-semibold">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="border border-[var(--line)] bg-white p-3">
              <h3 className="text-sm font-semibold">Top AP Review Reasons</h3>
              <div className="mt-2 space-y-1 text-sm">
                {processingMetrics.topApReviewReasons.map((item) => (
                  <div className="flex justify-between gap-3" key={item.label}>
                    <span className="font-mono text-xs">{item.label}</span>
                    <span>{item.count}</span>
                  </div>
                ))}
                {processingMetrics.topApReviewReasons.length === 0 ? (
                  <div className="text-[var(--muted)]">No review reasons recorded.</div>
                ) : null}
              </div>
            </div>
            <div className="border border-[var(--line)] bg-white p-3">
              <h3 className="text-sm font-semibold">Top Vendors By Exception Count</h3>
              <div className="mt-2 space-y-1 text-sm">
                {processingMetrics.topVendorsByExceptionCount.map((item) => (
                  <div className="flex justify-between gap-3" key={item.label}>
                    <span>{item.label}</span>
                    <span>{item.count}</span>
                  </div>
                ))}
                {processingMetrics.topVendorsByExceptionCount.length === 0 ? (
                  <div className="text-[var(--muted)]">No vendor exceptions recorded.</div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
