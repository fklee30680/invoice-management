import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  auditLogCsv,
  defaultAuditLogSettings,
  filterAuditEvents,
  normalizeAuditLogSettings,
  paginateAuditEvents,
  sortAuditEvents,
} from "./audit-log";
import { defaultDepartmentDecisions } from "./constants";
import { defaultDepartmentImportSettings } from "./department-parser";
import { normalizeInvoiceFields } from "./invoice-fields";
import { defaultMenuSettings } from "./menu-registry";
import { defaultPaymentFileSettings } from "./payment-file";
import { defaultPoImportSettings } from "./po-parser";
import { defaultPoValidationSettings } from "./po-validation";
import { defaultStatuses } from "./status-config";
import { defaultVendorImportSettings } from "./vendor-parser";
import type { AppData, AuditEvent, Invoice } from "./types";

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1",
    vendorName: "Northstar Supply",
    vendorNumber: "V-100",
    invoiceNumber: "INV-100",
    invoiceDate: "2026-04-02",
    amount: "125.50",
    poNumber: "PO-100",
    dateReceived: "2026-04-02",
    dateApproved: "",
    dateUploaded: "2026-04-02",
    dateSubmittedToDepartment: "",
    statusDate: "2026-04-02",
    routedAt: "",
    status: "Needs AP Review",
    departmentId: "dept-finance",
    departmentDecision: "",
    paymentProcessed: false,
    dateProcessedForPayment: "",
    escalations: [],
    comments: [],
    fileId: "file-1",
    notificationSentAt: "",
    ocrSummary: "",
    createdAt: "2026-04-02T12:00:00.000Z",
    updatedAt: "2026-04-02T12:00:00.000Z",
    ...overrides,
  };
}

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "audit-1",
    invoiceId: "invoice-1",
    actor: "AP",
    type: "invoice_uploaded",
    message: "Uploaded invoice",
    createdAt: "2026-04-03T12:00:00.000Z",
    ...overrides,
  };
}

function data(): AppData {
  return {
    departments: [{ id: "dept-finance", name: "Finance", email: "finance@example.com" }],
    users: [],
    purchaseOrders: [],
    vendors: [],
    invoices: [
      invoice(),
      invoice({
        id: "invoice-2",
        vendorName: "Brightline Services",
        vendorNumber: "V-200",
        invoiceNumber: "INV-200",
        invoiceDate: "2026-05-05",
        amount: "300.00",
        poNumber: "PO-200",
      }),
    ],
    invoiceFiles: [],
    invoiceDocuments: [],
    invoiceExtractions: [],
    invoiceFieldCandidates: [],
    invoiceValidationResults: [],
    auditEvents: [
      event(),
      event({
        id: "audit-2",
        invoiceId: "invoice-2",
        actor: "System",
        type: "invoice_routed",
        message: "Routed invoice, with comma\nand newline",
        createdAt: "2026-05-06T12:00:00.000Z",
      }),
      event({
        id: "audit-3",
        invoiceId: undefined,
        actor: "System",
        type: "settings_updated",
        message: "Changed setup",
        createdAt: "2026-05-07T12:00:00.000Z",
      }),
    ],
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

const emptyFilters = {
  auditFrom: "",
  auditTo: "",
  departmentId: "",
  vendor: "",
  invoiceDateFrom: "",
  invoiceDateTo: "",
  amountMin: "",
  amountMax: "",
  poNumber: "",
  invoiceNumber: "",
  actor: "",
  type: "",
  q: "",
};

describe("audit log helpers", () => {
  it("filters by invoice context and audit fields", () => {
    const source = data();
    assert.deepEqual(
      filterAuditEvents(source, { ...emptyFilters, vendor: "northstar" }).map((item) => item.id),
      ["audit-1"],
    );
    assert.deepEqual(
      filterAuditEvents(source, { ...emptyFilters, amountMin: "200", amountMax: "400" }).map(
        (item) => item.id,
      ),
      ["audit-2"],
    );
    assert.deepEqual(
      filterAuditEvents(source, { ...emptyFilters, poNumber: "po-2" }).map((item) => item.id),
      ["audit-2"],
    );
    assert.deepEqual(
      filterAuditEvents(source, { ...emptyFilters, actor: "system", type: "settings_updated" }).map(
        (item) => item.id,
      ),
      ["audit-3"],
    );
    assert.deepEqual(
      filterAuditEvents(source, { ...emptyFilters, q: "finance" }).map((item) => item.id),
      ["audit-1"],
    );
  });

  it("sorts by audit date, vendor, and amount", () => {
    const source = data();
    assert.deepEqual(
      sortAuditEvents(source, source.auditEvents, "auditDate", "desc").map((item) => item.id),
      ["audit-3", "audit-2", "audit-1"],
    );
    assert.deepEqual(
      sortAuditEvents(source, source.auditEvents, "vendor", "asc").map((item) => item.id),
      ["audit-2", "audit-1", "audit-3"],
    );
    assert.deepEqual(
      sortAuditEvents(source, source.auditEvents, "amount", "desc").map((item) => item.id),
      ["audit-2", "audit-1", "audit-3"],
    );
  });

  it("paginates safely", () => {
    const page = paginateAuditEvents([1, 2, 3], 2, 2);
    assert.deepEqual(page.items, [3]);
    assert.equal(page.start, 3);
    assert.equal(page.end, 3);
    assert.equal(paginateAuditEvents([1, 2, 3], -1, 999).pageSize, 50);
  });

  it("exports filtered CSV with escaped values", () => {
    const source = data();
    const csv = auditLogCsv(source, [source.auditEvents[1]]);
    assert.match(csv, /Audit Date,Actor,Type/);
    assert.match(csv, /Brightline Services/);
    assert.match(csv, /"Routed invoice, with comma\nand newline"/);
    assert.doesNotMatch(csv, /Northstar Supply/);
  });

  it("normalizes retention settings without deleting records", () => {
    assert.deepEqual(normalizeAuditLogSettings({ retentionYears: 1 }), {
      retentionYears: 3,
      retainSecurityEventsPermanently: true,
      retainInvoiceEventsPermanently: true,
      allowManualPurge: false,
    });
  });
});
