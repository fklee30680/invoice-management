import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import {
  submitDepartmentDecision,
  updateAndRouteInvoice,
  updateInvoicePaymentProcessed,
} from "@/lib/actions";
import { canAccessInvoice, requireUser } from "@/lib/session";
import { statusBadgeClass } from "@/lib/status-config";
import { readData } from "@/lib/store";
import { currencyDisplay, formatDate, formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReviewPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const inputClass =
  "focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]";
const labelClass = "text-xs font-semibold uppercase text-[var(--muted)]";

export default async function ReviewPage({
  params,
  searchParams,
}: ReviewPageProps) {
  const { id } = await params;
  const query = (await searchParams) || {};
  const data = await readData();
  const branding = data.branding;
  const user = await requireUser();
  const invoice = data.invoices.find((item) => item.id === id);
  if (!invoice) notFound();
  if (!canAccessInvoice(user, invoice)) redirect("/login");

  const department = data.departments.find((item) => item.id === invoice.departmentId);
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const activeDecisions = data.departmentDecisions.filter((decision) => decision.active);
  const currentDecisionIsInactive =
    invoice.departmentDecision &&
    !activeDecisions.some((decision) => decision.label === invoice.departmentDecision);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              {branding.logo ? (
                <Image
                  alt={`${branding.appTitle} logo`}
                  className="max-h-12 max-w-40 object-contain"
                  height={48}
                  src="/branding/logo"
                  unoptimized
                  width={160}
                />
              ) : null}
              <h1 className="text-3xl font-semibold tracking-normal">
                {user.role === "AP" ? "Invoice Review" : "Department Invoice Review"}
              </h1>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {user.role === "AP"
                ? `Signed in as ${user.name}. Update metadata, routing, and payment status.`
                : `Signed in as ${user.name}. Review the invoice file, add comments, and send the decision back to AP.`}
            </p>
          </div>
          <span
            className={`inline-flex self-start border px-3 py-2 text-sm font-semibold sm:self-auto ${statusBadgeClass(data, invoice.status)}`}
          >
            {invoice.status}
          </span>
        </header>

        {error === "comment-required" ? (
          <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            A comment is required when sending the invoice back as not your department.
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
          {user.role === "AP" ? (
            <form
              action={updateAndRouteInvoice}
              className="border border-[var(--line)] bg-[var(--panel)] p-4"
            >
              <input name="invoiceId" type="hidden" value={invoice.id} />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">AP Metadata</h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Update invoice details and department routing from this review screen.
                  </p>
                </div>
                <span
                  className={`inline-flex border px-2 py-1 text-xs font-semibold ${statusBadgeClass(data, invoice.status)}`}
                >
                  {invoice.status}
                </span>
              </div>

              <fieldset className="mt-4 grid gap-3 sm:grid-cols-2">
                <legend className="mb-1 text-xs font-semibold uppercase text-[var(--muted)] sm:col-span-2">
                  Vendor And Invoice
                </legend>
                <label className={labelClass}>
                  Vendor Name
                  <input className={inputClass} name="vendorName" defaultValue={invoice.vendorName} />
                </label>
                <label className={labelClass}>
                  Invoice Number
                  <input className={inputClass} name="invoiceNumber" defaultValue={invoice.invoiceNumber} />
                </label>
                <label className={labelClass}>
                  Invoice Date
                  <input className={inputClass} name="invoiceDate" type="date" defaultValue={invoice.invoiceDate} />
                </label>
                <label className={labelClass}>
                  Amount
                  <input className={inputClass} name="amount" defaultValue={invoice.amount} />
                </label>
              </fieldset>

              <fieldset className="mt-4 grid gap-3 sm:grid-cols-2">
                <legend className="mb-1 text-xs font-semibold uppercase text-[var(--muted)] sm:col-span-2">
                  Purchasing And Routing
                </legend>
                <label className={labelClass}>
                  PO Number
                  <input className={inputClass} name="poNumber" defaultValue={invoice.poNumber} />
                </label>
                <label className={labelClass}>
                  Department
                  <select
                    className={inputClass}
                    name="departmentId"
                    defaultValue={invoice.departmentId}
                  >
                    <option value="">Unassigned</option>
                    {data.departments.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Date Received
                  <input className={inputClass} name="dateReceived" type="date" defaultValue={invoice.dateReceived} />
                </label>
                <label className={labelClass}>
                  Date Uploaded
                  <input className={inputClass} name="dateUploaded" type="date" defaultValue={invoice.dateUploaded} />
                </label>
              </fieldset>

              <div className="mt-4 grid gap-3 bg-white p-3 text-sm sm:grid-cols-2">
                {[
                  ["Current Status", invoice.status],
                  ["Current Department", department?.name || "Unassigned"],
                  ["Routed Date", formatDateTime(invoice.routedAt)],
                  ["Notification Sent", formatDateTime(invoice.notificationSentAt)],
                  ["Status Date", formatDate(invoice.statusDate)],
                  ["Vendor Record", invoice.vendorValidationStatus || "Not Checked"],
                ].map(([label, content]) => (
                  <div key={label}>
                    <div className="text-xs font-semibold uppercase text-[var(--muted)]">
                      {label}
                    </div>
                    <div className="mt-1 font-medium">{content}</div>
                  </div>
                ))}
              </div>

              {invoice.ocrSummary ? (
                <div className="mt-4 border-t border-[var(--line)] pt-4 text-sm text-[var(--muted)]">
                  {invoice.ocrSummary}
                </div>
              ) : null}

              <div className="mt-4 flex justify-end">
                <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
                  Save Metadata
                </button>
              </div>
            </form>
          ) : (
            <div className="border border-[var(--line)] bg-[var(--panel)]">
              <div className="border-b border-[var(--line)] px-4 py-3">
                <h2 className="font-semibold">Invoice Metadata</h2>
              </div>
              <dl className="grid gap-px bg-[var(--line)] text-sm sm:grid-cols-2">
                {[
                  ["Vendor Name", invoice.vendorName || "Unknown Vendor"],
                  ["Vendor Record", invoice.vendorValidationStatus || "Not Checked"],
                  ["Invoice Number", invoice.invoiceNumber || "Not set"],
                  ["Invoice Date", formatDate(invoice.invoiceDate)],
                  ["Amount", currencyDisplay(invoice.amount)],
                  ["PO Number", invoice.poNumber || "Missing"],
                  ["Department", department?.name || "Unassigned"],
                  ["Date Received", formatDate(invoice.dateReceived)],
                  ["Date Approved", formatDate(invoice.dateApproved)],
                  ["Date Uploaded", formatDate(invoice.dateUploaded)],
                  [
                    "Date Submitted To Department",
                    formatDate(invoice.dateSubmittedToDepartment),
                  ],
                  ["Routed Date", formatDateTime(invoice.routedAt)],
                  ["Notification Sent", formatDateTime(invoice.notificationSentAt)],
                  ["Status Date", formatDate(invoice.statusDate)],
                  ["Payment Processed", invoice.paymentProcessed ? "Yes" : "No"],
                ].map(([label, content]) => (
                  <div className="bg-white p-4" key={label}>
                    <dt className="text-xs font-semibold uppercase text-[var(--muted)]">
                      {label}
                    </dt>
                    <dd className="mt-1 font-medium">{content}</dd>
                  </div>
                ))}
              </dl>
              <div className="border-t border-[var(--line)] p-4 text-sm text-[var(--muted)]">
                {invoice.ocrSummary}
              </div>
            </div>
          )}

          <aside className="space-y-4">
            <div className="border border-[var(--line)] bg-[var(--panel)] p-4">
              <h2 className="font-semibold">Invoice File</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Download the original file before submitting a decision.
              </p>
              <Link
                className="focus-ring mt-4 inline-flex w-full justify-center bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                href={`/files/${invoice.fileId}`}
              >
                Download Invoice
              </Link>
            </div>

            {user.role === "AP" ? (
              <form
                action={updateInvoicePaymentProcessed}
                className="border border-[var(--line)] bg-[var(--panel)] p-4"
              >
                <input name="invoiceId" type="hidden" value={invoice.id} />
                <h2 className="font-semibold">Payment Processing</h2>
                <label className="mt-4 flex items-start gap-3 text-sm">
                  <input
                    className="mt-1 h-4 w-4 accent-[var(--accent)]"
                    defaultChecked={invoice.paymentProcessed}
                    name="paymentProcessed"
                    type="checkbox"
                  />
                  <span>
                    <span className="block font-semibold">Payment processed</span>
                    <span className="text-[var(--muted)]">
                      Checked invoices are removed from the manual payment queue.
                    </span>
                  </span>
                </label>
                <button className="focus-ring mt-4 w-full border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-teal-50">
                  Save Payment Status
                </button>
              </form>
            ) : null}

            {user.role === "DEPARTMENT" ? (
              <form
                action={submitDepartmentDecision}
                className="border border-[var(--line)] bg-[var(--panel)] p-4"
              >
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <h2 className="font-semibold">Decision</h2>
                <label className="mt-4 block text-xs font-semibold uppercase text-[var(--muted)]">
                  Decision Type
                  <select
                    className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                    name="decision"
                    defaultValue={invoice.departmentDecision}
                    required
                  >
                    <option value="">Select decision</option>
                    {currentDecisionIsInactive ? (
                      <option value={invoice.departmentDecision}>
                        {invoice.departmentDecision}
                      </option>
                    ) : null}
                    {activeDecisions.map((decision) => (
                      <option key={decision.id} value={decision.label}>
                        {decision.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-4 block text-xs font-semibold uppercase text-[var(--muted)]">
                  Comments
                  <textarea
                    className="focus-ring mt-1 min-h-28 w-full resize-y border border-[var(--line)] bg-white p-3 text-sm font-normal normal-case text-[var(--foreground)]"
                    name="comment"
                    placeholder="Add context for AP. Required if this invoice is not your department."
                  />
                </label>
                <button className="focus-ring mt-4 w-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
                  Submit Decision
                </button>
              </form>
            ) : null}
          </aside>
        </section>

        <section className="border border-[var(--line)] bg-[var(--panel)]">
          <div className="border-b border-[var(--line)] px-4 py-3">
            <h2 className="font-semibold">Comments</h2>
          </div>
          <div className="divide-y divide-[var(--line)]">
            {invoice.comments.map((comment) => (
              <article className="px-4 py-3 text-sm" key={comment.id}>
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-semibold">{comment.author}</span>
                  <span className="text-[var(--muted)]">
                    {formatDateTime(comment.createdAt)}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap">{comment.body}</p>
              </article>
            ))}
            {invoice.comments.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                No department comments have been added yet.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
