import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildInvoiceProcessingMetrics,
  invoiceProcessingDate,
} from "./processing-metrics";
import type {
  AppData,
  AuditEvent,
  Invoice,
  InvoiceDocument,
  InvoiceFieldCandidate,
  InvoiceValidationResult,
} from "./types";

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1",
    vendorName: "Northstar Supply",
    invoiceNumber: "INV-100",
    invoiceDate: "2026-01-10",
    amount: "100.00",
    poNumber: "PO-100",
    dateReceived: "2026-01-10",
    dateApproved: "",
    dateUploaded: "2026-01-15",
    dateSubmittedToDepartment: "",
    statusDate: "2026-01-15",
    routedAt: "",
    status: "Needs AP Review",
    departmentId: "dept-1",
    departmentDecision: "",
    paymentProcessed: false,
    dateProcessedForPayment: "",
    escalations: [],
    comments: [],
    fileId: "file-1",
    notificationSentAt: "",
    ocrSummary: "",
    processingStatus: "ready_for_ap_review",
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-01-15T12:00:00.000Z",
    ...overrides,
  };
}

function document(overrides: Partial<InvoiceDocument> = {}): InvoiceDocument {
  return {
    id: "document-1",
    invoiceId: "invoice-1",
    fileId: "file-1",
    originalFilename: "invoice.pdf",
    fileHash: "hash-1",
    mimeType: "application/pdf",
    sizeBytes: 100,
    storageProvider: "local",
    uploadedBy: "AP",
    uploadedAt: "2026-01-15T12:00:00.000Z",
    processingStatus: "ready_for_ap_review",
    ...overrides,
  };
}

function validationResult(
  overrides: Partial<InvoiceValidationResult> = {},
): InvoiceValidationResult {
  return {
    id: "validation-1",
    invoiceId: "invoice-1",
    documentId: "document-1",
    code: "vendor_validated",
    fieldName: "vendorName",
    message: "Vendor validated.",
    severity: "info",
    status: "passed",
    createdAt: "2026-01-15T12:00:00.000Z",
    ...overrides,
  };
}

function candidate(
  overrides: Partial<InvoiceFieldCandidate> = {},
): InvoiceFieldCandidate {
  return {
    id: "candidate-1",
    invoiceId: "invoice-1",
    documentId: "document-1",
    extractionId: "extraction-1",
    fieldName: "vendorName",
    rawValue: "Northstar Supply",
    normalizedValue: "Northstar Supply",
    extractionSource: "embedded_pdf_text",
    confidence: 0.95,
    selected: true,
    validationStatus: "passed",
    ...overrides,
  };
}

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "audit-1",
    invoiceId: "invoice-1",
    actor: "AP",
    type: "human_field_correction",
    message: "Corrected a field.",
    createdAt: "2026-01-15T12:00:00.000Z",
    ...overrides,
  };
}

function data(overrides: Partial<AppData> = {}): AppData {
  return {
    departments: [],
    users: [],
    purchaseOrders: [],
    vendors: [],
    invoices: [],
    invoiceFiles: [],
    invoiceDocuments: [],
    invoiceExtractions: [],
    invoiceFieldCandidates: [],
    invoiceValidationResults: [],
    auditEvents: [],
    auditLogSettings: {} as AppData["auditLogSettings"],
    notificationTemplate: {} as AppData["notificationTemplate"],
    escalationSchedules: [],
    escalationTemplates: [],
    escalationScheduler: {} as AppData["escalationScheduler"],
    holidays: [],
    organizationEscalationContacts: [],
    escalationRunSummaries: [],
    paymentFile: {} as AppData["paymentFile"],
    branding: {} as AppData["branding"],
    statuses: [],
    invoiceFields: [],
    dashboardBoxes: [],
    menuSettings: {} as AppData["menuSettings"],
    poValidationSettings: {} as AppData["poValidationSettings"],
    poImportSettings: {} as AppData["poImportSettings"],
    vendorImportSettings: {} as AppData["vendorImportSettings"],
    departmentImportSettings: {} as AppData["departmentImportSettings"],
    departmentDecisions: [],
    escalationContacts: [],
    ...overrides,
  };
}

describe("invoice processing metrics date filters", () => {
  it("returns all-data totals when no processing date filter is provided", () => {
    const appData = data({
      invoices: [invoice(), invoice({ id: "invoice-2", fileId: "file-2" })],
      invoiceDocuments: [
        document(),
        document({ id: "document-2", invoiceId: "invoice-2", fileId: "file-2" }),
      ],
    });

    const metrics = buildInvoiceProcessingMetrics(appData);

    assert.equal(metrics.totalUploaded, 2);
  });

  it("filters inclusively by processing from and to dates", () => {
    const appData = data({
      invoices: [
        invoice({ id: "before", dateUploaded: "2026-01-01", fileId: "file-before" }),
        invoice({ id: "start", dateUploaded: "2026-01-10", fileId: "file-start" }),
        invoice({ id: "end", dateUploaded: "2026-01-20", fileId: "file-end" }),
        invoice({ id: "after", dateUploaded: "2026-01-25", fileId: "file-after" }),
      ],
      invoiceDocuments: [
        document({ id: "doc-before", invoiceId: "before", fileId: "file-before" }),
        document({ id: "doc-start", invoiceId: "start", fileId: "file-start" }),
        document({ id: "doc-end", invoiceId: "end", fileId: "file-end" }),
        document({ id: "doc-after", invoiceId: "after", fileId: "file-after" }),
      ],
    });

    const metrics = buildInvoiceProcessingMetrics(appData, {
      fromDate: "2026-01-10",
      toDate: "2026-01-20",
    });

    assert.equal(metrics.totalUploaded, 2);
  });

  it("uses upload date before invoice date", () => {
    const appData = data({
      invoices: [
        invoice({
          dateUploaded: "2026-02-01",
          invoiceDate: "2026-01-01",
        }),
      ],
      invoiceDocuments: [document()],
    });

    const metrics = buildInvoiceProcessingMetrics(appData, {
      fromDate: "2026-02-01",
      toDate: "2026-02-01",
    });

    assert.equal(metrics.totalUploaded, 1);
  });

  it("falls back to document upload date and then invoice created date", () => {
    const appData = data({
      invoices: [
        invoice({
          id: "document-date",
          dateUploaded: "",
          documentId: "document-date",
          fileId: "file-document-date",
          createdAt: "2026-02-05T12:00:00.000Z",
        }),
        invoice({
          id: "created-date",
          dateUploaded: "",
          documentId: "missing-document",
          fileId: "file-created-date",
          createdAt: "2026-02-06T12:00:00.000Z",
        }),
      ],
      invoiceDocuments: [
        document({
          id: "document-date",
          invoiceId: "document-date",
          fileId: "file-document-date",
          uploadedAt: "2026-02-04T12:00:00.000Z",
        }),
      ],
    });

    assert.equal(invoiceProcessingDate(appData, "document-date"), "2026-02-04");
    assert.equal(invoiceProcessingDate(appData, "created-date"), "2026-02-06");
  });

  it("filters validation results, field candidates, and audit events by matching invoices", () => {
    const appData = data({
      invoices: [
        invoice({ id: "included", dateUploaded: "2026-03-10", fileId: "file-included" }),
        invoice({ id: "excluded", dateUploaded: "2026-04-10", fileId: "file-excluded" }),
      ],
      invoiceDocuments: [
        document({ id: "doc-included", invoiceId: "included", fileId: "file-included" }),
        document({ id: "doc-excluded", invoiceId: "excluded", fileId: "file-excluded" }),
      ],
      invoiceValidationResults: [
        validationResult({
          id: "included-validation",
          invoiceId: "included",
          documentId: "doc-included",
          code: "vendor_validated",
        }),
        validationResult({
          id: "excluded-validation",
          invoiceId: "excluded",
          documentId: "doc-excluded",
          code: "vendor_validated",
        }),
      ],
      invoiceFieldCandidates: [
        candidate({
          id: "included-candidate",
          invoiceId: "included",
          documentId: "doc-included",
        }),
        candidate({
          id: "excluded-candidate",
          invoiceId: "excluded",
          documentId: "doc-excluded",
        }),
      ],
      auditEvents: [
        event({ id: "included-event", invoiceId: "included" }),
        event({ id: "excluded-event", invoiceId: "excluded" }),
        event({ id: "unrelated-event", invoiceId: undefined }),
      ],
    });

    const metrics = buildInvoiceProcessingMetrics(appData, {
      fromDate: "2026-03-01",
      toDate: "2026-03-31",
    });

    assert.equal(metrics.totalUploaded, 1);
    assert.equal(metrics.vendorMatchRate, 100);
    assert.equal(metrics.fieldExtractionAccuracy, 100);
    assert.equal(metrics.humanCorrectionRate, 100);
  });
});
