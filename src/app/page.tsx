import Link from "next/link";
import Image from "next/image";
import {
  cloneSampleInvoice,
  updateAndRouteInvoice,
  uploadInvoices,
  uploadPoList,
} from "@/lib/actions";
import {
  FilterBar,
  InvoiceTable,
  filterInvoices,
  many,
  one,
} from "@/components/invoice-list";
import {
  invoicesForSummaryView,
  summaryViewPath,
  type InvoiceSummaryView,
} from "@/lib/invoice-views";
import { getPersistenceStatus, type PersistenceStatus } from "@/lib/runtime-config";
import { requireApUser } from "@/lib/session";
import { statusBadgeClass, statusesForApWorkQueue } from "@/lib/status-config";
import { readData } from "@/lib/store";
import type { AppData } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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

function StorageStatus({ status }: { status: PersistenceStatus }) {
  const itemClass = "border border-[var(--line)] bg-white px-3 py-2";
  const goodClass = "text-emerald-700";
  const warnClass = "text-amber-700";
  const databaseLabel = status.records.issue
    ? "Postgres configured but unavailable"
    : status.records.configured
      ? "Postgres active"
      : "Temporary storage";
  const fileStorageLabel = status.files.issue
    ? "Blob configured but unavailable"
    : status.files.configured
      ? "Vercel Blob active"
      : "Temporary storage";

  return (
    <section className="grid gap-3 text-sm md:grid-cols-2">
      <div className={itemClass}>
        <div className="text-xs font-semibold uppercase text-[var(--muted)]">
          Database
        </div>
        <div className={`mt-1 font-semibold ${status.records.configured && !status.records.issue ? goodClass : warnClass}`}>
          {databaseLabel}
        </div>
        <div className="mt-1 text-xs text-[var(--muted)]">
          Env: {status.records.variableName}
        </div>
        {status.records.issue ? (
          <div className="mt-2 text-xs text-amber-800">
            Last error: {status.records.issue}
          </div>
        ) : null}
      </div>
      <div className={itemClass}>
        <div className="text-xs font-semibold uppercase text-[var(--muted)]">
          File Storage
        </div>
        <div className={`mt-1 font-semibold ${status.files.configured && !status.files.issue ? goodClass : warnClass}`}>
          {fileStorageLabel}
        </div>
        <div className="mt-1 text-xs text-[var(--muted)]">
          Env: {status.files.variableName}
        </div>
        {status.files.issue ? (
          <div className="mt-2 text-xs text-amber-800">
            Last error: {status.files.issue}
          </div>
        ) : null}
      </div>
      {status.warning ? (
        <div className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 md:col-span-2">
          {status.warning}
        </div>
      ) : null}
    </section>
  );
}

function UploadPanel() {
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_1fr_220px]">
      <form
        action={uploadPoList}
        className="border border-[var(--line)] bg-[var(--panel)] p-4"
      >
        <h2 className="text-base font-semibold">PO List Upload</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Required columns: PO number, vendor, department.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            className="focus-ring min-h-10 flex-1 border border-[var(--line)] bg-white px-3 py-2 text-sm"
            name="poFile"
            type="file"
            accept=".csv,.xlsx,.xls"
            required
          />
          <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Import PO List
          </button>
        </div>
      </form>

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

      <form
        action={cloneSampleInvoice}
        className="border border-[var(--line)] bg-[var(--panel)] p-4"
      >
        <h2 className="text-base font-semibold">Demo Data</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Create a routed invoice using a seeded PO.
        </p>
        <button className="focus-ring mt-4 w-full border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-teal-50">
          Add Sample
        </button>
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
            Update metadata, assign or correct the department, and resend notification.
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
                  {invoice.vendorName || "Unknown Vendor"}{" "}
                  <span className="font-normal text-[var(--muted)]">
                    {invoice.invoiceNumber || "No invoice number"}
                  </span>
                </h3>
              </div>
              <Link
                className="focus-ring border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
                href={`/files/${invoice.fileId}`}
              >
                Download
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                Vendor
                <input
                  className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                  name="vendorName"
                  defaultValue={invoice.vendorName}
                />
              </label>
              <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                Invoice Number
                <input
                  className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                  name="invoiceNumber"
                  defaultValue={invoice.invoiceNumber}
                />
              </label>
              <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                Invoice Date
                <input
                  className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                  name="invoiceDate"
                  type="date"
                  defaultValue={invoice.invoiceDate}
                />
              </label>
              <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                Amount
                <input
                  className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                  name="amount"
                  defaultValue={invoice.amount}
                />
              </label>
              <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                PO Number
                <input
                  className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                  name="poNumber"
                  defaultValue={invoice.poNumber}
                />
              </label>
              <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                Date Received
                <input
                  className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                  name="dateReceived"
                  type="date"
                  defaultValue={invoice.dateReceived}
                />
              </label>
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
  const filters = {
    statuses: many(params.status),
    department: one(params.department),
    search: one(params.search),
  };
  const data = await readData();
  const branding = data.branding;
  const persistenceStatus = getPersistenceStatus();
  const invoices = filterInvoices(data.invoices, data, filters);
  const metricViews: InvoiceSummaryView[] = [
    "total",
    "needs-ap-work",
    "with-departments",
    "completed",
  ];

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="border-b border-[var(--line)] pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              {branding.logo ? (
                <Image
                  alt={`${branding.appTitle} logo`}
                  className="max-h-14 max-w-44 object-contain"
                  height={56}
                  src="/branding/logo"
                  unoptimized
                  width={176}
                />
              ) : null}
              <div>
                <p className="text-sm font-semibold uppercase tracking-normal text-[var(--accent)]">
                  {branding.divisionLabel}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                  {branding.appTitle}
                </h1>
              </div>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Upload invoices, validate against PO data, route department review,
              and track every invoice through AP completion.
            </p>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                      : "Completed"
              }
              value={invoicesForSummaryView(data.invoices, view, data).length}
            />
          ))}
        </section>

        {pageError === "file-storage" ? (
          <section className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
            Invoice upload failed because persistent file storage is not working. Check the
            File Storage panel before retrying.
          </section>
        ) : null}
        <StorageStatus status={persistenceStatus} />
        <UploadPanel />
        <FilterBar data={data} filters={filters} clearHref="/" />
        <InvoiceTable data={data} invoices={invoices} />
        <ApWorkQueue data={data} />
      </div>
    </main>
  );
}
