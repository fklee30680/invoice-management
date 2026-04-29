import { sendEscalationNotification } from "./email";
import { statusesForEscalation } from "./status-config";
import { addAudit, createId, mutateData, readData } from "./store";
import type {
  AppData,
  EscalationRunSummary,
  EscalationSchedule,
  EscalationSchedulerSettings,
  EscalationTemplate,
  Holiday,
  Invoice,
  OrganizationEscalationContact,
} from "./types";
import { currencyDisplay, formatDate } from "./utils";

export type EscalationCandidate = {
  invoiceId: string;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  departmentId: string;
  departmentName: string;
  routedAt: string;
  scheduleId: string;
  scheduleName: string;
  scheduleDaysToNotify: number;
  templateId: string;
  templateName: string;
  businessDaysWaiting: number;
  to: string[];
  cc: string[];
  bcc: string[];
  warnings: string[];
  subject: string;
  body: string;
};

export type EscalationRunResult = {
  runAt: string;
  mode: "live" | "dry-run";
  candidates: EscalationCandidate[];
  skippedNoRecipientCount: number;
  sentCount: number;
  wouldSendCount: number;
  failedCount: number;
  errors: string[];
};

const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function datePartsInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    weekday: weekdayNames.indexOf(part("weekday")),
  };
}

function timeInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "00";
  return `${part("hour")}:${part("minute")}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isBusinessDay(
  date: string,
  weekday: number,
  settings: EscalationSchedulerSettings,
  holidays: Holiday[],
) {
  if (settings.excludedWeekdays.includes(weekday)) return false;
  if (!settings.excludeHolidays) return true;
  return !holidays.some((holiday) => holiday.enabled && holiday.date === date);
}

export function calculateBusinessDaysElapsed(
  startDate: string,
  endDate: string,
  settings: EscalationSchedulerSettings,
  holidays: Holiday[],
) {
  if (!startDate || !endDate) return 0;
  const timezone = settings.timezone || "America/New_York";
  const start = datePartsInTimezone(new Date(startDate), timezone).date;
  const end = datePartsInTimezone(new Date(endDate), timezone).date;
  if (!start || !end || end < start) return 0;

  let current = settings.countRoutedDateAsDayOne ? start : addDays(start, 1);
  let count = 0;
  while (current <= end) {
    const weekday = new Date(`${current}T00:00:00.000Z`).getUTCDay();
    if (isBusinessDay(current, weekday, settings, holidays)) count += 1;
    current = addDays(current, 1);
  }
  return count;
}

export function schedulerDayIsAllowed(settings: EscalationSchedulerSettings, now: Date) {
  const weekday = datePartsInTimezone(now, settings.timezone || "America/New_York").weekday;
  return settings.daysOfWeek.includes(weekday);
}

export function schedulerTimeIsDue(settings: EscalationSchedulerSettings, now: Date) {
  return timeInTimezone(now, settings.timezone || "America/New_York") >= settings.timeOfDay;
}

export function renderEscalationTemplate(
  template: Pick<EscalationTemplate, "subject" | "body" | "name">,
  values: Record<string, string>,
) {
  const render = (value: string) =>
    value.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, key: string) => values[key] || "");
  return {
    subject: render(template.subject),
    body: render(template.body),
  };
}

function sentForCycle(
  invoice: Invoice,
  routedAt: string,
  scheduleId: string,
  templateId: string,
) {
  return invoice.escalations.some(
    (event) =>
      event.routedAt === routedAt &&
      event.scheduleId === scheduleId &&
      event.templateId === templateId,
  );
}

function departmentName(data: AppData, departmentId: string) {
  return data.departments.find((department) => department.id === departmentId)?.name || "Unassigned";
}

function reviewLink(invoiceId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/review/${invoiceId}`;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function addRecipient(
  emails: string[],
  warnings: string[],
  email: string | undefined,
  label: string,
) {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) {
    warnings.push(`Missing recipient: ${label}.`);
    return;
  }
  if (!validEmail(normalized)) {
    warnings.push(`Invalid recipient skipped: ${label}.`);
    return;
  }
  emails.push(normalized);
}

function contactInScope(contact: OrganizationEscalationContact, departmentId: string) {
  if (contact.departmentScope.appliesToAllDepartments) return true;
  if (!departmentId) return false;
  return contact.departmentScope.departmentIds.includes(departmentId);
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function resolveRecipients(
  data: AppData,
  invoice: Invoice,
  schedule: EscalationSchedule,
  template: EscalationTemplate,
) {
  const department = data.departments.find((item) => item.id === invoice.departmentId);
  const warnings: string[] = [];
  const to: string[] = [];
  const cc: string[] = [];
  const bcc: string[] = [];

  if (template.recipientConfig.includeDepartmentEmail) {
    addRecipient(to, warnings, department?.email, "department email");
  }
  if (template.recipientConfig.includeDepartmentHeadEmail) {
    addRecipient(to, warnings, department?.departmentHeadEmail, "department head email");
  }
  if (template.recipientConfig.includeDepartmentEscalationEmail) {
    addRecipient(to, warnings, department?.escalationEmail, "department escalation email");
  }

  const orgContacts = data.organizationEscalationContacts.filter(
    (contact) => contact.enabled && contactInScope(contact, invoice.departmentId),
  );

  if (template.recipientConfig.includeOrganizationContactsForTriggeredSchedule) {
    for (const contact of orgContacts.filter((contact) =>
      contact.assignedScheduleIds.includes(schedule.id),
    )) {
      addRecipient(to, warnings, contact.email, contact.title || contact.name);
    }
  }

  for (const contactId of template.recipientConfig.specificOrganizationContactIds) {
    const contact = orgContacts.find((item) => item.id === contactId);
    addRecipient(to, warnings, contact?.email, contact?.title || contactId);
  }

  return {
    to: unique(to),
    cc,
    bcc,
    warnings,
  };
}

function organizationContactsForTemplate(
  data: AppData,
  invoice: Invoice,
  schedule: EscalationSchedule,
  template: EscalationTemplate,
) {
  const contacts = data.organizationEscalationContacts.filter(
    (contact) => contact.enabled && contactInScope(contact, invoice.departmentId),
  );
  const scheduled = template.recipientConfig.includeOrganizationContactsForTriggeredSchedule
    ? contacts.filter((contact) => contact.assignedScheduleIds.includes(schedule.id))
    : [];
  const specific = contacts.filter((contact) =>
    template.recipientConfig.specificOrganizationContactIds.includes(contact.id),
  );
  return [...scheduled, ...specific].filter(
    (contact, index, all) => all.findIndex((item) => item.id === contact.id) === index,
  );
}

function placeholderValues(
  data: AppData,
  invoice: Invoice,
  schedule: EscalationSchedule,
  template: EscalationTemplate,
  businessDaysWaiting: number,
) {
  const department = data.departments.find((item) => item.id === invoice.departmentId);
  const routedAt = invoice.routedAt || invoice.notificationSentAt || "";
  const contacts = organizationContactsForTemplate(data, invoice, schedule, template);
  return {
    vendor_name: invoice.vendorName || "Unknown Vendor",
    invoice_number: invoice.invoiceNumber || "Not set",
    po_number: invoice.poNumber || "Not set",
    amount: currencyDisplay(invoice.amount),
    department_name: department?.name || "Unassigned",
    review_link: reviewLink(invoice.id),
    routed_at: formatDate(routedAt),
    notification_sent_at: formatDate(invoice.notificationSentAt),
    escalation_schedule_name: schedule.name,
    escalation_schedule_days: String(schedule.daysToNotify),
    escalation_template_name: template.name,
    business_days_waiting: String(businessDaysWaiting),
    organization_contact_titles: contacts.map((contact) => contact.title).join(", "),
    organization_contact_names: contacts.map((contact) => contact.name).join(", "),
  };
}

function evaluateEscalations(data: AppData, now = new Date()) {
  const eligibleStatuses = statusesForEscalation(data);
  const schedules = [...data.escalationSchedules]
    .filter((schedule) => schedule.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const templates = [...data.escalationTemplates]
    .filter((template) => template.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const candidates: EscalationCandidate[] = [];
  const skippedMessages: string[] = [];

  for (const invoice of data.invoices) {
    if (!eligibleStatuses.includes(invoice.status)) continue;
    const routedAt = invoice.routedAt || invoice.notificationSentAt || "";
    if (!routedAt) continue;

    const businessDaysWaiting = calculateBusinessDaysElapsed(
      routedAt,
      now.toISOString(),
      data.escalationScheduler,
      data.holidays,
    );

    for (const schedule of schedules) {
      if (businessDaysWaiting < schedule.daysToNotify) continue;
      for (const template of templates.filter((item) =>
        item.scheduleIds.includes(schedule.id),
      )) {
        if (sentForCycle(invoice, routedAt, schedule.id, template.id)) continue;
        const recipients = resolveRecipients(data, invoice, schedule, template);
        if (recipients.to.length === 0) {
          skippedMessages.push(
            `${invoice.invoiceNumber || invoice.id}: ${schedule.name} / ${template.name} skipped; no valid recipients.`,
          );
          continue;
        }
        const rendered = renderEscalationTemplate(
          template,
          placeholderValues(data, invoice, schedule, template, businessDaysWaiting),
        );
        candidates.push({
          invoiceId: invoice.id,
          vendorName: invoice.vendorName || "Unknown Vendor",
          invoiceNumber: invoice.invoiceNumber || "Not set",
          invoiceDate: invoice.invoiceDate,
          departmentId: invoice.departmentId,
          departmentName: departmentName(data, invoice.departmentId),
          routedAt,
          scheduleId: schedule.id,
          scheduleName: schedule.name,
          scheduleDaysToNotify: schedule.daysToNotify,
          templateId: template.id,
          templateName: template.name,
          businessDaysWaiting,
          to: recipients.to,
          cc: recipients.cc,
          bcc: recipients.bcc,
          warnings: recipients.warnings,
          subject: rendered.subject,
          body: rendered.body,
        });
      }
    }
  }

  return { candidates, skippedMessages };
}

export function findEscalationCandidates(data: AppData, now = new Date()) {
  return evaluateEscalations(data, now).candidates;
}

export async function runEscalationCheck({
  dryRun,
  ignoreSchedule = false,
  now = new Date(),
}: {
  dryRun: boolean;
  ignoreSchedule?: boolean;
  now?: Date;
}): Promise<EscalationRunResult> {
  if (dryRun) {
    const data = await readData();
    const evaluation = evaluateEscalations(data, now);
    return {
      runAt: now.toISOString(),
      mode: "dry-run",
      candidates: evaluation.candidates,
      skippedNoRecipientCount: evaluation.skippedMessages.length,
      sentCount: 0,
      wouldSendCount: evaluation.candidates.length,
      failedCount: 0,
      errors: evaluation.skippedMessages,
    };
  }

  const result: EscalationRunResult = {
    runAt: now.toISOString(),
    mode: "live",
    candidates: [],
    skippedNoRecipientCount: 0,
    sentCount: 0,
    wouldSendCount: 0,
    failedCount: 0,
    errors: [],
  };

  const data = await readData();
  if (!ignoreSchedule) {
    if (
      !data.escalationScheduler.enabled ||
      !schedulerDayIsAllowed(data.escalationScheduler, now) ||
      !schedulerTimeIsDue(data.escalationScheduler, now)
    ) {
      await recordRunSummary(result);
      return result;
    }
  }

  const evaluation = evaluateEscalations(data, now);
  const candidates = evaluation.candidates;
  result.candidates = candidates;
  result.skippedNoRecipientCount = evaluation.skippedMessages.length;
  result.errors.push(...evaluation.skippedMessages);

  for (const candidate of candidates) {
    try {
      await sendEscalationNotification({
        invoiceId: candidate.invoiceId,
        subject: candidate.subject,
        body: candidate.body,
        link: reviewLink(candidate.invoiceId),
        to: candidate.to,
        cc: candidate.cc,
        bcc: candidate.bcc,
        escalationLevel: candidate.scheduleName,
        templateId: candidate.templateId,
      });

      await mutateData((current) => {
        const invoice = current.invoices.find((item) => item.id === candidate.invoiceId);
        if (!invoice) return;
        if (sentForCycle(invoice, candidate.routedAt, candidate.scheduleId, candidate.templateId)) {
          return;
        }
        invoice.escalations.push({
          id: createId("escalation-event"),
          invoiceId: invoice.id,
          routedAt: candidate.routedAt,
          scheduleId: candidate.scheduleId,
          scheduleName: candidate.scheduleName,
          templateId: candidate.templateId,
          templateName: candidate.templateName,
          sentAt: now.toISOString(),
          daysToNotify: candidate.scheduleDaysToNotify,
          businessDaysWaiting: candidate.businessDaysWaiting,
          departmentId: candidate.departmentId,
          departmentName: candidate.departmentName,
          vendorName: candidate.vendorName,
          invoiceNumber: candidate.invoiceNumber,
          recipients: [...candidate.to, ...candidate.cc, ...candidate.bcc],
          statusAtSend: invoice.status,
        });
        invoice.updatedAt = now.toISOString();
        addAudit(current, {
          invoiceId: invoice.id,
          actor: "System",
          type: "escalation_sent",
          message:
            `Escalation sent for ${candidate.vendorName} invoice ${candidate.invoiceNumber}; ` +
            `${candidate.departmentName}; schedule ${candidate.scheduleName}; ` +
            `template ${candidate.templateName}; days ${candidate.scheduleDaysToNotify}; ` +
            `business days waiting ${candidate.businessDaysWaiting}; recipients ${[
              ...candidate.to,
              ...candidate.cc,
              ...candidate.bcc,
            ].join(", ")}.`,
        });
      });
      result.sentCount += 1;
    } catch (error) {
      result.failedCount += 1;
      result.errors.push(
        `${candidate.invoiceNumber}: ${
          error instanceof Error ? error.message : "Escalation send failed"
        }`,
      );
    }
  }

  await recordRunSummary(result);
  return result;
}

export async function recordRunSummary(result: EscalationRunResult) {
  const summary: EscalationRunSummary = {
    id: createId("escalation-run"),
    runAt: result.runAt,
    mode: result.mode,
    sentCount: result.sentCount,
    wouldSendCount: result.mode === "dry-run" ? result.wouldSendCount : result.candidates.length,
    failedCount: result.failedCount,
    skippedCount: result.skippedNoRecipientCount,
    errors: result.errors,
  };
  await mutateData((data) => {
    data.escalationRunSummaries.unshift(summary);
    data.escalationRunSummaries = data.escalationRunSummaries.slice(0, 20);
  });
}
