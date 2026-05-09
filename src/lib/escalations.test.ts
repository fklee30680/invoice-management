import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateBusinessDaysElapsed,
  findEscalationCandidates,
} from "./escalations";
import { normalizeInvoiceFields } from "./invoice-fields";
import { defaultMenuSettings } from "./menu-registry";
import { defaultPoImportSettings } from "./po-parser";
import { defaultVendorImportSettings } from "./vendor-parser";
import { defaultPoValidationSettings } from "./po-validation";
import { normalizeOrganizationDepartmentScope } from "./store";
import type { AppData, EscalationSchedulerSettings } from "./types";

const settings: EscalationSchedulerSettings = {
  enabled: true,
  timeOfDay: "08:00",
  timezone: "America/New_York",
  daysOfWeek: [1, 2, 3, 4, 5],
  excludedWeekdays: [0, 6],
  excludeHolidays: true,
  countRoutedDateAsDayOne: false,
};

function baseData(): AppData {
  return {
    departments: [
      {
        id: "dept-1",
        name: "Facilities",
        email: "facilities@example.com",
        departmentHeadEmail: "head@example.com",
        escalationEmail: "escalation@example.com",
      },
      {
        id: "dept-2",
        name: "Finance",
        email: "finance-dept@example.com",
      },
      {
        id: "dept-3",
        name: "Planning",
        email: "planning@example.com",
      },
    ],
    users: [],
    purchaseOrders: [],
    vendors: [],
    invoices: [
      {
        id: "invoice-1",
        vendorName: "Vendor A",
        invoiceNumber: "INV-1",
        invoiceDate: "2026-04-24",
        amount: "100",
        poNumber: "PO-1",
        dateReceived: "2026-04-24",
        dateApproved: "",
        dateUploaded: "2026-04-24",
        dateSubmittedToDepartment: "2026-04-24",
        statusDate: "2026-04-24",
        routedAt: "2026-04-24T19:00:00.000Z",
        status: "Routed",
        departmentId: "dept-1",
        departmentDecision: "",
        paymentProcessed: false,
        dateProcessedForPayment: "",
        escalations: [],
        comments: [],
        fileId: "file-1",
        notificationSentAt: "2026-04-24T19:00:00.000Z",
        ocrSummary: "",
        createdAt: "2026-04-24T19:00:00.000Z",
        updatedAt: "2026-04-24T19:00:00.000Z",
      },
    ],
    invoiceFiles: [],
    invoiceDocuments: [],
    invoiceExtractions: [],
    invoiceFieldCandidates: [],
    invoiceValidationResults: [],
    auditEvents: [],
    invoiceFields: normalizeInvoiceFields(undefined),
    dashboardBoxes: [],
    menuSettings: defaultMenuSettings(),
    poValidationSettings: defaultPoValidationSettings(),
    poImportSettings: defaultPoImportSettings(),
    vendorImportSettings: defaultVendorImportSettings(),
    notificationTemplate: {
      departmentSubject: "",
      departmentBody: "",
      escalationSubject: "",
      escalationBody: "",
    },
    escalationSchedules: [
      {
        id: "schedule-1",
        name: "Level 1 Schedule",
        description: "",
        enabled: true,
        daysToNotify: 1,
        statusIds: ["status-routed"],
        sortOrder: 1,
        createdAt: "2026-04-24T19:00:00.000Z",
        updatedAt: "2026-04-24T19:00:00.000Z",
      },
    ],
    escalationTemplates: [
      {
        id: "template-1",
        name: "Level 1",
        enabled: true,
        scheduleIds: ["schedule-1"],
        recipientConfig: {
          includeDepartmentEmail: true,
          includeDepartmentHeadEmail: false,
          includeDepartmentEscalationEmail: false,
          includeOrganizationContactsForTriggeredSchedule: false,
          specificOrganizationContactIds: [],
        },
        sortOrder: 1,
        subject: "{{vendor_name}} {{business_days_waiting}}",
        body: "{{review_link}}",
        createdAt: "2026-04-24T19:00:00.000Z",
        updatedAt: "2026-04-24T19:00:00.000Z",
      },
    ],
    escalationScheduler: settings,
    holidays: [],
    organizationEscalationContacts: [],
    escalationRunSummaries: [],
    paymentFile: { columns: [] },
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
    statuses: [
      {
        id: "status-routed",
        label: "Routed",
        active: true,
        tone: "teal",
        showInFilter: true,
        showInApWorkQueue: false,
        showInDepartmentWork: true,
        showInCompleted: false,
        includeInEscalation: true,
        includeInPaymentFile: false,
        systemRole: "routed",
      },
    ],
    departmentDecisions: [],
    escalationContacts: [],
  };
}

describe("calculateBusinessDaysElapsed", () => {
  it("excludes weekends and enabled holidays with routed date as day zero", () => {
    assert.equal(
      calculateBusinessDaysElapsed(
        "2026-04-24T19:00:00.000Z",
        "2026-04-28T12:00:00.000Z",
        settings,
        [{ id: "holiday-1", date: "2026-04-27", name: "Holiday", enabled: true }],
      ),
      1,
    );
  });

  it("can count routed date as day one", () => {
    assert.equal(
      calculateBusinessDaysElapsed(
        "2026-04-24T12:00:00.000Z",
        "2026-04-24T20:00:00.000Z",
        { ...settings, countRoutedDateAsDayOne: true },
        [],
      ),
      1,
    );
  });
});

describe("findEscalationCandidates", () => {
  it("requires status escalation eligibility", () => {
    const data = baseData();
    data.statuses[0].includeInEscalation = false;
    assert.equal(findEscalationCandidates(data, new Date("2026-04-27T13:00:00.000Z")).length, 0);
  });

  it("requires the invoice status to be selected on the schedule", () => {
    const data = baseData();
    data.escalationSchedules[0].statusIds = ["status-other"];
    assert.equal(findEscalationCandidates(data, new Date("2026-04-27T13:00:00.000Z")).length, 0);
  });

  it("does not run a schedule with no selected statuses", () => {
    const data = baseData();
    data.escalationSchedules[0].statusIds = [];
    assert.equal(findEscalationCandidates(data, new Date("2026-04-27T13:00:00.000Z")).length, 0);
  });

  it("prevents duplicate sends for the same routedAt cycle", () => {
    const data = baseData();
    data.invoices[0].escalations.push({
      id: "event-1",
      invoiceId: "invoice-1",
      scheduleId: "schedule-1",
      scheduleName: "Level 1 Schedule",
      templateId: "template-1",
      templateName: "Level 1",
      sentAt: "2026-04-27T13:00:00.000Z",
      routedAt: data.invoices[0].routedAt,
      daysToNotify: 1,
      businessDaysWaiting: 1,
      recipients: ["facilities@example.com"],
      statusAtSend: "Routed",
    });
    assert.equal(findEscalationCandidates(data, new Date("2026-04-27T13:00:00.000Z")).length, 0);
  });

  it("allows the same template again after reroute changes routedAt", () => {
    const data = baseData();
    data.invoices[0].escalations.push({
      id: "event-1",
      invoiceId: "invoice-1",
      scheduleId: "schedule-1",
      scheduleName: "Level 1 Schedule",
      templateId: "template-1",
      templateName: "Level 1",
      sentAt: "2026-04-27T13:00:00.000Z",
      routedAt: "2026-04-20T13:00:00.000Z",
      daysToNotify: 1,
      businessDaysWaiting: 1,
      recipients: ["facilities@example.com"],
      statusAtSend: "Routed",
    });
    assert.equal(findEscalationCandidates(data, new Date("2026-04-27T13:00:00.000Z")).length, 1);
  });

  it("resolves selected department recipients", () => {
    const data = baseData();
    data.escalationTemplates[0].recipientConfig.includeDepartmentHeadEmail = true;
    data.escalationTemplates[0].recipientConfig.includeDepartmentEscalationEmail = true;

    const candidate = findEscalationCandidates(data, new Date("2026-04-27T13:00:00.000Z"))[0];
    assert.deepEqual(candidate.to.sort(), [
      "escalation@example.com",
      "facilities@example.com",
      "head@example.com",
    ]);
  });

  it("resolves organization contacts assigned to the triggered schedule", () => {
    const data = baseData();
    data.organizationEscalationContacts.push({
      id: "org-1",
      title: "Finance Director",
      name: "Pat Lee",
      email: "finance@example.com",
      enabled: true,
      assignedScheduleIds: ["schedule-1"],
      departmentScope: { appliesToAllDepartments: true, departmentIds: [] },
      notes: "",
      createdAt: "2026-04-24T19:00:00.000Z",
      updatedAt: "2026-04-24T19:00:00.000Z",
    });
    data.escalationTemplates[0].recipientConfig.includeOrganizationContactsForTriggeredSchedule = true;

    const candidate = findEscalationCandidates(data, new Date("2026-04-27T13:00:00.000Z"))[0];
    assert.equal(candidate.to.includes("finance@example.com"), true);
  });

  it("removes duplicate resolved recipient emails", () => {
    const data = baseData();
    data.organizationEscalationContacts.push({
      id: "org-1",
      title: "Department Liaison",
      name: "Alex",
      email: "facilities@example.com",
      enabled: true,
      assignedScheduleIds: ["schedule-1"],
      departmentScope: { appliesToAllDepartments: true, departmentIds: [] },
      notes: "",
      createdAt: "2026-04-24T19:00:00.000Z",
      updatedAt: "2026-04-24T19:00:00.000Z",
    });
    data.escalationTemplates[0].recipientConfig.includeOrganizationContactsForTriggeredSchedule = true;

    const candidate = findEscalationCandidates(data, new Date("2026-04-27T13:00:00.000Z"))[0];
    assert.equal(candidate.to.filter((email) => email === "facilities@example.com").length, 1);
  });

  it("records warnings for missing configured contact emails", () => {
    const data = baseData();
    data.escalationTemplates[0].recipientConfig.includeDepartmentHeadEmail = true;
    data.departments[0].departmentHeadEmail = "";

    const candidate = findEscalationCandidates(data, new Date("2026-04-27T13:00:00.000Z"))[0];
    assert.equal(candidate.warnings.some((warning) => warning.includes("department head")), true);
  });

  it("skips escalation candidates when no valid recipients resolve", () => {
    const data = baseData();
    data.escalationTemplates[0].recipientConfig.includeDepartmentEmail = false;
    data.escalationTemplates[0].recipientConfig.includeDepartmentHeadEmail = true;
    data.departments[0].departmentHeadEmail = "";

    assert.equal(findEscalationCandidates(data, new Date("2026-04-27T13:00:00.000Z")).length, 0);
  });

  it("includes organization contact scoped to all departments", () => {
    const data = baseData();
    data.escalationTemplates[0].recipientConfig.includeDepartmentEmail = false;
    data.escalationTemplates[0].recipientConfig.includeOrganizationContactsForTriggeredSchedule = true;
    data.organizationEscalationContacts.push({
      id: "org-all",
      title: "Finance Director",
      name: "Pat Lee",
      email: "director@example.com",
      enabled: true,
      assignedScheduleIds: ["schedule-1"],
      departmentScope: { appliesToAllDepartments: true, departmentIds: [] },
      notes: "",
      createdAt: "2026-04-24T19:00:00.000Z",
      updatedAt: "2026-04-24T19:00:00.000Z",
    });

    const candidate = findEscalationCandidates(data, new Date("2026-04-27T13:00:00.000Z"))[0];
    assert.deepEqual(candidate.to, ["director@example.com"]);
  });

  it("includes organization contact scoped to the invoice department", () => {
    const data = baseData();
    data.escalationTemplates[0].recipientConfig.includeDepartmentEmail = false;
    data.escalationTemplates[0].recipientConfig.includeOrganizationContactsForTriggeredSchedule = true;
    data.organizationEscalationContacts.push({
      id: "org-scoped",
      title: "Facilities Liaison",
      name: "Sam",
      email: "sam@example.com",
      enabled: true,
      assignedScheduleIds: ["schedule-1"],
      departmentScope: { appliesToAllDepartments: false, departmentIds: ["dept-1"] },
      notes: "",
      createdAt: "2026-04-24T19:00:00.000Z",
      updatedAt: "2026-04-24T19:00:00.000Z",
    });

    const candidate = findEscalationCandidates(data, new Date("2026-04-27T13:00:00.000Z"))[0];
    assert.deepEqual(candidate.to, ["sam@example.com"]);
  });

  it("includes organization contact scoped to one of multiple selected departments", () => {
    const data = baseData();
    data.escalationTemplates[0].recipientConfig.includeDepartmentEmail = false;
    data.escalationTemplates[0].recipientConfig.includeOrganizationContactsForTriggeredSchedule = true;
    data.organizationEscalationContacts.push({
      id: "org-multi",
      title: "Shared Liaison",
      name: "Taylor",
      email: "taylor@example.com",
      enabled: true,
      assignedScheduleIds: ["schedule-1"],
      departmentScope: {
        appliesToAllDepartments: false,
        departmentIds: ["dept-1", "dept-2"],
      },
      notes: "",
      createdAt: "2026-04-24T19:00:00.000Z",
      updatedAt: "2026-04-24T19:00:00.000Z",
    });

    const candidate = findEscalationCandidates(data, new Date("2026-04-27T13:00:00.000Z"))[0];
    assert.deepEqual(candidate.to, ["taylor@example.com"]);
  });

  it("excludes organization contact outside invoice department scope", () => {
    const data = baseData();
    data.escalationTemplates[0].recipientConfig.includeDepartmentEmail = false;
    data.escalationTemplates[0].recipientConfig.includeOrganizationContactsForTriggeredSchedule = true;
    data.organizationEscalationContacts.push({
      id: "org-other",
      title: "Finance Liaison",
      name: "Morgan",
      email: "morgan@example.com",
      enabled: true,
      assignedScheduleIds: ["schedule-1"],
      departmentScope: { appliesToAllDepartments: false, departmentIds: ["dept-2"] },
      notes: "",
      createdAt: "2026-04-24T19:00:00.000Z",
      updatedAt: "2026-04-24T19:00:00.000Z",
    });

    assert.equal(findEscalationCandidates(data, new Date("2026-04-27T13:00:00.000Z")).length, 0);
  });

  it("includes all-department contact when invoice has no department", () => {
    const data = baseData();
    data.invoices[0].departmentId = "";
    data.escalationTemplates[0].recipientConfig.includeDepartmentEmail = false;
    data.escalationTemplates[0].recipientConfig.includeOrganizationContactsForTriggeredSchedule = true;
    data.organizationEscalationContacts.push({
      id: "org-all",
      title: "All Department Contact",
      name: "Jordan",
      email: "jordan@example.com",
      enabled: true,
      assignedScheduleIds: ["schedule-1"],
      departmentScope: { appliesToAllDepartments: true, departmentIds: [] },
      notes: "",
      createdAt: "2026-04-24T19:00:00.000Z",
      updatedAt: "2026-04-24T19:00:00.000Z",
    });

    const candidate = findEscalationCandidates(data, new Date("2026-04-27T13:00:00.000Z"))[0];
    assert.deepEqual(candidate.to, ["jordan@example.com"]);
  });

  it("excludes scoped contact when invoice has no department", () => {
    const data = baseData();
    data.invoices[0].departmentId = "";
    data.escalationTemplates[0].recipientConfig.includeDepartmentEmail = false;
    data.escalationTemplates[0].recipientConfig.includeOrganizationContactsForTriggeredSchedule = true;
    data.organizationEscalationContacts.push({
      id: "org-scoped",
      title: "Scoped Contact",
      name: "Jordan",
      email: "jordan@example.com",
      enabled: true,
      assignedScheduleIds: ["schedule-1"],
      departmentScope: { appliesToAllDepartments: false, departmentIds: ["dept-1"] },
      notes: "",
      createdAt: "2026-04-24T19:00:00.000Z",
      updatedAt: "2026-04-24T19:00:00.000Z",
    });

    assert.equal(findEscalationCandidates(data, new Date("2026-04-27T13:00:00.000Z")).length, 0);
  });
});

describe("normalizeOrganizationDepartmentScope", () => {
  it("migrates missing scope to all departments", () => {
    assert.deepEqual(normalizeOrganizationDepartmentScope(undefined), {
      appliesToAllDepartments: true,
      departmentIds: [],
    });
  });

  it("migrates empty array scope to all departments", () => {
    assert.deepEqual(normalizeOrganizationDepartmentScope([]), {
      appliesToAllDepartments: true,
      departmentIds: [],
    });
  });

  it("migrates array scope with department ids", () => {
    assert.deepEqual(normalizeOrganizationDepartmentScope(["dept-1", "dept-2"]), {
      appliesToAllDepartments: false,
      departmentIds: ["dept-1", "dept-2"],
    });
  });

  it("migrates all string scope", () => {
    assert.deepEqual(normalizeOrganizationDepartmentScope("ALL_DEPARTMENTS"), {
      appliesToAllDepartments: true,
      departmentIds: [],
    });
  });
});
