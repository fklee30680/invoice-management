import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultDepartmentDecisions } from "./constants";
import { normalizeInvoiceFields } from "./invoice-fields";
import { defaultMenuSettings } from "./menu-registry";
import {
  buildPaymentCsv,
  defaultPaymentFileSettings,
  invoiceEligibleForPaymentFile,
} from "./payment-file";
import { defaultPoImportSettings } from "./po-parser";
import { defaultVendorImportSettings } from "./vendor-parser";
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
