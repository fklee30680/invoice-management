import Link from "next/link";
import Image from "next/image";
import { signOut } from "@/lib/auth-actions";
import { requireUser } from "@/lib/session";
import { statusBadgeClass, statusesForDepartmentWork } from "@/lib/status-config";
import { readData } from "@/lib/store";
import type { AppData, Invoice } from "@/lib/types";
import { currencyDisplay, formatDate } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function departmentName(data: AppData, id: string) {
  return data.departments.find((department) => department.id === id)?.name || "Unassigned";
}

function InvoiceList({
  title,
  description,
  invoices,
  data,
}: {
  title: string;
  description: string;
  invoices: Invoice[];
  data: AppData;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-[var(--muted)]">{description}</p>
        </div>
        <span className="text-sm text-[var(--muted)]">{invoices.length} invoices</span>
      </div>

      <div className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="border-b border-[var(--line)] px-3 py-3">Status</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Vendor</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Invoice</th>
              <th className="border-b border-[var(--line)] px-3 py-3">PO</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Amount</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Department</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Decision</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr className="align-top hover:bg-slate-50" key={invoice.id}>
                <td className="border-b border-[var(--line)] px-3 py-3">
                  <span
                    className={`inline-flex border px-2 py-1 text-xs font-semibold ${statusBadgeClass(data, invoice.status)}`}
                  >
                    {invoice.status}
                  </span>
                </td>
                <td className="border-b border-[var(--line)] px-3 py-3 font-medium">
                  {invoice.vendorName || "Unknown Vendor"}
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
                  </div>
                </td>
              </tr>
            ))}
            {invoices.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-[var(--muted)]" colSpan={8}>
                  No invoices in this section.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function DepartmentDashboard() {
  const user = await requireUser();
  if (user.role === "AP") {
    return (
      <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl border border-[var(--line)] bg-white p-6">
          <h1 className="text-2xl font-semibold">AP Dashboard</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            AP users manage all invoices from the main dashboard.
          </p>
          <Link
            className="focus-ring mt-4 inline-flex bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
            href="/"
          >
            Open AP Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const data = await readData();
  const branding = data.branding;
  const department = data.departments.find(
    (item) => item.id === user.departmentId,
  );
  const invoices = data.invoices.filter(
    (invoice) => user.departmentId && invoice.departmentId === user.departmentId,
  );
  const departmentWorkStatuses = statusesForDepartmentWork(data);
  const needsWork = invoices.filter((invoice) =>
    departmentWorkStatuses.includes(invoice.status),
  );
  const otherInvoices = invoices.filter(
    (invoice) => !departmentWorkStatuses.includes(invoice.status),
  );

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
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
                  Department Review
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-normal">
                  {department?.name || "Department"} Invoices
                </h1>
              </div>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Signed in as {user.name}. This view only includes invoices assigned
              to your department.
            </p>
          </div>
          <form action={signOut} className="border border-[var(--line)] bg-white p-4">
            <div className="text-sm font-semibold">{user.email}</div>
            <button className="focus-ring mt-3 border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-slate-100">
              Sign Out
            </button>
          </form>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="text-sm text-[var(--muted)]">Needs work</div>
            <div className="mt-2 text-2xl font-semibold">{needsWork.length}</div>
          </div>
          <div className="border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="text-sm text-[var(--muted)]">Other invoices</div>
            <div className="mt-2 text-2xl font-semibold">{otherInvoices.length}</div>
          </div>
          <div className="border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="text-sm text-[var(--muted)]">Total assigned</div>
            <div className="mt-2 text-2xl font-semibold">{invoices.length}</div>
          </div>
        </section>

        <InvoiceList
          data={data}
          description="Invoices currently waiting for your department decision."
          invoices={needsWork}
          title="Needs Department Work"
        />
        <InvoiceList
          data={data}
          description="Invoices assigned to your department that have already been decided, rejected, held, completed, or returned to AP."
          invoices={otherInvoices}
          title="Other Department Invoices"
        />
      </div>
    </main>
  );
}
