import type { AppData } from "./types";

type ProcessingMetricsOptions = {
  fromDate?: string;
  toDate?: string;
};

export function buildInvoiceProcessingMetrics(
  data: AppData,
  options: ProcessingMetricsOptions = {},
) {
  const fromDate = validDateOnly(options.fromDate);
  const toDate = validDateOnly(options.toDate);
  const dateFilterActive = Boolean(fromDate || toDate);
  const includedInvoiceIds = dateFilterActive
    ? new Set(
        data.invoices
          .filter((invoice) => {
            const date = invoiceProcessingDate(data, invoice.id);
            if (!date) return false;
            if (fromDate && date < fromDate) return false;
            if (toDate && date > toDate) return false;
            return true;
          })
          .map((invoice) => invoice.id),
      )
    : null;
  const invoices = includedInvoiceIds
    ? data.invoices.filter((invoice) => includedInvoiceIds.has(invoice.id))
    : data.invoices;
  const invoiceDocuments = includedInvoiceIds
    ? data.invoiceDocuments.filter(
        (document) => document.invoiceId && includedInvoiceIds.has(document.invoiceId),
      )
    : data.invoiceDocuments;
  const filteredDocumentIds = new Set(invoiceDocuments.map((document) => document.id));
  const invoiceValidationResults = includedInvoiceIds
    ? data.invoiceValidationResults.filter(
        (result) =>
          (result.invoiceId && includedInvoiceIds.has(result.invoiceId)) ||
          filteredDocumentIds.has(result.documentId),
      )
    : data.invoiceValidationResults;
  const invoiceFieldCandidates = includedInvoiceIds
    ? data.invoiceFieldCandidates.filter(
        (candidate) =>
          (candidate.invoiceId && includedInvoiceIds.has(candidate.invoiceId)) ||
          filteredDocumentIds.has(candidate.documentId),
      )
    : data.invoiceFieldCandidates;
  const auditEvents = includedInvoiceIds
    ? data.auditEvents.filter(
        (event) => event.invoiceId && includedInvoiceIds.has(event.invoiceId),
      )
    : data.auditEvents;

  const totalUploaded = invoiceDocuments.length || invoices.length;
  const routed = invoices.filter((invoice) => invoice.processingStatus === "routed").length;
  const review = invoices.filter(
    (invoice) => invoice.processingStatus === "ready_for_ap_review",
  ).length;
  const ocrFailures = invoiceValidationResults.filter(
    (result) => result.code === "ocr_failed",
  ).length;
  const vendorValidated = invoiceValidationResults.filter(
    (result) => result.code === "vendor_validated",
  ).length;
  const poMatched = invoiceValidationResults.filter(
    (result) => result.code === "po_matched",
  ).length;
  const duplicateDetected = invoiceValidationResults.filter(
    (result) => result.code === "duplicate_suspected",
  ).length;
  const mathFailures = invoiceValidationResults.filter(
    (result) => result.code === "total_math_mismatch",
  ).length;
  const correctedFields = auditEvents.filter(
    (event) =>
      event.type === "human_field_correction" ||
      event.type === "vendor_selected" ||
      event.type === "po_vendor_updated",
  ).length;
  const uploadedTimes = invoiceDocuments
    .map((document) => {
      const firstAudit = auditEvents
        .filter((event) => event.invoiceId === document.invoiceId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];
      const finalAudit = auditEvents
        .filter(
          (event) =>
            event.invoiceId === document.invoiceId &&
            ["invoice_routed", "invoice_sent_to_ap_review"].includes(event.type),
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
      if (!firstAudit || !finalAudit) return null;
      const elapsed = new Date(finalAudit.createdAt).getTime() - new Date(firstAudit.createdAt).getTime();
      return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
    })
    .filter((value): value is number => value !== null);

  return {
    totalUploaded,
    percentAutoRouted: percent(routed, totalUploaded),
    percentSentToApReview: percent(review, totalUploaded),
    ocrFailureRate: percent(ocrFailures, totalUploaded),
    fieldExtractionAccuracy: percent(
      invoiceFieldCandidates.filter((candidate) => candidate.validationStatus === "passed").length,
      invoiceFieldCandidates.length,
    ),
    humanCorrectionRate: percent(correctedFields, Math.max(invoiceFieldCandidates.length, 1)),
    vendorMatchRate: percent(vendorValidated, totalUploaded),
    poMatchRate: percent(poMatched, totalUploaded),
    duplicateDetectionRate: percent(duplicateDetected, totalUploaded),
    mathValidationFailureRate: percent(mathFailures, totalUploaded),
    averageProcessingTimeMs:
      uploadedTimes.length > 0
        ? Math.round(uploadedTimes.reduce((sum, item) => sum + item, 0) / uploadedTimes.length)
        : 0,
    topApReviewReasons: topCounts(
      invoices.flatMap((invoice) => invoice.apReviewReasonCodes || []),
    ),
    topVendorsByExceptionCount: topCounts(
      invoices
        .filter((invoice) => (invoice.apReviewReasonCodes || []).length > 0)
        .map((invoice) => invoice.vendorName || "Unknown Vendor"),
    ),
  };
}

export function invoiceProcessingDate(data: AppData, invoiceId: string) {
  const invoice = data.invoices.find((item) => item.id === invoiceId);
  if (!invoice) return "";

  const invoiceDateUploaded = validDateOnly(invoice.dateUploaded);
  if (invoiceDateUploaded) return invoiceDateUploaded;

  const document = data.invoiceDocuments.find(
    (item) => item.invoiceId === invoiceId || item.id === invoice.documentId,
  );
  const documentUploadedAt = validDateOnly(document?.uploadedAt);
  if (documentUploadedAt) return documentUploadedAt;

  const invoiceCreatedAt = validDateOnly(invoice.createdAt);
  if (invoiceCreatedAt) return invoiceCreatedAt;

  return validDateOnly(invoice.dateReceived) || "";
}

function validDateOnly(value: string | undefined) {
  const date = value?.slice(0, 10) || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10) === date ? date : "";
}

function percent(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function topCounts(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([label, count]) => ({ label, count }));
}
