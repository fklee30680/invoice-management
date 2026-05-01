import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultDepartmentDecisions } from "./constants";
import { normalizeInvoiceFields } from "./invoice-fields";
import { defaultMenuSettings } from "./menu-registry";
import {
  defaultPoValidationSettings,
  validateInvoicePoNumber,
} from "./po-validation";
import { defaultPaymentFileSettings } from "./payment-file";
import { defaultStatuses } from "./status-config";
import type { AppData } from "./types";

function baseData(): AppData {
  return {
    departments: [{ id: "dept-1", name: "Finance", email: "finance@example.com" }],
    users: [],
    purchaseOrders: [
      {
        id: "po-1",
        poNumber: "PO-100",
        normalizedPoNumber: "PO-100",
        vendorName: "ABC Supply LLC",
        departmentId: "dept-1",
        uploadedAt: "2026-04-01T12:00:00.000Z",
      },
    ],
    vendors: [],
    invoices: [],
    invoiceFiles: [],
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
    menuSettings: defaultMenuSettings(),
    poValidationSettings: { ...defaultPoValidationSettings(), enabled: true },
    departmentDecisions: defaultDepartmentDecisions(),
    escalationContacts: [],
  };
}

describe("validateInvoicePoNumber", () => {
  it("skips lookup when PO validation is disabled", () => {
    const data = baseData();
    data.poValidationSettings.enabled = false;
    const result = validateInvoicePoNumber(data, {
      poNumber: "PO-100",
      invoiceVendorName: "Different Vendor",
    });
    assert.equal(result.enabled, false);
    assert.equal(result.severity, "none");
  });

  it("finds normalized PO numbers and accepts normalized vendor matches", () => {
    const result = validateInvoicePoNumber(baseData(), {
      poNumber: " po-100 ",
      invoiceVendorName: "ABC Supply",
    });
    assert.equal(result.found, true);
    assert.equal(result.vendorMatches, true);
    assert.equal(result.severity, "none");
  });

  it("blocks missing PO when required by settings", () => {
    const data = baseData();
    data.poValidationSettings.requirePoToExistInPoList = true;
    const result = validateInvoicePoNumber(data, {
      poNumber: "PO-999",
      invoiceVendorName: "ABC Supply",
    });
    assert.equal(result.found, false);
    assert.equal(result.severity, "blocking");
  });

  it("blocks different vendors when mismatch blocking is enabled", () => {
    const result = validateInvoicePoNumber(baseData(), {
      poNumber: "PO-100",
      invoiceVendorName: "XYZ Supply",
    });
    assert.equal(result.found, true);
    assert.equal(result.vendorMatches, false);
    assert.equal(result.severity, "blocking");
  });

  it("respects fuzzy match threshold", () => {
    const data = baseData();
    data.poValidationSettings.vendorMatchThreshold = 1;
    const result = validateInvoicePoNumber(data, {
      poNumber: "PO-100",
      invoiceVendorName: "ABC",
    });
    assert.equal(result.vendorMatches, false);
  });
});
