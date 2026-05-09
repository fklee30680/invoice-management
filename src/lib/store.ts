import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type {
  AppData,
  AuditEvent,
  BrandingSettings,
  DashboardBox,
  Department,
  EscalationSchedulerSettings,
  Invoice,
  InvoiceFieldConfig,
  InvoiceFile,
  MenuSettings,
  NotificationTemplate,
  PaymentFileSettings,
  PoImportSettings,
  PoValidationSettings,
  PurchaseOrder,
  User,
  Vendor,
  VendorImportSettings,
} from "./types";
import { defaultDepartmentDecisions } from "./constants";
import {
  DASHBOARD_BOX_METRICS,
  DASHBOARD_BOX_VIEWS,
  defaultDashboardBoxes,
  defaultStatusIdsForDashboardView,
  isDashboardBoxLinkedView,
} from "./dashboard-boxes";
import {
  clearDatabaseIssue,
  getDatabaseConfig,
  reportDatabaseIssue,
} from "./runtime-config";
import {
  defaultPaymentFileSettings,
  normalizePaymentFileSettings,
} from "./payment-file";
import { normalizeInvoiceDuplicateState } from "./duplicate-invoices";
import { defaultMenuSettings, normalizeMenuSettings } from "./menu-registry";
import {
  defaultPoImportSettings,
  normalizePoImportSettings,
} from "./po-parser";
import {
  defaultVendorImportSettings,
  normalizeVendorImportSettings,
} from "./vendor-parser";
import {
  normalizePoValidationSettings,
  normalizePoValidationStatus,
} from "./po-validation";
import { normalizeVendorValidationState } from "./vendor-validation";
import { defaultStatuses, statusRoles } from "./status-config";
import { normalizeInvoiceFields } from "./invoice-fields";
import { normalizePoNumber, normalizeVendorName, slugify } from "./utils";

const RUNTIME_ROOT = process.env.VERCEL
  ? path.join("/tmp", "invoice-management")
  : process.cwd();

const DATA_DIR = path.join(RUNTIME_ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "app-data.json");
const UPLOAD_DIR = path.join(RUNTIME_ROOT, "uploads");
const APP_STATE_ID = "main";

type AppStateRow = {
  data: AppData;
};

let db: NeonQueryFunction<false, false> | null = null;
let schemaReady = false;

function defaultNotificationTemplate(): NotificationTemplate {
  return {
    departmentSubject: "Invoice review needed: {{vendor_name}}",
    departmentBody:
      "A new invoice requires your review.\n\nVendor: {{vendor_name}}\nInvoice Number: {{invoice_number}}\nPO Number: {{po_number}}\nAmount: {{amount}}\nDepartment: {{department_name}}\n\nOpen invoice: {{review_link}}",
    escalationSubject: "Invoice overdue for review: {{vendor_name}}",
    escalationBody:
      "An invoice is still waiting for review.\n\nVendor: {{vendor_name}}\nInvoice Number: {{invoice_number}}\nPO Number: {{po_number}}\nAmount: {{amount}}\nDepartment: {{department_name}}\nDays Waiting: {{days_waiting}}\n\nOpen invoice: {{review_link}}",
  };
}

function defaultBranding(): BrandingSettings {
  return {
    appTitle: "Invoice Management",
    divisionLabel: "AP Division",
    fontFamily: "Arial, Helvetica, ui-sans-serif, system-ui, sans-serif",
    accentColor: "#0f766e",
    accentStrongColor: "#115e59",
    backgroundColor: "#f6f7f9",
    panelColor: "#ffffff",
    panelStrongColor: "#eef2f6",
    textColor: "#17202a",
    mutedColor: "#657386",
    lineColor: "#d8dee7",
    logo: null,
  };
}

function defaultEscalationContacts(): AppData["escalationContacts"] {
  return [];
}

function defaultPaymentFile(): PaymentFileSettings {
  return defaultPaymentFileSettings();
}

function defaultEscalationScheduler(): EscalationSchedulerSettings {
  return {
    enabled: false,
    timeOfDay: "08:00",
    timezone: "America/New_York",
    daysOfWeek: [1, 2, 3, 4, 5],
    excludedWeekdays: [0, 6],
    excludeHolidays: true,
    countRoutedDateAsDayOne: false,
  };
}

function normalizeEscalationScheduler(
  settings: Partial<EscalationSchedulerSettings> | undefined,
) {
  const defaults = defaultEscalationScheduler();
  return {
    ...defaults,
    ...(settings || {}),
    daysOfWeek:
      Array.isArray(settings?.daysOfWeek) && settings.daysOfWeek.length > 0
        ? settings.daysOfWeek.map(Number).filter((day) => day >= 0 && day <= 6)
        : defaults.daysOfWeek,
    excludedWeekdays:
      Array.isArray(settings?.excludedWeekdays)
        ? settings.excludedWeekdays.map(Number).filter((day) => day >= 0 && day <= 6)
        : defaults.excludedWeekdays,
  };
}

export function normalizeOrganizationDepartmentScope(
  scope:
    | { appliesToAllDepartments?: boolean; departmentIds?: string[] }
    | string[]
    | string
    | undefined,
) {
  if (!scope) {
    return { appliesToAllDepartments: true, departmentIds: [] };
  }

  if (typeof scope === "string") {
    return ["all", "ALL_DEPARTMENTS"].includes(scope)
      ? { appliesToAllDepartments: true, departmentIds: [] }
      : { appliesToAllDepartments: false, departmentIds: [scope] };
  }

  if (Array.isArray(scope)) {
    if (
      scope.length === 0 ||
      scope.some((item) => ["all", "ALL_DEPARTMENTS"].includes(item))
    ) {
      return { appliesToAllDepartments: true, departmentIds: [] };
    }
    return { appliesToAllDepartments: false, departmentIds: scope.filter(Boolean) };
  }

  if (scope.appliesToAllDepartments !== false) {
    return { appliesToAllDepartments: true, departmentIds: [] };
  }

  return {
    appliesToAllDepartments: false,
    departmentIds: (scope.departmentIds || []).filter(Boolean),
  };
}

function defaultRecipientConfig() {
  return {
    includeDepartmentEmail: true,
    includeDepartmentHeadEmail: false,
    includeDepartmentEscalationEmail: false,
    includeOrganizationContactsForTriggeredSchedule: false,
    specificOrganizationContactIds: [],
  };
}

function normalizeEscalationSchedules(data: AppData) {
  const schedules = Array.isArray(data.escalationSchedules)
    ? data.escalationSchedules
    : [];
  const escalationStatusIds = (data.statuses || defaultStatuses())
    .filter((status) => status.active !== false && status.includeInEscalation)
    .map((status) => status.id);
  const normalized = schedules.map((schedule) => ({
    id: schedule.id || createId("schedule"),
    name: schedule.name || "Escalation Schedule",
    description: schedule.description || "",
    enabled: schedule.enabled !== false,
    daysToNotify: Math.max(Number(schedule.daysToNotify) || 0, 0),
    statusIds:
      Array.isArray(schedule.statusIds) && schedule.statusIds.length > 0
        ? schedule.statusIds.filter(Boolean)
        : escalationStatusIds,
    businessDayRuleId: schedule.businessDayRuleId || "",
    sortOrder: Number(schedule.sortOrder) || 0,
    createdAt: schedule.createdAt || new Date().toISOString(),
    updatedAt: schedule.updatedAt || new Date().toISOString(),
  }));

  for (const template of data.escalationTemplates || []) {
    const legacy = template as unknown as { daysToNotify?: number; scheduleIds?: string[] };
    if (Array.isArray(legacy.scheduleIds) && legacy.scheduleIds.length > 0) continue;
    if (legacy.daysToNotify === undefined) continue;
    const daysToNotify = Math.max(Number(legacy.daysToNotify) || 0, 0);
    if (normalized.some((schedule) => schedule.daysToNotify === daysToNotify)) continue;
    normalized.push({
      id: `schedule-${daysToNotify}-business-days`,
      name: `${daysToNotify} Business Day Escalation`,
      description: "Migrated from template Days to Notify.",
      enabled: true,
      daysToNotify,
      statusIds: escalationStatusIds,
      businessDayRuleId: "",
      sortOrder: normalized.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return normalized.sort((left, right) => left.sortOrder - right.sortOrder);
}

function normalizeOrganizationEscalationContacts(
  contacts: AppData["organizationEscalationContacts"] | Record<string, unknown> | undefined,
) {
  if (Array.isArray(contacts)) {
    return contacts.map((contact) => ({
      id: contact.id || createId("org-contact"),
      title: contact.title || "",
      name: contact.name || "",
      email: contact.email || "",
      enabled: contact.enabled !== false,
      assignedScheduleIds: contact.assignedScheduleIds || [],
      departmentScope: normalizeOrganizationDepartmentScope(contact.departmentScope),
      notes: contact.notes || "",
      createdAt: contact.createdAt || new Date().toISOString(),
      updatedAt: contact.updatedAt || new Date().toISOString(),
    }));
  }

  if (contacts && typeof contacts === "object") {
    const legacy = contacts as Record<string, string | undefined>;
    return [
      {
        title: legacy.apSupervisorTitle || "AP Supervisor",
        name: legacy.apSupervisorName || "",
        email: legacy.apSupervisorEmail || "",
      },
      {
        title: legacy.cfoTitle || "CFO",
        name: legacy.cfoName || "",
        email: legacy.cfoEmail || "",
      },
      {
        title: legacy.executiveTitle || "Executive",
        name: legacy.executiveName || "",
        email: legacy.executiveEmail || "",
      },
    ]
      .filter((contact) => contact.name || contact.email)
      .map((contact) => ({
        id: createId("org-contact"),
        title: contact.title,
        name: contact.name,
        email: contact.email,
        enabled: true,
        assignedScheduleIds: [],
        departmentScope: { appliesToAllDepartments: true, departmentIds: [] },
        notes: "Migrated from prior organization escalation settings.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
  }

  return [];
}

function normalizeDepartmentDecisions(
  decisions:
    | AppData["departmentDecisions"]
    | string[]
    | undefined,
): AppData["departmentDecisions"] {
  const defaults = defaultDepartmentDecisions();
  if (!Array.isArray(decisions)) return defaults;

  const normalized = decisions
    .map((decision) => {
      if (typeof decision === "string") {
        const defaultDecision = defaults.find((item) => item.label === decision);
        return {
          id: defaultDecision?.id || createId("decision"),
          label: decision,
          workflowAction: defaultDecision?.workflowAction || "complete",
          requireComment: defaultDecision?.requireComment || false,
          requirePoNumber: defaultDecision?.requirePoNumber || false,
          includeInPaymentFile: defaultDecision?.includeInPaymentFile || false,
          active: true,
        };
      }

      const defaultDecision = defaults.find(
        (item) => item.id === decision.id || item.label === decision.label,
      );
      return {
        id: decision.id || defaultDecision?.id || createId("decision"),
        label: decision.label || defaultDecision?.label || "",
        workflowAction: decision.workflowAction || defaultDecision?.workflowAction || "complete",
        requireComment: decision.requireComment === true,
          requirePoNumber:
            typeof decision.requirePoNumber === "boolean"
              ? decision.requirePoNumber
              : defaultDecision?.requirePoNumber || false,
          includeInPaymentFile:
            typeof decision.includeInPaymentFile === "boolean"
              ? decision.includeInPaymentFile
              : defaultDecision?.includeInPaymentFile || false,
        active: decision.active !== false,
      };
    })
    .filter((decision) => decision.label);

  for (const defaultDecision of defaults) {
    if (!normalized.some((decision) => decision.label === defaultDecision.label)) {
      normalized.push(defaultDecision);
    }
  }

  return normalized;
}

function normalizeDashboardBoxDepartmentScope(
  scope:
    | { appliesToAllDepartments?: boolean; departmentIds?: string[] }
    | string[]
    | string
    | undefined,
) {
  if (!scope) return { appliesToAllDepartments: true, departmentIds: [] };
  if (typeof scope === "string") {
    return ["all", "ALL_DEPARTMENTS"].includes(scope)
      ? { appliesToAllDepartments: true, departmentIds: [] }
      : { appliesToAllDepartments: false, departmentIds: [scope] };
  }
  if (Array.isArray(scope)) {
    if (
      scope.length === 0 ||
      scope.some((item) => ["all", "ALL_DEPARTMENTS"].includes(item))
    ) {
      return { appliesToAllDepartments: true, departmentIds: [] };
    }
    return { appliesToAllDepartments: false, departmentIds: scope.filter(Boolean) };
  }
  if (scope.appliesToAllDepartments !== false) {
    return { appliesToAllDepartments: true, departmentIds: [] };
  }
  return {
    appliesToAllDepartments: false,
    departmentIds: (scope.departmentIds || []).filter(Boolean),
  };
}

function normalizeDashboardBoxes(data: AppData): DashboardBox[] {
  const configured = Array.isArray(data.dashboardBoxes) ? data.dashboardBoxes : [];
  const defaults = defaultDashboardBoxes(data);
  const validMetricTypes = new Set(DASHBOARD_BOX_METRICS.map((metric) => metric.value));
  const source = configured.length ? configured : defaults;

  return source
    .map((box, index) => {
      const rawView = String(box.linkedViewId || "");
      const linkedViewId = isDashboardBoxLinkedView(rawView)
        ? rawView
        : defaults[0].linkedViewId;
      const validView = DASHBOARD_BOX_VIEWS.includes(linkedViewId);
      const enabled = validView && rawView !== "manual-payment" && box.enabled !== false;
      const statusIds =
        Array.isArray(box.statusIds) && box.statusIds.length > 0
          ? box.statusIds.filter(Boolean)
          : defaultStatusIdsForDashboardView(data, linkedViewId);
      const metricType = validMetricTypes.has(box.metricType) ? box.metricType : "count";
      const now = new Date().toISOString();
      return {
        id: box.id || createId("dashboard-box"),
        name: box.name || defaults.find((item) => item.linkedViewId === linkedViewId)?.name || "Dashboard Box",
        enabled,
        order: Number(box.order) || index + 1,
        linkedViewId,
        departmentScope: normalizeDashboardBoxDepartmentScope(box.departmentScope),
        statusIds,
        metricType,
        createdAt: box.createdAt || now,
        updatedAt: box.updatedAt || now,
      };
    })
    .sort((left, right) => left.order - right.order)
    .map((box, index) => ({ ...box, order: index + 1 }));
}

function normalizeData(data: AppData): AppData {
  const defaultBrand = defaultBranding();
  const defaultStatusList = defaultStatuses();
  const vendors = (data.vendors || []).map((vendor) => ({
    ...vendor,
    vendorName: vendor.vendorName || "",
    normalizedVendorName:
      vendor.normalizedVendorName || normalizeVendorName(vendor.vendorName || ""),
    vendorNumber: vendor.vendorNumber || "",
    email: vendor.email || "",
    active: vendor.active !== false,
    uploadedAt: vendor.uploadedAt || new Date().toISOString(),
    updatedAt: vendor.updatedAt || "",
  }));
  const vendorData = { ...data, vendors } as AppData;
  const purchaseOrders = (data.purchaseOrders || []).map((po) => ({
    ...po,
    poNumber: po.poNumber || "",
    normalizedPoNumber: po.normalizedPoNumber || normalizePoNumber(po.poNumber || ""),
    vendorName: po.vendorName || "",
    vendorNumber: po.vendorNumber || "",
    departmentId: po.departmentId || "",
    departmentName: po.departmentName || "",
    uploadedAt: po.uploadedAt || new Date().toISOString(),
    updatedAt: po.updatedAt || "",
  }));
  const invoices = (data.invoices || []).map((invoice) => {
    const legacyStatus = String(invoice.status);
    const notificationSentAt = invoice.notificationSentAt || "";
    const routedAt = invoice.routedAt || notificationSentAt || "";
    const normalizedInvoice = normalizeInvoiceDuplicateState(
      normalizeVendorValidationState(
        normalizePoValidationStatus({
          ...invoice,
          paymentProcessed: invoice.paymentProcessed === true,
          dateProcessedForPayment: invoice.dateProcessedForPayment || "",
          documentId: invoice.documentId || "",
          extractionId: invoice.extractionId || "",
          extractionConfidence: invoice.extractionConfidence || 0,
          validationSummary: invoice.validationSummary || "",
          apReviewReasonCodes: Array.isArray(invoice.apReviewReasonCodes)
            ? invoice.apReviewReasonCodes
            : [],
          processingStatus: invoice.processingStatus || "validation_completed",
          dateUploaded:
            invoice.dateUploaded ||
            invoice.createdAt?.slice(0, 10) ||
            invoice.dateReceived ||
            "",
          dateSubmittedToDepartment:
            invoice.dateSubmittedToDepartment || notificationSentAt.slice(0, 10) || "",
          statusDate: invoice.statusDate || invoice.updatedAt?.slice(0, 10) || "",
          routedAt,
          escalations: invoice.escalations || [],
          notificationSentAt,
        }),
        vendorData,
      ),
    );
    if (legacyStatus === "OCR Processing") {
      return { ...normalizedInvoice, status: "Needs AP Review" as const };
    }
    if (legacyStatus === "Decision Received") {
      return { ...normalizedInvoice, status: "Approved/Completed" as const };
    }
    return normalizedInvoice;
  });
  const statuses = mergeStatuses(defaultStatusList, data.statuses || [], invoices);
  const escalationSchedules = normalizeEscalationSchedules(data);
  const scheduleByDays = new Map(
    escalationSchedules.map((schedule) => [schedule.daysToNotify, schedule.id]),
  );

  return {
    ...data,
    invoices,
    invoiceFiles: (data.invoiceFiles || []).map((file) => ({
      ...file,
      fileHash: file.fileHash || "",
      processingStatus: file.processingStatus || "stored",
    })),
    invoiceDocuments: (data.invoiceDocuments || []).map((document) => ({
      ...document,
      invoiceId: document.invoiceId || "",
      fileId: document.fileId || "",
      fileHash: document.fileHash || "",
      storageProvider: document.storageProvider || "local",
      blobUrl: document.blobUrl || "",
      blobPathname: document.blobPathname || "",
      uploadedBy: document.uploadedBy || "Unknown",
      uploadedAt: document.uploadedAt || new Date().toISOString(),
      processingStatus: document.processingStatus || "uploaded",
      failureReason: document.failureReason || "",
    })),
    invoiceExtractions: (data.invoiceExtractions || []).map((extraction) => ({
      ...extraction,
      invoiceId: extraction.invoiceId || "",
      provider: extraction.provider || "filename_fallback",
      providerModel: extraction.providerModel || "",
      rawText: extraction.rawText || "",
      documentType: extraction.documentType || "unknown",
      documentConfidence: extraction.documentConfidence || 0,
      ocrConfidence: extraction.ocrConfidence || 0,
      extractionSummary: extraction.extractionSummary || "",
      invoiceConfidence: extraction.invoiceConfidence || 0,
      createdAt: extraction.createdAt || new Date().toISOString(),
    })),
    invoiceFieldCandidates: (data.invoiceFieldCandidates || []).map((candidate) => ({
      ...candidate,
      invoiceId: candidate.invoiceId || "",
      rawValue: candidate.rawValue || "",
      normalizedValue: candidate.normalizedValue || "",
      nearbyLabel: candidate.nearbyLabel || "",
      extractionSource: candidate.extractionSource || "filename_fallback",
      confidence: candidate.confidence || 0,
      selected: candidate.selected === true,
      validationStatus: candidate.validationStatus || "not_checked",
      validationMessage: candidate.validationMessage || "",
    })),
    invoiceValidationResults: (data.invoiceValidationResults || []).map((result) => ({
      ...result,
      invoiceId: result.invoiceId || "",
      fieldName: result.fieldName || "",
      status: result.status || "not_checked",
      severity: result.severity || "info",
      createdAt: result.createdAt || new Date().toISOString(),
    })),
    purchaseOrders,
    departments: (data.departments || []).map((department) => ({
      ...department,
      departmentHeadName: department.departmentHeadName || "",
      departmentHeadEmail: department.departmentHeadEmail || "",
      escalationName: department.escalationName || "",
      escalationEmail: department.escalationEmail || "",
    })),
    vendors,
    notificationTemplate: {
      ...defaultNotificationTemplate(),
      ...(data.notificationTemplate || {}),
    },
    paymentFile: normalizePaymentFileSettings(data.paymentFile || defaultPaymentFile()),
    branding: {
      ...defaultBrand,
      ...(data.branding || {}),
      logo: data.branding?.logo || null,
    },
    statuses,
    invoiceFields: normalizeInvoiceFields(
      (data as AppData & { invoiceFields?: InvoiceFieldConfig[] }).invoiceFields,
    ),
    dashboardBoxes: normalizeDashboardBoxes({ ...data, statuses } as AppData),
    menuSettings: normalizeMenuSettings(
      (data as AppData & { menuSettings?: MenuSettings }).menuSettings,
    ),
    poValidationSettings: normalizePoValidationSettings(
      (data as AppData & { poValidationSettings?: PoValidationSettings })
        .poValidationSettings,
    ),
    poImportSettings: normalizePoImportSettings(
      (data as AppData & { poImportSettings?: PoImportSettings }).poImportSettings,
    ),
    vendorImportSettings: normalizeVendorImportSettings(
      (data as AppData & { vendorImportSettings?: VendorImportSettings })
        .vendorImportSettings,
    ),
    departmentDecisions: normalizeDepartmentDecisions(data.departmentDecisions),
    escalationSchedules,
    escalationTemplates: (data.escalationTemplates || [])
      .map((template) => {
        const legacy = template as unknown as {
          daysToNotify?: number;
          toRecipients?: { type: string; customEmail?: string }[];
        };
        const scheduleIds =
          template.scheduleIds && template.scheduleIds.length > 0
            ? template.scheduleIds
            : legacy.daysToNotify !== undefined
              ? [scheduleByDays.get(Math.max(Number(legacy.daysToNotify) || 0, 0)) || ""].filter(Boolean)
              : [];
        const legacyTo = legacy.toRecipients || [];
        const recipientConfig = template.recipientConfig || {
          ...defaultRecipientConfig(),
          includeDepartmentEmail: legacyTo.some((item) => item.type === "departmentEmail"),
          includeDepartmentHeadEmail: legacyTo.some((item) => item.type === "departmentHeadEmail"),
          includeDepartmentEscalationEmail: legacyTo.some((item) => item.type === "departmentEscalationEmail"),
        };
        return {
          id: template.id || createId("escalation-template"),
          name: template.name || "Escalation Template",
          enabled: template.enabled === true,
          scheduleIds,
          recipientConfig: {
            ...defaultRecipientConfig(),
            ...recipientConfig,
            specificOrganizationContactIds:
              recipientConfig.specificOrganizationContactIds || [],
          },
          sortOrder: Number(template.sortOrder) || 0,
          subject: template.subject || "",
          body: template.body || "",
          createdAt: template.createdAt || new Date().toISOString(),
          updatedAt: template.updatedAt || new Date().toISOString(),
        };
      })
      .sort((left, right) => left.sortOrder - right.sortOrder),
    escalationScheduler: normalizeEscalationScheduler(data.escalationScheduler),
    holidays: (data.holidays || []).map((holiday) => ({
      ...holiday,
      enabled: holiday.enabled !== false,
      notes: holiday.notes || "",
    })),
    organizationEscalationContacts: normalizeOrganizationEscalationContacts(
      data.organizationEscalationContacts,
    ),
    escalationRunSummaries: data.escalationRunSummaries || [],
    escalationContacts: normalizeEscalationContacts(data.escalationContacts),
  };
}

function normalizeEscalationContacts(
  contacts: AppData["escalationContacts"] | Record<string, unknown> | undefined,
): AppData["escalationContacts"] {
  if (Array.isArray(contacts)) {
    return contacts.map((contact) => ({
      id: contact.id || createId("escalation"),
      name: contact.name || "",
      email: contact.email || "",
      allDepartments: contact.allDepartments !== false,
      departmentIds: contact.allDepartments === false ? contact.departmentIds || [] : [],
      daysToNotify: Number(contact.daysToNotify) || 1,
    }));
  }

  if (contacts && typeof contacts === "object") {
    return Object.values(contacts)
      .map((contact) => contact as { name?: string; email?: string; title?: string })
      .filter((contact) => contact.name || contact.email)
      .map((contact) => ({
        id: createId("escalation"),
        name: contact.name || contact.title || "",
        email: contact.email || "",
        allDepartments: true,
        departmentIds: [],
        daysToNotify: 1,
      }));
  }

  return defaultEscalationContacts();
}

function mergeStatuses(
  defaultStatusList: ReturnType<typeof defaultStatuses>,
  configuredStatuses: AppData["statuses"],
  invoices: AppData["invoices"],
) {
  const byRole = new Map(
    configuredStatuses.flatMap((status) =>
      statusRoles(status).map((role) => [role, status] as const),
    ),
  );
  const byLabel = new Map(configuredStatuses.map((status) => [status.label, status]));
  const statuses: AppData["statuses"] = [];

  for (const defaultStatus of defaultStatusList) {
    const configured = defaultStatus.systemRole
      ? byRole.get(defaultStatus.systemRole)
      : undefined;
    const candidate = { ...defaultStatus, ...configured };
    if (!statuses.some((status) => status.id === candidate.id)) {
      statuses.push(candidate);
    }
  }

  for (const status of configuredStatuses) {
    const roles = statusRoles(status);
    if (
      roles.length > 0 &&
      statuses.some((item) =>
        statusRoles(item).some((role) => roles.includes(role)),
      )
    ) {
      continue;
    }
    if (!statuses.some((item) => item.id === status.id || item.label === status.label)) {
      statuses.push(status);
    }
  }

  for (const invoice of invoices) {
    if (!invoice.status || statuses.some((status) => status.label === invoice.status)) {
      continue;
    }
    const configured = byLabel.get(invoice.status);
    statuses.push(
      configured || {
        id: createId("status"),
        label: invoice.status,
        active: false,
        tone: "blue",
        showInFilter: false,
        showInApWorkQueue: false,
        showInDepartmentWork: false,
        showInCompleted: false,
        includeInEscalation: false,
        includeInPaymentFile: false,
      },
    );
  }

  return statuses.map((status) => {
    const roles = statusRoles(status);
    const normalized = {
      ...status,
      active: status.active !== false,
      showInFilter:
        typeof status.showInFilter === "boolean" ? status.showInFilter : true,
      showInApWorkQueue:
        typeof status.showInApWorkQueue === "boolean"
          ? status.showInApWorkQueue
          : roles.includes("apReview") || roles.includes("apRework"),
      showInDepartmentWork:
        typeof status.showInDepartmentWork === "boolean"
          ? status.showInDepartmentWork
          : roles.includes("routed"),
      showInCompleted:
        typeof status.showInCompleted === "boolean"
          ? status.showInCompleted
          : roles.includes("completed"),
      includeInEscalation:
        typeof status.includeInEscalation === "boolean"
          ? status.includeInEscalation
          : roles.includes("routed"),
      includeInPaymentFile:
        typeof status.includeInPaymentFile === "boolean"
          ? status.includeInPaymentFile
          : roles.includes("completed"),
    };

    if (!roles.includes("processedForPayment")) return normalized;

    const protectedDefault = defaultStatusList.find((item) =>
      statusRoles(item).includes("processedForPayment"),
    );
    return {
      ...(protectedDefault || normalized),
      id: protectedDefault?.id || normalized.id,
      label: normalized.label || protectedDefault?.label || "Processed for Payment",
      active: true,
      systemRole: "processedForPayment" as const,
    };
  });
}

function hasDatabase() {
  return Boolean(getDatabaseConfig().value);
}

function getDb() {
  const database = getDatabaseConfig();
  if (!database.value) {
    throw new Error("No Postgres connection string is configured.");
  }
  if (!db) {
    db = neon(database.value);
  }
  return db;
}

async function ensureDatabaseSchema() {
  if (schemaReady) return;
  const sql = getDb();
  await sql`
    create table if not exists app_state (
      id text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;
  schemaReady = true;
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function ensureRuntimeDirs() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(UPLOAD_DIR, { recursive: true });
}

export function getUploadPath(storedName: string) {
  return path.join(UPLOAD_DIR, storedName);
}

function seedData(): AppData {
  const departments: Department[] = [
    { id: "dept-facilities", name: "Facilities", email: "facilities@example.com" },
    { id: "dept-operations", name: "Operations", email: "operations@example.com" },
    { id: "dept-it", name: "Information Technology", email: "it@example.com" },
    { id: "dept-finance", name: "Finance", email: "finance@example.com" },
  ];

  const users: User[] = [
    {
      id: "user-ap-admin",
      name: "AP Specialist",
      email: "ap@example.com",
      role: "AP",
    },
    {
      id: "user-facilities",
      name: "Facilities Reviewer",
      email: "facilities.reviewer@example.com",
      role: "DEPARTMENT",
      departmentId: "dept-facilities",
    },
    {
      id: "user-operations",
      name: "Operations Reviewer",
      email: "operations.reviewer@example.com",
      role: "DEPARTMENT",
      departmentId: "dept-operations",
    },
  ];

  const purchaseOrders: PurchaseOrder[] = [
    {
      id: "po-10045",
      poNumber: "PO-10045",
      normalizedPoNumber: normalizePoNumber("PO-10045"),
      vendorName: "Northstar Supply",
      vendorNumber: "",
      departmentId: "dept-facilities",
      departmentName: "Facilities",
      uploadedAt: new Date().toISOString(),
      updatedAt: "",
    },
    {
      id: "po-20810",
      poNumber: "PO-20810",
      normalizedPoNumber: normalizePoNumber("PO-20810"),
      vendorName: "Brightline Services",
      vendorNumber: "",
      departmentId: "dept-operations",
      departmentName: "Operations",
      uploadedAt: new Date().toISOString(),
      updatedAt: "",
    },
  ];

  return {
    departments,
    users,
    purchaseOrders,
    vendors: [],
    invoices: [],
    invoiceFiles: [],
    invoiceDocuments: [],
    invoiceExtractions: [],
    invoiceFieldCandidates: [],
    invoiceValidationResults: [],
    auditEvents: [
      {
        id: createId("audit"),
        actor: "System",
        type: "seeded",
        message: "Seeded departments, users, and starter PO records.",
        createdAt: new Date().toISOString(),
      },
    ],
    notificationTemplate: defaultNotificationTemplate(),
    escalationSchedules: [],
    escalationTemplates: [],
    escalationScheduler: defaultEscalationScheduler(),
    holidays: [],
    organizationEscalationContacts: [],
    escalationRunSummaries: [],
    paymentFile: defaultPaymentFile(),
    branding: defaultBranding(),
    statuses: defaultStatuses(),
    invoiceFields: normalizeInvoiceFields(undefined),
    dashboardBoxes: [],
    menuSettings: defaultMenuSettings(),
    poValidationSettings: normalizePoValidationSettings(undefined),
    poImportSettings: defaultPoImportSettings(),
    vendorImportSettings: defaultVendorImportSettings(),
    departmentDecisions: defaultDepartmentDecisions(),
    escalationContacts: defaultEscalationContacts(),
  };
}

export async function readData(): Promise<AppData> {
  if (hasDatabase()) {
    try {
      const data = await readDatabaseData();
      clearDatabaseIssue();
      return data;
    } catch (error) {
      reportDatabaseIssue(error);
      console.error("[storage:database] read failed", error);
      return readLocalData();
    }
  }

  return readLocalData();
}

async function readLocalData(): Promise<AppData> {
  await ensureRuntimeDirs();
    try {
      const raw = await readFile(DATA_FILE, "utf8");
      return normalizeData(JSON.parse(raw) as AppData);
    } catch {
      const data = seedData();
      await writeData(data);
      return data;
  }
}

export async function writeData(data: AppData) {
  if (hasDatabase()) {
    try {
      await writeDatabaseData(data);
      clearDatabaseIssue();
      return;
    } catch (error) {
      reportDatabaseIssue(error);
      console.error("[storage:database] write failed", error);
    }
  }

  await ensureRuntimeDirs();
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

export async function mutateData<T>(mutator: (data: AppData) => T | Promise<T>) {
  const data = await readData();
  const result = await mutator(data);
  await writeData(data);
  return result;
}

export function addAudit(
  data: AppData,
  input: Omit<AuditEvent, "id" | "createdAt">,
) {
  data.auditEvents.unshift({
    ...input,
    id: createId("audit"),
    createdAt: new Date().toISOString(),
  });
}

export function findDepartmentByName(data: AppData, name: string) {
  return data.departments.find(
    (department) => department.name.toLowerCase() === name.trim().toLowerCase(),
  );
}

export function upsertDepartment(data: AppData, name: string, email = "") {
  const existing = findDepartmentByName(data, name);
  if (existing && email) {
    existing.email = email.trim().toLowerCase();
  }
  if (existing) return existing;

  const department: Department = {
    id: `dept-${slugify(name) || createId("department")}`,
    name: name.trim(),
    email: email.trim().toLowerCase(),
  };
  data.departments.push(department);
  return department;
}

export function upsertPurchaseOrder(
  data: AppData,
  poNumber: string,
  vendorName: string,
  departmentName: string,
  vendorNumber = "",
  options: { updateExisting?: boolean; nowIso?: string } = {},
) {
  const department = findDepartmentByName(data, departmentName);
  const normalizedPoNumber = normalizePoNumber(poNumber);
  const nowIso = options.nowIso || new Date().toISOString();
  const existing = data.purchaseOrders.find(
    (po) => po.normalizedPoNumber === normalizedPoNumber,
  );

  if (existing) {
    if (options.updateExisting === false) return undefined;
    existing.vendorName = vendorName.trim();
    existing.vendorNumber = vendorNumber.trim();
    existing.departmentId = department?.id || "";
    existing.departmentName = department?.name || departmentName.trim();
    existing.updatedAt = nowIso;
    return existing;
  }

  const purchaseOrder: PurchaseOrder = {
    id: createId("po"),
    poNumber: poNumber.trim(),
    normalizedPoNumber,
    vendorName: vendorName.trim(),
    vendorNumber: vendorNumber.trim(),
    departmentId: department?.id || "",
    departmentName: department?.name || departmentName.trim(),
    uploadedAt: nowIso,
    updatedAt: nowIso,
  };
  data.purchaseOrders.push(purchaseOrder);
  return purchaseOrder;
}

export function findPurchaseOrder(data: AppData, poNumber: string) {
  const normalized = normalizePoNumber(poNumber);
  if (!normalized) return undefined;
  return data.purchaseOrders.find((po) => po.normalizedPoNumber === normalized);
}

export function upsertVendor(
  data: AppData,
  vendorName: string,
  vendorNumber = "",
  email = "",
  active = true,
) {
  const normalizedVendorName = normalizeVendorName(vendorName);
  if (!normalizedVendorName) return undefined;

  const existing = data.vendors.find(
    (vendor) => vendor.normalizedVendorName === normalizedVendorName,
  );

  if (existing) {
    existing.vendorName = vendorName.trim();
    existing.vendorNumber = vendorNumber.trim();
    existing.email = email.trim().toLowerCase();
    existing.active = active;
    existing.uploadedAt = new Date().toISOString();
    return existing;
  }

  const vendor: Vendor = {
    id: createId("vendor"),
    vendorName: vendorName.trim(),
    normalizedVendorName,
    vendorNumber: vendorNumber.trim(),
    email: email.trim().toLowerCase(),
    active,
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  data.vendors.push(vendor);
  return vendor;
}

export function findVendorByName(data: AppData, vendorName: string) {
  const normalized = normalizeVendorName(vendorName);
  if (!normalized) return undefined;
  return data.vendors.find(
    (vendor) => vendor.active && vendor.normalizedVendorName === normalized,
  );
}

export function getInvoiceFile(data: AppData, fileId: string) {
  return data.invoiceFiles.find((file) => file.id === fileId);
}

export function getInvoice(data: AppData, invoiceId: string) {
  return data.invoices.find((invoice) => invoice.id === invoiceId);
}

export function addInvoiceFile(data: AppData, file: InvoiceFile) {
  data.invoiceFiles.push(file);
}

export function addInvoice(data: AppData, invoice: Invoice) {
  data.invoices.unshift(invoice);
}

async function readDatabaseData(): Promise<AppData> {
  await ensureDatabaseSchema();
  const sql = getDb();
  const rows = (await sql`
    select data
    from app_state
    where id = ${APP_STATE_ID}
    limit 1
  `) as AppStateRow[];

  if (rows[0]?.data) {
    return normalizeData(rows[0].data);
  }

  const data = seedData();
  await writeDatabaseData(data);
  return data;
}

async function writeDatabaseData(data: AppData) {
  await ensureDatabaseSchema();
  const sql = getDb();
  await sql`
    insert into app_state (id, data, updated_at)
    values (${APP_STATE_ID}, ${JSON.stringify(data)}::jsonb, now())
    on conflict (id)
    do update set data = excluded.data, updated_at = now()
  `;
}
