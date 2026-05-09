import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultDepartmentDecisions } from "./constants";
import { normalizeInvoiceFields } from "./invoice-fields";
import { defaultMenuSettings } from "./menu-registry";
import {
  buildPaymentCsv,
  defaultPaymentFileSettings,
  invoiceEligibleForPaymentFile,
  PAYMENT_FILE_FIELD_OPTIONS,
} from "./payment-file";
import { defaultPoImportSettings } from "./po-parser";
import { defaultVendorImportSettings } from "./vendor-parser";
import { defaultDepartmentImportSettings } from "./department-parser";
import { defaultPoValidationSettings } from "./po-validation";
import { defaultStatuses, statusLabelForRole } from "./status-config";
import type { AppData, Invoice } from "./types";

function baseInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1",
    vendorName: "Vendor A",
    invoiceNumber: "INV-1",
    invoiceDate: "2026-04-01",
    amount: "100",
    poNumber: "PO-1",
    dateReceived: "2026-04-01",
    dateApproved: "",
    dateUploaded: "2026-04-01",
    dateSubmittedToDepartment: "",
    statusDate: "2026-04-01",
    routedAt: "",
    status: "Approved/Completed",
    departmentId: "dept-1",
    departmentDecision: "Receiving Record",
    paymentProcessed: false,
    dateProcessedForPayment: "",
    escalations: [],
    comments: [],
    fileId: "file-1",
    notificationSentAt: "",
    ocrSummary: "",
    createdAt: "2026-04-01T12:00:00.000Z",
    updatedAt: "2026-04-01T12:00:00.000Z",
    ...overrides,
  };
}

function baseData(): AppData {
  return {
    departments: [{ id: "dept-1", name: "Finance", email: "finance@example.com" }],
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
    notificationTemplate: {
      departmentSubject: "",
      departmentBody: "",
      escalationSubject: "",
      escalationBody: "",
    },
    escalationSchedules: [],
    escalationTemplates: [],
    escalationScheduler: {
      enabled: false,
      timeOfDay: "08:00",
      timezone: "America/New_York",
      daysOfWeek: [1, 2, 3, 4, 5],
      excludedWeekdays: [0, 6],
      excludeHolidays: true,
      countRoutedDateAsDayOne: false,
    },
    holidays: [],
    organizationEscalationContacts: [],
    escalationRunSummaries: [],
    paymentFile: defaultPaymentFileSettings(),
    branding: {
      appTitle: "Invoice Management",
      divisionLabel: "AP Division",
      fontFamily: "Arial",
      accentColor: "#0f766e",
      accentStrongColor: "#115e59",
      backgroundColor: "#ffffff",
      panelColor: "#ffffff",
      panelStrongColor: "#eef2f6",
      textColor: "#17202a",
      mutedColor: "#657386",
      lineColor: "#d8dee7",
      logo: null,
    },
    statuses: defaultStatuses(),
    invoiceFields: normalizeInvoiceFields(undefined),
    dashboardBoxes: [],
    menuSettings: defaultMenuSettings(),
    poValidationSettings: defaultPoValidationSettings(),
    poImportSettings: defaultPoImportSettings(),
    vendorImportSettings: defaultVendorImportSettings(),
    departmentImportSettings: defaultDepartmentImportSettings(),
    departmentDecisions: defaultDepartmentDecisions(),
    escalationContacts: [],
  };
}

describe("invoiceEligibleForPaymentFile", () => {
  it("requires eligible status, eligible decision, and unprocessed payment flag", () => {
    assert.equal(invoiceEligibleForPaymentFile(baseInvoice(), baseData()), true);
  });

  it("rejects invoices with a status not included in payment file", () => {
    assert.equal(
      invoiceEligibleForPaymentFile(baseInvoice({ status: "Routed" }), baseData()),
      false,
    );
  });

  it("rejects invoices with a decision not included in payment file", () => {
    assert.equal(
      invoiceEligibleForPaymentFile(baseInvoice({ departmentDecision: "Hold" }), baseData()),
      false,
    );
  });

  it("rejects processed invoices and inactive decision types", () => {
    const data = baseData();
    data.departmentDecisions[0].active = false;
    assert.equal(invoiceEligibleForPaymentFile(baseInvoice(), data), false);
    assert.equal(
      invoiceEligibleForPaymentFile(baseInvoice({ paymentProcessed: true }), baseData()),
      false,
    );
  });

  it("rejects unresolved potential duplicates", () => {
    assert.equal(
      invoiceEligibleForPaymentFile(
        baseInvoice({ duplicateCheckStatus: "Potential Duplicate" }),
        baseData(),
      ),
      false,
    );
    assert.equal(
      invoiceEligibleForPaymentFile(
        baseInvoice({ duplicateCheckStatus: "Reviewed Not Duplicate" }),
        baseData(),
      ),
      true,
    );
  });
});

describe("processed for payment configuration", () => {
  it("adds a protected processed-for-payment status role", () => {
    const data = baseData();
    assert.equal(
      statusLabelForRole(data, "processedForPayment"),
      "Processed for Payment",
    );
    const status = data.statuses.find(
      (item) => item.systemRole === "processedForPayment",
    );
    assert.equal(status?.includeInPaymentFile, false);
    assert.equal(status?.includeInEscalation, false);
  });

  it("exports Date Processed for Payment when configured", () => {
    const data = baseData();
    data.paymentFile.columns = [
      {
        id: "processed-date",
        header: "Date Processed for Payment",
        source: "dateProcessedForPayment",
        included: true,
      },
    ];

    const csv = buildPaymentCsv(
      data,
      [baseInvoice({ dateProcessedForPayment: "2026-04-30" })],
    );

    assert.equal(csv, '"Date Processed for Payment"\r\n"Apr 30, 2026"');
  });
});

describe("expanded payment file export fields", () => {
  it("includes validation, workflow, attention, and file metadata options", () => {
    const labels = new Set(PAYMENT_FILE_FIELD_OPTIONS.map((option) => option.label));

    for (const label of [
      "Status",
      "Routed Date",
      "Notification Sent Date",
      "OCR Summary",
      "Validation Summary",
      "AP Review Reason Codes",
      "Vendor Validation Status",
      "Vendor Validation Message",
      "PO Validation Status",
      "PO Validation Message",
      "PO Vendor Name",
      "Duplicate Check Status",
      "Duplicate Check Message",
      "Duplicate Check Date",
      "Requires AP Attention",
      "AP Attention Reason",
      "Processing Status",
      "Extraction Confidence",
      "File Name",
      "File Hash",
    ]) {
      assert.equal(labels.has(label), true);
    }
  });

  it("exports newly available invoice metadata values", () => {
    const data = baseData();
    data.invoiceFiles = [
      {
        id: "file-1",
        invoiceId: "invoice-1",
        originalName: "invoice-100.pdf",
        storedName: "invoice-100.pdf",
        mimeType: "application/pdf",
        size: 1234,
        fileHash: "sha256-test",
        uploadedAt: "2026-04-01T12:00:00.000Z",
      },
    ];
    data.paymentFile.columns = [
      { id: "status", header: "Status", source: "status", included: true },
      { id: "routed", header: "Routed Date", source: "routedAt", included: true },
      {
        id: "notified",
        header: "Notification Sent Date",
        source: "notificationSentAt",
        included: true,
      },
      { id: "ocr", header: "OCR Summary", source: "ocrSummary", included: true },
      {
        id: "validation",
        header: "Validation Summary",
        source: "validationSummary",
        included: true,
      },
      {
        id: "review-codes",
        header: "AP Review Reason Codes",
        source: "apReviewReasonCodes",
        included: true,
      },
      {
        id: "vendor-status",
        header: "Vendor Validation Status",
        source: "vendorValidationStatus",
        included: true,
      },
      {
        id: "vendor-message",
        header: "Vendor Validation Message",
        source: "vendorValidationMessage",
        included: true,
      },
      {
        id: "po-status",
        header: "PO Validation Status",
        source: "poValidationStatus",
        included: true,
      },
      {
        id: "po-message",
        header: "PO Validation Message",
        source: "poValidationMessage",
        included: true,
      },
      { id: "po-vendor", header: "PO Vendor Name", source: "poVendorName", included: true },
      {
        id: "duplicate-status",
        header: "Duplicate Check Status",
        source: "duplicateCheckStatus",
        included: true,
      },
      {
        id: "duplicate-message",
        header: "Duplicate Check Message",
        source: "duplicateCheckMessage",
        included: true,
      },
      {
        id: "duplicate-date",
        header: "Duplicate Check Date",
        source: "duplicateCheckCheckedAt",
        included: true,
      },
      {
        id: "attention",
        header: "Requires AP Attention",
        source: "requiresApAttention",
        included: true,
      },
      {
        id: "attention-reason",
        header: "AP Attention Reason",
        source: "apAttentionReason",
        included: true,
      },
      {
        id: "processing",
        header: "Processing Status",
        source: "processingStatus",
        included: true,
      },
      {
        id: "confidence",
        header: "Extraction Confidence",
        source: "extractionConfidence",
        included: true,
      },
      { id: "file-name", header: "File Name", source: "fileOriginalName", included: true },
      { id: "file-hash", header: "File Hash", source: "fileHash", included: true },
    ];

    const csv = buildPaymentCsv(
      data,
      [
        baseInvoice({
          routedAt: "2026-04-15T13:30:00.000Z",
          notificationSentAt: "2026-04-16T14:30:00.000Z",
          ocrSummary: "OCR complete",
          validationSummary: "Validation complete",
          apReviewReasonCodes: ["vendor_not_found", "duplicate_suspected"],
          vendorValidationStatus: "Warning",
          vendorValidationMessage: "Vendor needs selection",
          poValidationStatus: "Vendor Mismatch",
          poValidationMessage: "PO vendor mismatch",
          poVendorName: "PO Vendor",
          duplicateCheckStatus: "Potential Duplicate",
          duplicateCheckMessage: "Potential duplicate invoice found.",
          duplicateCheckCheckedAt: "2026-04-17T15:30:00.000Z",
          requiresApAttention: true,
          apAttentionReason: "Potential duplicate invoice.",
          processingStatus: "validation_completed",
          extractionConfidence: 0.92,
        }),
      ],
    );

    assert.equal(
      csv,
      [
        '"Status","Routed Date","Notification Sent Date","OCR Summary","Validation Summary","AP Review Reason Codes","Vendor Validation Status","Vendor Validation Message","PO Validation Status","PO Validation Message","PO Vendor Name","Duplicate Check Status","Duplicate Check Message","Duplicate Check Date","Requires AP Attention","AP Attention Reason","Processing Status","Extraction Confidence","File Name","File Hash"',
        '"Approved/Completed","Apr 15, 2026","Apr 16, 2026","OCR complete","Validation complete","vendor_not_found; duplicate_suspected","Warning","Vendor needs selection","Vendor Mismatch","PO vendor mismatch","PO Vendor","Potential Duplicate","Potential duplicate invoice found.","Apr 17, 2026","Yes","Potential duplicate invoice.","validation_completed","0.92","invoice-100.pdf","sha256-test"',
      ].join("\r\n"),
    );
  });
});
