import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateBusinessDaysElapsed,
  findEscalationCandidates,
} from "./escalations";
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
    auditEvents: [],
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
          customToEmails: [],
          customCcEmails: [],
          customBccEmails: [],
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
        tone: "teal",
        showInFilter: true,
        showInApWorkQueue: false,
        showInDepartmentWork: true,
        showInCompleted: false,
        includeInEscalation: true,
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
});
