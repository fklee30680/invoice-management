import type { AppData } from "./types";

export function buildInvoiceProcessingMetrics(data: AppData) {
  const totalUploaded = data.invoiceDocuments.length || data.invoices.length;
  const routed = data.invoices.filter((invoice) => invoice.processingStatus === "routed").length;
  const review = data.invoices.filter(
    (invoice) => invoice.processingStatus === "ready_for_ap_review",
  ).length;
  const ocrFailures = data.invoiceValidationResults.filter(
    (result) => result.code === "ocr_failed",
  ).length;
  const vendorValidated = data.invoiceValidationResults.filter(
    (result) => result.code === "vendor_validated",
  ).length;
  const poMatched = data.invoiceValidationResults.filter(
    (result) => result.code === "po_matched",
  ).length;
  const duplicateDetected = data.invoiceValidationResults.filter(
    (result) => result.code === "duplicate_suspected",
  ).length;
  const mathFailures = data.invoiceValidationResults.filter(
    (result) => result.code === "total_math_mismatch",
  ).length;
  const correctedFields = data.auditEvents.filter(
    (event) =>
      event.type === "human_field_correction" ||
      event.type === "vendor_selected" ||
      event.type === "po_vendor_updated",
  ).length;
  const uploadedTimes = data.invoiceDocuments
    .map((document) => {
      const firstAudit = data.auditEvents
        .filter((event) => event.invoiceId === document.invoiceId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];
      const finalAudit = data.auditEvents
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
      data.invoiceFieldCandidates.filter((candidate) => candidate.validationStatus === "passed").length,
      data.invoiceFieldCandidates.length,
    ),
    humanCorrectionRate: percent(correctedFields, Math.max(data.invoiceFieldCandidates.length, 1)),
    vendorMatchRate: percent(vendorValidated, totalUploaded),
    poMatchRate: percent(poMatched, totalUploaded),
    duplicateDetectionRate: percent(duplicateDetected, totalUploaded),
    mathValidationFailureRate: percent(mathFailures, totalUploaded),
    averageProcessingTimeMs:
      uploadedTimes.length > 0
        ? Math.round(uploadedTimes.reduce((sum, item) => sum + item, 0) / uploadedTimes.length)
        : 0,
    topApReviewReasons: topCounts(
      data.invoices.flatMap((invoice) => invoice.apReviewReasonCodes || []),
    ),
    topVendorsByExceptionCount: topCounts(
      data.invoices
        .filter((invoice) => (invoice.apReviewReasonCodes || []).length > 0)
        .map((invoice) => invoice.vendorName || "Unknown Vendor"),
    ),
  };
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
