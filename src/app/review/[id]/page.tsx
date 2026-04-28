import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import {
  submitDepartmentDecision,
  updateInvoicePaymentProcessed,
} from "@/lib/actions";
import { DEPARTMENT_DECISIONS } from "@/lib/constants";
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
                Department Invoice Review
              </h1>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Signed in as {user.name}. Review the invoice file, add comments, and
              send the decision back to AP.
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
                  {DEPARTMENT_DECISIONS.map((decision) => (
                    <option key={decision} value={decision}>
                      {decision}
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
