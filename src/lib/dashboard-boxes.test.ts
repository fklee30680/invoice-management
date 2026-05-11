import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultDepartmentDecisions } from "./constants";
import {
  dashboardBoxHref,
  dashboardBoxInvoices,
  dashboardBoxMetric,
  defaultDashboardBoxes,
} from "./dashboard-boxes";
import { normalizeInvoiceFields } from "./invoice-fields";
import { defaultMenuSettings } from "./menu-registry";
import { defaultPaymentFileSettings } from "./payment-file";
import { defaultPoImportSettings } from "./po-parser";
import { defaultVendorImportSettings } from "./vendor-parser";
import { defaultDepartmentImportSettings } from "./department-parser";
import { defaultAuditLogSettings } from "./audit-log";
import { defaultPoValidationSettings } from "./po-validation";
import { defaultStatuses } from "./status-config";
import type { AppData, DashboardBox, Invoice } from "./types";

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1",
    vendorName: "Vendor A",
    invoiceNumber: "INV-1",
    invoiceDate: "2026-04-01",
    amount: "100",
    poNumber: "",
    dateReceived: "2026-04-01",
    dateApproved: "",
    dateUploaded: "2026-04-01",
    dateSubmittedToDepartment: "",
    statusDate: "2026-04-01",
    routedAt: "",
    status: "Routed",
    departmentId: "dept-1",
    departmentDecision: "",
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

function box(overrides: Partial<DashboardBox> = {}): DashboardBox {
  return {
    id: "box-1",
    name: "Routed Finance",
    enabled: true,
    order: 1,
    linkedViewId: "with-departments",
    departmentScope: { appliesToAllDepartments: false, departmentIds: ["dept-1"] },
    statusIds: ["status-routed"],
    metricType: "count",
    createdAt: "2026-04-01T12:00:00.000Z",
    updatedAt: "2026-04-01T12:00:00.000Z",
    ...overrides,
  };
}

function data(): AppData {
  return {
    departments: [
      { id: "dept-1", name: "Finance", email: "finance@example.com" },
      { id: "dept-2", name: "Public Works", email: "pw@example.com" },
    ],
    users: [],
    purchaseOrders: [],
    vendors: [],
    invoices: [
      invoice(),
      invoice({ id: "invoice-2", amount: "250", departmentId: "dept-2" }),
      invoice({ id: "invoice-3", status: "Approved/Completed", amount: "400" }),
    ],
    invoiceFiles: [],
    invoiceDocuments: [],
    invoiceExtractions: [],
    invoiceFieldCandidates: [],
    invoiceValidationResults: [],
    auditEvents: [],
    auditLogSettings: defaultAuditLogSettings(),
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

describe("dashboard boxes", () => {
  it("creates defaults without manual payment", () => {
    const defaults = defaultDashboardBoxes(data());
    assert.equal(defaults.some((item) => String(item.linkedViewId) === "manual-payment"), false);
    assert.deepEqual(
      defaults.map((item) => item.linkedViewId),
      ["total", "needs-ap-work", "with-departments", "completed"],
    );
  });

  it("filters by linked view, departments, and statuses", () => {
    assert.deepEqual(
      dashboardBoxInvoices(data(), box()).map((item) => item.id),
      ["invoice-1"],
    );
  });

  it("supports dollar metrics", () => {
    assert.deepEqual(dashboardBoxMetric(data(), box()), {
      count: 1,
      dollars: 100,
    });
  });

  it("builds invoice list links with matching filters", () => {
    assert.equal(
      dashboardBoxHref(data(), box()),
      "/invoices/with-departments?department=dept-1&status=Routed",
    );
  });
});
