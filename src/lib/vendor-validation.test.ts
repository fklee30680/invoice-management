import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultDepartmentDecisions } from "./constants";
import { normalizeInvoiceFields } from "./invoice-fields";
import { defaultMenuSettings } from "./menu-registry";
import { defaultPaymentFileSettings } from "./payment-file";
import { defaultPoImportSettings } from "./po-parser";
import { defaultVendorImportSettings } from "./vendor-parser";
import { defaultPoValidationSettings } from "./po-validation";
import { defaultStatuses } from "./status-config";
import type { AppData, Invoice } from "./types";
import {
  applyVendorToInvoice,
  findVendorByNumber,
  validateVendorAgainstFile,
} from "./vendor-validation";

function baseData(): AppData {
  return {
    departments: [],
    users: [],
    purchaseOrders: [],
    vendors: [
      {
        id: "vendor-1",
        vendorName: "ABC Supply LLC",
        normalizedVendorName: "abc supply",
        vendorNumber: "V100",
        email: "",
        active: true,
        uploadedAt: "2026-04-01T12:00:00.000Z",
      },
      {
        id: "vendor-2",
        vendorName: "Georgia Power Company",
        normalizedVendorName: "georgia power",
        vendorNumber: "V200",
        email: "",
        active: true,
        uploadedAt: "2026-04-01T12:00:00.000Z",
      },
    ],
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

describe("validateVendorAgainstFile", () => {
  it("validates by vendor number", () => {
    const result = validateVendorAgainstFile(baseData(), "", { vendorNumber: "v100" });
    assert.equal(result.found, true);
    assert.equal(result.vendor?.vendorNumber, "V100");
  });

  it("validates normalized vendor names", () => {
    const result = validateVendorAgainstFile(baseData(), "ABC Supply");
    assert.equal(result.found, true);
    assert.equal(result.vendor?.vendorNumber, "V100");
  });

  it("auto-selects high-confidence fuzzy matches", () => {
    const result = validateVendorAgainstFile(baseData(), "Georgia Power");
    assert.equal(result.found, true);
    assert.equal(result.vendor?.vendorNumber, "V200");
  });

  it("returns suggestions without auto-selecting medium-confidence matches", () => {
    const result = validateVendorAgainstFile(baseData(), "ABC", {
      autoSelectThreshold: 0.95,
      suggestionThreshold: 0.4,
    });
    assert.equal(result.found, false);
    assert.equal(result.suggestions[0].vendorNumber, "V100");
  });

  it("blocks missing vendors when requested", () => {
    const result = validateVendorAgainstFile(baseData(), "Missing Vendor", {
      blockWhenMissing: true,
    });
    assert.equal(result.found, false);
    assert.equal(result.status, "Blocked");
  });

  it("applies selected vendor data to invoice fields", () => {
    const data = baseData();
    const vendor = findVendorByNumber(data, "V100");
    assert.ok(vendor);
    const invoice: Invoice = {
      id: "invoice-1",
      vendorName: "Raw OCR",
      invoiceNumber: "",
      invoiceDate: "",
      amount: "",
      poNumber: "",
      dateReceived: "",
      dateApproved: "",
      dateUploaded: "",
      dateSubmittedToDepartment: "",
      statusDate: "",
      routedAt: "",
      status: "Needs AP Review",
      departmentId: "",
      departmentDecision: "",
      paymentProcessed: false,
      dateProcessedForPayment: "",
      escalations: [],
      comments: [],
      fileId: "file-1",
      notificationSentAt: "",
      ocrSummary: "",
      createdAt: "",
      updatedAt: "",
    };
    applyVendorToInvoice(invoice, vendor, "Manual Selection");
    assert.equal(invoice.vendorName, "ABC Supply LLC");
    assert.equal(invoice.vendorNumber, "V100");
    assert.equal(invoice.vendorValidationStatus, "Validated");
  });
});
