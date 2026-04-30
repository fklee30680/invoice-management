import Link from "next/link";
import {
  updateAndRouteInvoice,
  uploadInvoices,
} from "@/lib/actions";
import {
  invoicesForSummaryView,
  summaryViewPath,
  type InvoiceSummaryView,
} from "@/lib/invoice-views";
import { invoiceFieldEnabled } from "@/lib/invoice-fields";
import { requireApUser } from "@/lib/session";
import { statusBadgeClass, statusesForApWorkQueue } from "@/lib/status-config";
import { readData } from "@/lib/store";
import type { AppData } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function Metric({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href: string;
}) {
  return (
    <Link
      className="focus-ring block border border-[var(--line)] bg-[var(--panel)] p-4 hover:border-[var(--accent)] hover:bg-teal-50"
      href={href}
    >
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-normal">{value}</div>
    </Link>
  );
}

function UploadPanel() {
  return (
    <section>
      <form
        action={uploadInvoices}
        className="border border-[var(--line)] bg-[var(--panel)] p-4"
      >
        <h2 className="text-base font-semibold">Invoice Upload</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Upload invoice PDFs or images. OCR runs immediately.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            className="focus-ring min-h-10 flex-1 border border-[var(--line)] bg-white px-3 py-2 text-sm"
            name="invoiceFiles"
            type="file"
            accept=".pdf,image/*"
            multiple
            required
          />
          <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Upload Invoices
          </button>
        </div>
      </form>
    </section>
  );
}

function ApWorkQueue({ data }: { data: AppData }) {
  const apWorkStatuses = statusesForApWorkQueue(data);
  const queue = data.invoices.filter((invoice) => apWorkStatuses.includes(invoice.status));

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">AP Review And Rework</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Update invoice information, assign or correct the department, and resend notification.
          </p>
        </div>
        <span className="text-sm text-[var(--muted)]">{queue.length} active</span>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {queue.map((invoice) => (
          <form
            action={updateAndRouteInvoice}
            className="border border-[var(--line)] bg-[var(--panel)] p-4"
            key={invoice.id}
          >
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <span
                  className={`inline-flex border px-2 py-1 text-xs font-semibold ${statusBadgeClass(data, invoice.status)}`}
                >
                  {invoice.status}
                </span>
                <h3 className="mt-2 font-semibold">
                  {invoiceFieldEnabled(data, "vendorName")
                    ? invoice.vendorName || "Unknown Vendor"
                    : "Invoice"}
                  {invoiceFieldEnabled(data, "invoiceNumber") ? (
                    <span className="font-normal text-[var(--muted)]">
                      {" "}
                      {invoice.invoiceNumber || "No invoice number"}
                    </span>
                  ) : null}
                </h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Vendor record: {invoice.vendorValidationStatus || "Not Checked"}
                </p>
              </div>
              <Link
                className="focus-ring border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
                href={`/files/${invoice.fileId}`}
              >
                Download
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {invoiceFieldEnabled(data, "vendorName") ? (
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                  Vendor
                  <input
                    className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                    name="vendorName"
                    defaultValue={invoice.vendorName}
                  />
                </label>
              ) : null}
              {invoiceFieldEnabled(data, "invoiceNumber") ? (
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                  Invoice Number
                  <input
                    className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                    name="invoiceNumber"
                    defaultValue={invoice.invoiceNumber}
                  />
                </label>
              ) : null}
              {invoiceFieldEnabled(data, "invoiceDate") ? (
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                  Invoice Date
                  <input
                    className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                    name="invoiceDate"
                    type="date"
                    defaultValue={invoice.invoiceDate}
                  />
                </label>
              ) : null}
              {invoiceFieldEnabled(data, "amount") ? (
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                  Amount
                  <input
                    className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                    name="amount"
                    defaultValue={invoice.amount}
                  />
                </label>
              ) : null}
              {invoiceFieldEnabled(data, "poNumber") ? (
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                  PO Number
                  <input
                    className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                    name="poNumber"
                    defaultValue={invoice.poNumber}
                  />
                </label>
              ) : null}
              {invoiceFieldEnabled(data, "dateReceived") ? (
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                  Date Received
                  <input
                    className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                    name="dateReceived"
                    type="date"
                    defaultValue={invoice.dateReceived}
                  />
                </label>
              ) : null}
              <label className="text-xs font-semibold uppercase text-[var(--muted)] sm:col-span-2">
                Department
                <select
                  className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                  name="departmentId"
                  defaultValue={invoice.departmentId}
                  required
                >
                  <option value="">Select department</option>
                  {data.departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
                Save And Route
              </button>
            </div>
          </form>
        ))}
        {queue.length === 0 ? (
          <div className="border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-[var(--muted)] xl:col-span-2">
            No AP review or rework items are waiting.
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default async function Home({ searchParams }: PageProps) {
  await requireApUser();
  const params = (await searchParams) || {};
  const pageError = one(params.error);
  const data = await readData();
  const metricViews: InvoiceSummaryView[] = [
    "total",
    "needs-ap-work",
    "with-departments",
    "completed",
    "manual-payment",
  ];

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="border-b border-[var(--line)] pb-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal">
              Dashboard
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Upload invoices, validate against PO data, route department review,
              and track every invoice through AP completion.
            </p>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {metricViews.map((view) => (
            <Metric
              href={summaryViewPath(view)}
              key={view}
              label={
                view === "total"
                  ? "Total invoices"
                  : view === "needs-ap-work"
                    ? "Needs AP work"
                    : view === "with-departments"
                      ? "With departments"
                      : view === "completed"
                        ? "Completed"
                        : "Invoices to be paid manually"
              }
              value={invoicesForSummaryView(data.invoices, view, data).length}
            />
          ))}
        </section>

        {pageError === "file-storage" ? (
          <section className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
            Invoice upload failed because persistent file storage is not working.
            Check Setup &gt; Environment before retrying.
          </section>
        ) : null}
        <UploadPanel />
        <ApWorkQueue data={data} />
      </div>
    </main>
  );
}
