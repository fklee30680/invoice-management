import Link from "next/link";
import { signOut } from "@/lib/auth-actions";
import {
  cloneSampleInvoice,
  completeInvoice,
  updateAndRouteInvoice,
  uploadInvoices,
  uploadPoList,
} from "@/lib/actions";
import { WORKFLOW_STATUSES } from "@/lib/constants";
import { requireApUser } from "@/lib/session";
import { readData } from "@/lib/store";
import type { AppData, Invoice, WorkflowStatus } from "@/lib/types";
import { currencyDisplay, formatDate, formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function statusClass(status: WorkflowStatus) {
  const map: Record<WorkflowStatus, string> = {
    Uploaded: "border-slate-300 bg-slate-50 text-slate-700",
    "OCR Processing": "border-cyan-300 bg-cyan-50 text-cyan-800",
    "Needs AP Review": "border-amber-300 bg-amber-50 text-amber-800",
    Routed: "border-teal-300 bg-teal-50 text-teal-800",
    "Decision Received": "border-blue-300 bg-blue-50 text-blue-800",
    "Needs AP Rework": "border-orange-300 bg-orange-50 text-orange-800",
    "Approved/Completed": "border-emerald-300 bg-emerald-50 text-emerald-800",
    Rejected: "border-red-300 bg-red-50 text-red-800",
    Hold: "border-purple-300 bg-purple-50 text-purple-800",
  };
  return map[status];
}

function departmentName(data: AppData, id: string) {
  return data.departments.find((department) => department.id === id)?.name || "Unassigned";
}

function filterInvoices(
  invoices: Invoice[],
  data: AppData,
  filters: { status: string; department: string; search: string },
) {
  return invoices.filter((invoice) => {
    const matchesStatus = !filters.status || invoice.status === filters.status;
    const matchesDepartment =
      !filters.department || invoice.departmentId === filters.department;
    const haystack = [
      invoice.vendorName,
      invoice.invoiceNumber,
      invoice.poNumber,
      invoice.amount,
      departmentName(data, invoice.departmentId),
      invoice.departmentDecision,
      invoice.status,
    ]
      .join(" ")
      .toLowerCase();
    return matchesStatus && matchesDepartment && haystack.includes(filters.search.toLowerCase());
  });
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="border border-[var(--line)] bg-[var(--panel)] p-4">
      <div className="text-sm text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-normal">{value}</div>
    </div>
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

function FilterBar({
  data,
  filters,
}: {
  data: AppData;
  filters: { status: string; department: string; search: string };
}) {
  return (
    <form className="grid gap-3 border border-[var(--line)] bg-[var(--panel)] p-4 md:grid-cols-[1fr_220px_220px_auto]">
      <input
        className="focus-ring min-h-10 border border-[var(--line)] bg-white px-3 text-sm"
        name="search"
        placeholder="Search vendor, PO, invoice, status"
        defaultValue={filters.search}
      />
      <select
        className="focus-ring min-h-10 border border-[var(--line)] bg-white px-3 text-sm"
        name="status"
        defaultValue={filters.status}
      >
        <option value="">All statuses</option>
        {WORKFLOW_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <select
        className="focus-ring min-h-10 border border-[var(--line)] bg-white px-3 text-sm"
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
      <button className="focus-ring bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
        Filter
      </button>
    </form>
  );
}

function InvoiceTable({ data, invoices }: { data: AppData; invoices: Invoice[] }) {
  return (
    <div className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
      <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
        <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
          <tr>
            <th className="border-b border-[var(--line)] px-3 py-3">Status</th>
            <th className="border-b border-[var(--line)] px-3 py-3">Vendor</th>
            <th className="border-b border-[var(--line)] px-3 py-3">Invoice</th>
            <th className="border-b border-[var(--line)] px-3 py-3">PO</th>
            <th className="border-b border-[var(--line)] px-3 py-3">Amount</th>
            <th className="border-b border-[var(--line)] px-3 py-3">Department</th>
            <th className="border-b border-[var(--line)] px-3 py-3">Decision</th>
            <th className="border-b border-[var(--line)] px-3 py-3">Received</th>
            <th className="border-b border-[var(--line)] px-3 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="align-top hover:bg-slate-50">
              <td className="border-b border-[var(--line)] px-3 py-3">
                <span
                  className={`inline-flex border px-2 py-1 text-xs font-semibold ${statusClass(invoice.status)}`}
                >
                  {invoice.status}
                </span>
              </td>
              <td className="border-b border-[var(--line)] px-3 py-3 font-medium">
                {invoice.vendorName || "Unknown Vendor"}
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
                  {invoice.status === "Decision Received" ? (
                    <form action={completeInvoice}>
                      <input type="hidden" name="invoiceId" value={invoice.id} />
                      <button className="focus-ring border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
                        Complete
                      </button>
                    </form>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
          {invoices.length === 0 ? (
            <tr>
              <td className="px-3 py-8 text-center text-[var(--muted)]" colSpan={9}>
                No invoices match the current view.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function ApWorkQueue({ data }: { data: AppData }) {
  const queue = data.invoices.filter((invoice) =>
    ["Needs AP Review", "Needs AP Rework", "Routed"].includes(invoice.status),
  );

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
                  className={`inline-flex border px-2 py-1 text-xs font-semibold ${statusClass(invoice.status)}`}
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

function AuditLog({ data }: { data: AppData }) {
  return (
    <section className="border border-[var(--line)] bg-[var(--panel)]">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <h2 className="font-semibold">Recent Audit Events</h2>
      </div>
      <div className="divide-y divide-[var(--line)]">
        {data.auditEvents.slice(0, 8).map((event) => (
          <div className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[180px_140px_1fr]" key={event.id}>
            <span className="text-[var(--muted)]">{formatDateTime(event.createdAt)}</span>
            <span className="font-mono text-xs uppercase text-[var(--muted)]">{event.type}</span>
            <span>{event.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function Home({ searchParams }: PageProps) {
  const user = await requireApUser();
  const params = (await searchParams) || {};
  const filters = {
    status: one(params.status),
    department: one(params.department),
    search: one(params.search),
  };
  const data = await readData();
  const invoices = filterInvoices(data.invoices, data, filters);
  const needsAp = data.invoices.filter((invoice) =>
    ["Needs AP Review", "Needs AP Rework"].includes(invoice.status),
  ).length;
  const routed = data.invoices.filter((invoice) => invoice.status === "Routed").length;
  const done = data.invoices.filter(
    (invoice) => invoice.status === "Approved/Completed",
  ).length;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-[var(--accent)]">
              AP Division
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
              Invoice Management
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Upload invoices, validate against PO data, route department review,
              and track every invoice through AP completion.
            </p>
          </div>
          <div className="border border-[var(--line)] bg-white px-4 py-3 text-sm">
            <div className="font-semibold">{user.name}</div>
            <div className="mt-1 text-[var(--muted)]">
              OCR/email use local mock behavior until Azure and SMTP variables are set.
            </div>
            <form action={signOut}>
              <button className="focus-ring mt-3 border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-slate-100">
                Sign Out
              </button>
            </form>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Total invoices" value={data.invoices.length} />
          <Metric label="Needs AP work" value={needsAp} />
          <Metric label="With departments" value={routed} />
          <Metric label="Completed" value={done} />
        </section>

        <UploadPanel />
        <FilterBar data={data} filters={filters} />
        <InvoiceTable data={data} invoices={invoices} />
        <ApWorkQueue data={data} />
        <AuditLog data={data} />
      </div>
    </main>
  );
}
