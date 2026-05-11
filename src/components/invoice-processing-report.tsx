import Link from "next/link";
import type {
  Invoice,
  InvoiceDocument,
  InvoiceExtraction,
  InvoiceFieldCandidate,
  InvoiceFile,
  InvoiceValidationResult,
} from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type ProcessingReportProps = {
  invoice: Invoice;
  processingDocument?: InvoiceDocument;
  extraction?: InvoiceExtraction;
  fieldCandidates: InvoiceFieldCandidate[];
  validationResults: InvoiceValidationResult[];
  invoiceFile?: InvoiceFile;
};

type CompactSummaryProps = ProcessingReportProps & {
  reportHref: string;
};

function providerLabel(provider?: string) {
  switch (provider) {
    case "azure_document_intelligence":
      return "Azure Document Intelligence";
    case "embedded_pdf_text":
      return "Embedded PDF text";
    case "filename_fallback":
      return "Filename fallback";
    default:
      return "Not checked";
  }
}

function percent(value: number | undefined) {
  if (typeof value !== "number") return "Not set";
  return `${Math.round(value * 100)}%`;
}

export function invoiceProcessingWarningCount(results: InvoiceValidationResult[]) {
  return results.filter((result) => result.status !== "passed" || result.severity !== "info").length;
}

function hasProcessingReport({
  invoice,
  processingDocument,
  extraction,
  fieldCandidates,
  validationResults,
}: ProcessingReportProps) {
  return Boolean(
    processingDocument ||
      extraction ||
      fieldCandidates.length > 0 ||
      validationResults.length > 0 ||
      (invoice.apReviewReasonCodes && invoice.apReviewReasonCodes.length > 0),
  );
}

export function InvoiceProcessingCompactSummary({
  invoice,
  processingDocument,
  extraction,
  fieldCandidates,
  validationResults,
  reportHref,
}: CompactSummaryProps) {
  if (
    !hasProcessingReport({
      invoice,
      processingDocument,
      extraction,
      fieldCandidates,
      validationResults,
    })
  ) {
    return null;
  }

  const warningCount = invoiceProcessingWarningCount(validationResults);
  const hasIssue =
    warningCount > 0 ||
    invoice.requiresApAttention ||
    extraction?.provider === "filename_fallback";
  const status = invoice.processingStatus || processingDocument?.processingStatus || "Not checked";

  return (
    <section
      className={`border p-4 ${
        hasIssue
          ? "border-amber-300 bg-amber-50 text-amber-950"
          : "border-[var(--line)] bg-[var(--panel)] text-[var(--foreground)]"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">Invoice Processing</h2>
          <p className="mt-1 text-sm">
            {providerLabel(extraction?.provider)} - Invoice confidence{" "}
            {percent(invoice.extractionConfidence ?? extraction?.invoiceConfidence)} - OCR confidence{" "}
            {percent(extraction?.ocrConfidence)} - {warningCount} warnings
          </p>
          <p className="mt-1 text-xs">
            Status: {status} - Candidate fields: {fieldCandidates.length}
          </p>
          {extraction?.provider === "filename_fallback" ? (
            <p className="mt-1 text-xs font-semibold">Fallback extraction used.</p>
          ) : null}
        </div>
        <Link
          className="focus-ring inline-flex shrink-0 justify-center border border-[var(--accent)] bg-white px-3 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-teal-50"
          href={reportHref}
          rel="noreferrer"
          target="_blank"
        >
          View OCR Report
        </Link>
      </div>
    </section>
  );
}

export function InvoiceProcessingReport({
  invoice,
  processingDocument,
  extraction,
  fieldCandidates,
  validationResults,
  invoiceFile,
}: ProcessingReportProps) {
  if (
    !hasProcessingReport({
      invoice,
      processingDocument,
      extraction,
      fieldCandidates,
      validationResults,
    })
  ) {
    return (
      <section className="border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--muted)]">
        No OCR report is available for this invoice.
      </section>
    );
  }

  const fileHash = processingDocument?.fileHash || invoiceFile?.fileHash || "";

  return (
    <div className="space-y-5">
      <section className="border border-[var(--line)] bg-[var(--panel)] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold">Processing Summary</h2>
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
            <div className="mt-1 font-medium">{providerLabel(extraction?.provider)}</div>
          </div>
          <div className="bg-white p-3">
            <div className="text-xs font-semibold uppercase text-[var(--muted)]">Provider Model</div>
            <div className="mt-1 font-medium">{extraction?.providerModel || "Not set"}</div>
          </div>
          <div className="bg-white p-3">
            <div className="text-xs font-semibold uppercase text-[var(--muted)]">Document Type</div>
            <div className="mt-1 font-medium">{extraction?.documentType || "Not set"}</div>
          </div>
          <div className="bg-white p-3">
            <div className="text-xs font-semibold uppercase text-[var(--muted)]">Document Confidence</div>
            <div className="mt-1 font-medium">{percent(extraction?.documentConfidence)}</div>
          </div>
          <div className="bg-white p-3">
            <div className="text-xs font-semibold uppercase text-[var(--muted)]">OCR Confidence</div>
            <div className="mt-1 font-medium">{percent(extraction?.ocrConfidence)}</div>
          </div>
          <div className="bg-white p-3">
            <div className="text-xs font-semibold uppercase text-[var(--muted)]">Invoice Confidence</div>
            <div className="mt-1 font-medium">
              {percent(invoice.extractionConfidence ?? extraction?.invoiceConfidence)}
            </div>
          </div>
          <div className="bg-white p-3">
            <div className="text-xs font-semibold uppercase text-[var(--muted)]">File Hash</div>
            <div className="mt-1 truncate font-mono text-xs">{fileHash || "Not set"}</div>
          </div>
          <div className="bg-white p-3">
            <div className="text-xs font-semibold uppercase text-[var(--muted)]">Extraction Summary</div>
            <div className="mt-1 text-xs">{extraction?.extractionSummary || "Not set"}</div>
          </div>
        </div>
      </section>

      <section className="border border-[var(--line)] bg-[var(--panel)] p-4">
        <h2 className="font-semibold">AP Review Reason Codes</h2>
        {invoice.apReviewReasonCodes && invoice.apReviewReasonCodes.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {invoice.apReviewReasonCodes.map((reason) => (
              <span
                className="border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900"
                key={reason}
              >
                {reason}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">No AP review reason codes recorded.</p>
        )}
      </section>

      <section className="border border-[var(--line)] bg-[var(--panel)] p-4">
        <h2 className="font-semibold">Validation Results</h2>
        {validationResults.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2">Validation</th>
                  <th className="px-3 py-2">Field</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">Message</th>
                  <th className="px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] bg-white">
                {validationResults.map((result) => (
                  <tr key={result.id}>
                    <td className="px-3 py-2 font-mono text-xs">{result.code}</td>
                    <td className="px-3 py-2">{result.fieldName || "Invoice"}</td>
                    <td className="px-3 py-2">{result.status}</td>
                    <td className="px-3 py-2">{result.severity}</td>
                    <td className="px-3 py-2">{result.message}</td>
                    <td className="px-3 py-2">{formatDateTime(result.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">No validation results recorded.</p>
        )}
      </section>

      <section className="border border-[var(--line)] bg-[var(--panel)] p-4">
        <h2 className="font-semibold">Field Candidates</h2>
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
                  <th className="px-3 py-2">Source / Label</th>
                  <th className="px-3 py-2">Validation</th>
                  <th className="px-3 py-2">Message / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)] bg-white">
                {fieldCandidates.map((candidate) => (
                  <tr key={candidate.id}>
                    <td className="px-3 py-2 font-mono text-xs">{candidate.fieldName}</td>
                    <td className="px-3 py-2">{candidate.rawValue || "Not extracted"}</td>
                    <td className="px-3 py-2">{candidate.normalizedValue || "Not set"}</td>
                    <td className="px-3 py-2">{percent(candidate.confidence)}</td>
                    <td className="px-3 py-2">{candidate.selected ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">
                      {candidate.nearbyLabel || candidate.extractionSource}
                    </td>
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
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">No field candidates recorded.</p>
        )}
      </section>

      <section className="border border-[var(--line)] bg-[var(--panel)] p-4">
        <details>
          <summary className="cursor-pointer font-semibold">Raw OCR Text</summary>
          {extraction?.rawText ? (
            <pre className="mt-4 max-h-[36rem] overflow-auto whitespace-pre-wrap break-words border border-[var(--line)] bg-white p-3 text-xs text-[var(--muted)]">
              {extraction.rawText}
            </pre>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">No raw OCR text recorded.</p>
          )}
        </details>
      </section>
    </div>
  );
}
