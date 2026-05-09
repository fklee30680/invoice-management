import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  clearInvoiceAttentionFlag,
  markInvoiceDuplicateReviewed,
  updateAndRouteInvoice,
  updateInvoicePaymentProcessed,
} from "@/lib/actions";
import { DepartmentDecisionForm } from "@/components/department-decision-form";
import { PoValidationField } from "@/components/po-validation-field";
import { VendorLookupField } from "@/components/vendor-lookup-field";
import { invoiceFieldEnabled } from "@/lib/invoice-fields";
import { canAccessInvoice, requireUser } from "@/lib/session";
import { statusBadgeClass } from "@/lib/status-config";
import { readData } from "@/lib/store";
import { vendorDropdownOptions } from "@/lib/vendor-validation";
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
  const user = await requireUser();
  const invoice = data.invoices.find((item) => item.id === id);
  if (!invoice) notFound();
  if (!canAccessInvoice(user, invoice)) redirect("/login");

  const department = data.departments.find((item) => item.id === invoice.departmentId);
  const poNumberEnabled = invoiceFieldEnabled(data, "poNumber");
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const selectedDecision = Array.isArray(query.decision) ? query.decision[0] : query.decision;
  const activeDecisions = data.departmentDecisions.filter((decision) => decision.active);
  const vendorOptions = vendorDropdownOptions(data);
  const duplicateMatches = (invoice.duplicateMatchedInvoiceIds || [])
    .map((matchId) => data.invoices.find((item) => item.id === matchId))
    .filter(Boolean) as typeof data.invoices;
  const processingDocument = invoice.documentId
    ? data.invoiceDocuments.find((item) => item.id === invoice.documentId)
    : undefined;
  const extraction = invoice.extractionId
    ? data.invoiceExtractions.find((item) => item.id === invoice.extractionId)
    : undefined;
  const fieldCandidates = data.invoiceFieldCandidates
    .filter((candidate) => candidate.invoiceId === invoice.id)
    .sort((left, right) => {
      const fieldCompare = left.fieldName.localeCompare(right.fieldName);
      if (fieldCompare !== 0) return fieldCompare;
      return Number(right.selected) - Number(left.selected);
    });
  const validationResults = data.invoiceValidationResults
    .filter((result) => result.invoiceId === invoice.id)
    .sort((left, right) => {
      const severityOrder = { blocking: 0, warning: 1, info: 2 };
      return severityOrder[left.severity] - severityOrder[right.severity];
    });
  const currentDecisionIsInactive =
    invoice.departmentDecision &&
    !activeDecisions.some((decision) => decision.label === invoice.departmentDecision);
  const decisionOptions = [
    ...activeDecisions,
    ...(currentDecisionIsInactive
      ? [
          {
            id: `inactive-${invoice.departmentDecision}`,
            label: invoice.departmentDecision,
            requirePoNumber: false,
          },
        ]
      : []),
  ].map((decision) => ({
    id: decision.id,
    label: decision.label,
    requirePoNumber: decision.requirePoNumber,
  }));
  const detailRows = [
    invoiceFieldEnabled(data, "vendorName")
      ? ["Vendor Name", invoice.vendorName || "Unknown Vendor"]
      : null,
    invoiceFieldEnabled(data, "vendorNumber")
      ? ["Vendor Number", invoice.vendorNumber || "Not selected"]
      : null,
    invoiceFieldEnabled(data, "vendorName")
      ? ["Vendor Validation", invoice.vendorValidationStatus || "Not Checked"]
      : null,
    invoiceFieldEnabled(data, "invoiceNumber")
      ? ["Invoice Number", invoice.invoiceNumber || "Not set"]
      : null,
    invoiceFieldEnabled(data, "invoiceDate")
      ? ["Invoice Date", formatDate(invoice.invoiceDate)]
      : null,
    invoiceFieldEnabled(data, "amount")
      ? ["Amount", currencyDisplay(invoice.amount)]
      : null,
    poNumberEnabled ? ["PO Number", invoice.poNumber || "Missing"] : null,
    invoiceFieldEnabled(data, "departmentId")
      ? ["Department", department?.name || "Unassigned"]
      : null,
    invoiceFieldEnabled(data, "dateReceived")
      ? ["Date Invoice Received", formatDate(invoice.dateReceived)]
      : null,
    invoiceFieldEnabled(data, "dateApproved")
      ? ["Date Approved", formatDate(invoice.dateApproved)]
      : null,
    invoiceFieldEnabled(data, "dateProcessedForPayment")
      ? [
          "Date Processed for Payment",
          invoice.dateProcessedForPayment
            ? formatDate(invoice.dateProcessedForPayment)
            : "Not processed",
        ]
      : null,
    invoiceFieldEnabled(data, "dateUploaded")
      ? ["Date Uploaded", formatDate(invoice.dateUploaded)]
      : null,
    invoiceFieldEnabled(data, "routedAt")
      ? ["Routed Date", formatDateTime(invoice.routedAt)]
      : null,
    invoiceFieldEnabled(data, "notificationSentAt")
      ? ["Notification Sent", formatDateTime(invoice.notificationSentAt)]
      : null,
    invoiceFieldEnabled(data, "status") ? ["Status Date", formatDate(invoice.statusDate)] : null,
    invoice.poValidationStatus && invoice.poValidationStatus !== "Not Checked"
      ? ["PO Validation", invoice.poValidationStatus]
      : null,
    ["Processed for Payment", invoice.paymentProcessed ? "Yes" : "No"],
  ].filter((row): row is [string, string] => Boolean(row));
  const systemRows = [
    invoiceFieldEnabled(data, "status") ? ["Current Status", invoice.status] : null,
    invoiceFieldEnabled(data, "departmentId")
      ? ["Current Department", department?.name || "Unassigned"]
      : null,
    invoiceFieldEnabled(data, "routedAt")
      ? ["Routed Date", formatDateTime(invoice.routedAt)]
      : null,
    invoiceFieldEnabled(data, "notificationSentAt")
      ? ["Notification Sent", formatDateTime(invoice.notificationSentAt)]
      : null,
    invoiceFieldEnabled(data, "dateProcessedForPayment")
      ? [
          "Date Processed for Payment",
          invoice.dateProcessedForPayment
            ? formatDate(invoice.dateProcessedForPayment)
            : "Not processed",
        ]
      : null,
    invoiceFieldEnabled(data, "status") ? ["Status Date", formatDate(invoice.statusDate)] : null,
    invoiceFieldEnabled(data, "vendorName")
      ? ["Vendor Validation", invoice.vendorValidationStatus || "Not Checked"]
      : null,
    invoiceFieldEnabled(data, "vendorNumber")
      ? ["Vendor Number", invoice.vendorNumber || "Not selected"]
      : null,
    invoice.poValidationStatus && invoice.poValidationStatus !== "Not Checked"
      ? ["PO Validation", invoice.poValidationStatus]
      : null,
  ].filter((row): row is [string, string] => Boolean(row));

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal">
              {user.role === "AP" ? "Invoice Review" : "Department Invoice Review"}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {user.role === "AP"
                ? `Signed in as ${user.name}. Update invoice information, routing, and payment status.`
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

        {error === "po-required" ? (
          <div className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            PO number is required for this decision. Please enter the PO number before submitting.
          </div>
        ) : null}
        {error === "po-not-found" ? (
          <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            PO number was not found in the PO list. This invoice cannot move
            forward until a valid PO number is entered.
          </div>
        ) : null}
        {error === "po-vendor-mismatch" ? (
          <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            Vendor mismatch must be resolved before this invoice can move forward.
          </div>
        ) : null}
        {error === "po-vendor-not-found" ? (
          <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            The PO vendor was not found in the vendor file. Select a vendor from
            the vendor file before this invoice can move forward.
          </div>
        ) : null}
        {error === "vendor-required" ? (
          <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            Select a valid vendor from the vendor file before routing this invoice.
          </div>
        ) : null}
        {error === "duplicate-review-required" ? (
          <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            Potential duplicate invoice must be reviewed before routing.
          </div>
        ) : null}
        {invoice.duplicateCheckStatus === "Potential Duplicate" ? (
          <section className="border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="font-semibold">Potential Duplicate</h2>
                <p className="mt-1">
                  Potential duplicate invoice found for this vendor and invoice number.
                </p>
              </div>
              {user.role === "AP" ? (
                <form
                  action={markInvoiceDuplicateReviewed}
                  className="flex flex-col gap-2 sm:min-w-80"
                >
                  <input name="invoiceId" type="hidden" value={invoice.id} />
                  <input
                    className="focus-ring min-h-10 border border-amber-300 bg-white px-3 text-sm text-[var(--foreground)]"
                    name="duplicateReviewNote"
                    placeholder="Review note, optional"
                  />
                  <button className="focus-ring border border-amber-600 bg-white px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100">
                    Mark Reviewed / Not a Duplicate
                  </button>
                </form>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3">
              {duplicateMatches.length > 0 ? (
                duplicateMatches.map((match) => {
                  const canOpenMatch = canAccessInvoice(user, match);
                  return (
                    <div className="border border-amber-200 bg-white p-3" key={match.id}>
                      <div className="font-semibold">
                        {match.vendorName || "Unknown Vendor"} -{" "}
                        {match.invoiceNumber || "No invoice number"}
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        Uploaded {formatDate(match.dateUploaded)} | Amount{" "}
                        {currencyDisplay(match.amount)} | Status {match.status}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {canOpenMatch ? (
                          <Link
                            className="focus-ring border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
                            href={`/review/${match.id}`}
                          >
                            Open Prior Invoice
                          </Link>
                        ) : null}
                        {canOpenMatch && match.fileId ? (
                          <Link
                            className="focus-ring border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
                            href={`/files/${match.fileId}`}
                          >
                            Download Prior Invoice
                          </Link>
                        ) : (
                          <span className="px-3 py-1.5 text-xs text-[var(--muted)]">
                            {canOpenMatch ? "No file available" : "Prior invoice restricted"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="border border-amber-200 bg-white p-3">
                  Matched invoice details are not available.
                </div>
              )}
            </div>
          </section>
        ) : null}
        {invoice.requiresApAttention ? (
          <div className="flex flex-col gap-3 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="font-semibold">AP Attention:</span>{" "}
              {invoice.apAttentionReason || "Review needed"}
            </div>
            {user.role === "AP" ? (
              <form action={clearInvoiceAttentionFlag}>
                <input name="invoiceId" type="hidden" value={invoice.id} />
                <button className="focus-ring border border-amber-500 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-100">
                  Clear AP Attention Flag
                </button>
              </form>
            ) : null}
          </div>
        ) : null}

        {user.role === "AP" && (processingDocument || extraction || fieldCandidates.length > 0) ? (
          <section className="border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold">Invoice Processing</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  OCR values are candidates. Routing is based on validation results and confidence.
                </p>
              </div>
              <span className="inline-flex self-start border border-[var(--line)] bg-white px-2 py-1 text-xs font-semibold">
                {invoice.processingStatus || processingDocument?.processingStatus || "Not checked"}
              </span>
            </div>

            <div className="mt-4 grid gap-px bg-[var(--line)] text-sm sm:grid-cols-4">
              <div className="bg-white p-3">
                <div className="text-xs font-semibold uppercase text-[var(--muted)]">Provider</div>
                <div className="mt-1 font-medium">{extraction?.provider || "Not set"}</div>
              </div>
              <div className="bg-white p-3">
                <div className="text-xs font-semibold uppercase text-[var(--muted)]">Document Confidence</div>
                <div className="mt-1 font-medium">
                  {extraction ? `${Math.round(extraction.documentConfidence * 100)}%` : "Not set"}
                </div>
              </div>
              <div className="bg-white p-3">
                <div className="text-xs font-semibold uppercase text-[var(--muted)]">Invoice Confidence</div>
                <div className="mt-1 font-medium">
                  {invoice.extractionConfidence !== undefined
                    ? `${Math.round(invoice.extractionConfidence * 100)}%`
                    : "Not set"}
                </div>
              </div>
              <div className="bg-white p-3">
                <div className="text-xs font-semibold uppercase text-[var(--muted)]">File Hash</div>
                <div className="mt-1 truncate font-mono text-xs">
                  {processingDocument?.fileHash || "Not set"}
                </div>
              </div>
            </div>

            {invoice.apReviewReasonCodes && invoice.apReviewReasonCodes.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {invoice.apReviewReasonCodes.map((reason) => (
                  <span
                    className="border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900"
                    key={reason}
                  >
                    {reason}
                  </span>
                ))}
              </div>
            ) : null}

            {validationResults.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
                    <tr>
                      <th className="px-3 py-2">Validation</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Severity</th>
                      <th className="px-3 py-2">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)] bg-white">
                    {validationResults.map((result) => (
                      <tr key={result.id}>
                        <td className="px-3 py-2 font-mono text-xs">{result.code}</td>
                        <td className="px-3 py-2">{result.status}</td>
                        <td className="px-3 py-2">{result.severity}</td>
                        <td className="px-3 py-2">{result.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {fieldCandidates.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
                    <tr>
                      <th className="px-3 py-2">Field</th>
                      <th className="px-3 py-2">Extracted</th>
                      <th className="px-3 py-2">Normalized</th>
                      <th className="px-3 py-2">Confidence</th>
                      <th className="px-3 py-2">Selected</th>
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2">Validation</th>
                      <th className="px-3 py-2">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)] bg-white">
                    {fieldCandidates.map((candidate) => (
                      <tr key={candidate.id}>
                        <td className="px-3 py-2 font-mono text-xs">{candidate.fieldName}</td>
                        <td className="px-3 py-2">{candidate.rawValue || "Not extracted"}</td>
                        <td className="px-3 py-2">{candidate.normalizedValue || "Not set"}</td>
                        <td className="px-3 py-2">{Math.round(candidate.confidence * 100)}%</td>
                        <td className="px-3 py-2">{candidate.selected ? "Yes" : "No"}</td>
                        <td className="px-3 py-2">{candidate.nearbyLabel || candidate.extractionSource}</td>
                        <td className="px-3 py-2">{candidate.validationStatus}</td>
                        <td className="px-3 py-2">
                          {candidate.validationMessage ||
                            (candidate.scoringReasons || []).join(" ") ||
                            "No scoring reason recorded."}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {extraction?.rawText ? (
              <details className="mt-4 border border-[var(--line)] bg-white p-3 text-sm">
                <summary className="cursor-pointer font-semibold">Raw OCR Text</summary>
                <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words text-xs text-[var(--muted)]">
                  {extraction.rawText}
                </pre>
              </details>
            ) : null}
          </section>
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
                  <h2 className="font-semibold">Invoice Information</h2>
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
                {invoiceFieldEnabled(data, "vendorName") ? (
                  <VendorLookupField
                    extractedVendor={invoice.vendorValidationStatus === "Validated" ? "" : invoice.vendorName}
                    listId={`vendor-options-${invoice.id}`}
                    options={vendorOptions}
                    selectedVendorNumber={invoice.vendorNumber}
                  />
                ) : null}
                {invoiceFieldEnabled(data, "vendorNumber") ? (
                  <div className={labelClass}>
                    Vendor Number
                    <div className="mt-1 min-h-10 border border-[var(--line)] bg-white px-3 py-2 text-sm font-normal normal-case text-[var(--foreground)]">
                      {invoice.vendorNumber || "Not selected"}
                    </div>
                  </div>
                ) : null}
                {invoiceFieldEnabled(data, "invoiceNumber") ? (
                  <label className={labelClass}>
                    Invoice Number
                    <input className={inputClass} name="invoiceNumber" defaultValue={invoice.invoiceNumber} />
                  </label>
                ) : null}
                {invoiceFieldEnabled(data, "invoiceDate") ? (
                  <label className={labelClass}>
                    Invoice Date
                    <input className={inputClass} name="invoiceDate" type="date" defaultValue={invoice.invoiceDate} />
                  </label>
                ) : null}
                {invoiceFieldEnabled(data, "amount") ? (
                  <label className={labelClass}>
                    Amount
                    <input className={inputClass} name="amount" defaultValue={invoice.amount} />
                  </label>
                ) : null}
              </fieldset>

              <fieldset className="mt-4 grid gap-3 sm:grid-cols-2">
                <legend className="mb-1 text-xs font-semibold uppercase text-[var(--muted)] sm:col-span-2">
                  Purchasing And Routing
                </legend>
                {poNumberEnabled ? (
                  <PoValidationField
                    defaultValue={invoice.poNumber}
                    invoiceId={invoice.id}
                  />
                ) : null}
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
                {invoiceFieldEnabled(data, "dateReceived") ? (
                  <label className={labelClass}>
                    Date Invoice Received
                    <input className={inputClass} name="dateReceived" type="date" defaultValue={invoice.dateReceived} />
                  </label>
                ) : null}
                {invoiceFieldEnabled(data, "dateUploaded") ? (
                  <label className={labelClass}>
                    Date Uploaded
                    <input className={inputClass} name="dateUploaded" type="date" defaultValue={invoice.dateUploaded} />
                  </label>
                ) : null}
              </fieldset>

              <div className="mt-4 grid gap-3 bg-white p-3 text-sm sm:grid-cols-2">
                {systemRows.map(([label, content]) => (
                  <div key={label}>
                    <div className="text-xs font-semibold uppercase text-[var(--muted)]">
                      {label}
                    </div>
                    <div className="mt-1 font-medium">{content}</div>
                  </div>
                ))}
              </div>

              {invoiceFieldEnabled(data, "ocrSummary") && invoice.ocrSummary ? (
                <div className="mt-4 border-t border-[var(--line)] pt-4 text-sm text-[var(--muted)]">
                  {invoice.ocrSummary}
                </div>
              ) : null}

              <div className="mt-4 flex justify-end">
                <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
                  Save
                </button>
              </div>
            </form>
          ) : (
            <div className="border border-[var(--line)] bg-[var(--panel)]">
              <div className="border-b border-[var(--line)] px-4 py-3">
                <h2 className="font-semibold">Invoice Information</h2>
              </div>
              <dl className="grid gap-px bg-[var(--line)] text-sm sm:grid-cols-2">
                {detailRows.map(([label, content]) => (
                  <div className="bg-white p-4" key={label}>
                    <dt className="text-xs font-semibold uppercase text-[var(--muted)]">
                      {label}
                    </dt>
                    <dd className="mt-1 font-medium">{content}</dd>
                  </div>
                ))}
              </dl>
              {invoiceFieldEnabled(data, "ocrSummary") ? (
                <div className="border-t border-[var(--line)] p-4 text-sm text-[var(--muted)]">
                  {invoice.ocrSummary}
                </div>
              ) : null}
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
                    <span className="block font-semibold">Processed for Payment</span>
                    <span className="text-[var(--muted)]">
                      Checked invoices are removed from the manual payment queue.
                    </span>
                  </span>
                </label>
                <button className="focus-ring mt-4 w-full border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-teal-50">
                  Save Payment Processing Status
                </button>
              </form>
            ) : null}

            {user.role === "DEPARTMENT" ? (
              <DepartmentDecisionForm
                currentDecision={invoice.departmentDecision}
                decisionOptions={decisionOptions}
                hasPoNumber={Boolean(invoice.poNumber.trim())}
                initialDecision={selectedDecision || invoice.departmentDecision}
                invoiceId={invoice.id}
                poNumberEnabled={poNumberEnabled}
              />
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
