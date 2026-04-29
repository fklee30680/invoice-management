import { sendEscalationNotification } from "./email";
import { statusesForEscalation } from "./status-config";
import { addAudit, createId, mutateData, readData } from "./store";
import type {
  AppData,
  EscalationRecipientConfig,
  EscalationRunSummary,
  EscalationSchedulerSettings,
  EscalationTemplate,
  Holiday,
  Invoice,
} from "./types";
import { currencyDisplay, formatDate } from "./utils";

export type EscalationCandidate = {
  invoiceId: string;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  departmentName: string;
  routedAt: string;
  templateId: string;
  templateName: string;
  escalationLevel: string;
  daysToNotify: number;
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

function compareDate(left: string, right: string) {
  return left.localeCompare(right);
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
  if (!start || !end || compareDate(end, start) < 0) return 0;

  let current = settings.countRoutedDateAsDayOne ? start : addDays(start, 1);
  let count = 0;
  while (compareDate(current, end) <= 0) {
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
  template: Pick<EscalationTemplate, "subject" | "body" | "escalationLevel">,
  values: Record<string, string>,
) {
  const render = (value: string) =>
    value.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, key: string) => values[key] || "");
  return {
    subject: render(template.subject),
    body: render(template.body),
  };
}

function templateSentForCycle(invoice: Invoice, templateId: string, routedAt: string) {
  return invoice.escalations.some(
    (event) => event.templateId === templateId && event.routedAt === routedAt,
  );
}

function departmentName(data: AppData, departmentId: string) {
  return data.departments.find((department) => department.id === departmentId)?.name || "Unassigned";
}

function reviewLink(invoiceId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/review/${invoiceId}`;
}

function recipientValue(
  data: AppData,
  invoice: Invoice,
  recipient: EscalationRecipientConfig,
) {
  const department = data.departments.find((item) => item.id === invoice.departmentId);
  const org = data.organizationEscalationContacts;
  if (recipient.type === "departmentEmail") return department?.email || "";
  if (recipient.type === "departmentHeadEmail") return department?.departmentHeadEmail || "";
  if (recipient.type === "departmentEscalationEmail") return department?.escalationEmail || "";
  if (recipient.type === "apSupervisorEmail") return org.apSupervisorEmail;
  if (recipient.type === "cfoEmail") return org.cfoEmail;
  if (recipient.type === "executiveEmail") return org.executiveEmail;
  return recipient.customEmail || "";
}

function recipientLabel(recipient: EscalationRecipientConfig) {
  if (recipient.type === "customEmail") return recipient.customEmail || "custom email";
  return recipient.type;
}

function resolveRecipients(
  data: AppData,
  invoice: Invoice,
  recipients: EscalationRecipientConfig[],
) {
  const warnings: string[] = [];
  const emails = recipients
    .map((recipient) => {
      const email = recipientValue(data, invoice, recipient).trim().toLowerCase();
      if (!email) warnings.push(`Missing recipient: ${recipientLabel(recipient)}.`);
      return email;
    })
    .filter(Boolean);
  return {
    emails: Array.from(new Set(emails)),
    warnings,
  };
}

function placeholderValues(
  data: AppData,
  invoice: Invoice,
  template: EscalationTemplate,
  businessDaysWaiting: number,
) {
  const department = data.departments.find((item) => item.id === invoice.departmentId);
  const org = data.organizationEscalationContacts;
  const routedAt = invoice.routedAt || invoice.notificationSentAt || "";
  return {
    vendor_name: invoice.vendorName || "Unknown Vendor",
    invoice_number: invoice.invoiceNumber || "Not set",
    po_number: invoice.poNumber || "Not set",
    amount: currencyDisplay(invoice.amount),
    department_name: department?.name || "Unassigned",
    review_link: reviewLink(invoice.id),
    escalation_level: template.escalationLevel,
    days_waiting: String(businessDaysWaiting),
    business_days_waiting: String(businessDaysWaiting),
    routed_at: formatDate(routedAt),
    notification_sent_at: formatDate(invoice.notificationSentAt),
    department_head_name: department?.departmentHeadName || "",
    department_escalation_name: department?.escalationName || "",
    ap_supervisor_name: org.apSupervisorName,
    cfo_name: org.cfoName,
    executive_name: org.executiveName,
  };
}

export function findEscalationCandidates(
  data: AppData,
  now = new Date(),
) {
  const eligibleStatuses = statusesForEscalation(data);
  const templates = [...data.escalationTemplates]
    .filter((template) => template.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const candidates: EscalationCandidate[] = [];

  for (const invoice of data.invoices) {
    if (!invoice.departmentId) continue;
    if (!eligibleStatuses.includes(invoice.status)) continue;
    const routedAt = invoice.routedAt || invoice.notificationSentAt || "";
    if (!routedAt) continue;

    const businessDaysWaiting = calculateBusinessDaysElapsed(
      routedAt,
      now.toISOString(),
      data.escalationScheduler,
      data.holidays,
    );

    for (const template of templates) {
      if (businessDaysWaiting < template.daysToNotify) continue;
      if (templateSentForCycle(invoice, template.id, routedAt)) continue;

      const to = resolveRecipients(data, invoice, template.toRecipients);
      const cc = resolveRecipients(data, invoice, template.ccRecipients);
      const bcc = resolveRecipients(data, invoice, template.bccRecipients);
      if (to.emails.length === 0) continue;
      const rendered = renderEscalationTemplate(
        template,
        placeholderValues(data, invoice, template, businessDaysWaiting),
      );

      candidates.push({
        invoiceId: invoice.id,
        vendorName: invoice.vendorName || "Unknown Vendor",
        invoiceNumber: invoice.invoiceNumber || "Not set",
        invoiceDate: invoice.invoiceDate,
        departmentName: departmentName(data, invoice.departmentId),
        routedAt,
        templateId: template.id,
        templateName: template.name,
        escalationLevel: template.escalationLevel,
        daysToNotify: template.daysToNotify,
        businessDaysWaiting,
        to: to.emails,
        cc: cc.emails,
        bcc: bcc.emails,
        warnings: [...to.warnings, ...cc.warnings, ...bcc.warnings],
        subject: rendered.subject,
        body: rendered.body,
      });
    }
  }

  return candidates;
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
    const candidates = findEscalationCandidates(data, now);
    return {
      runAt: now.toISOString(),
      mode: "dry-run",
      candidates,
      sentCount: 0,
      wouldSendCount: candidates.length,
      failedCount: 0,
      errors: [],
    };
  }

  const result: EscalationRunResult = {
    runAt: now.toISOString(),
    mode: "live",
    candidates: [],
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

  const candidates = findEscalationCandidates(data, now);
  result.candidates = candidates;

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
        escalationLevel: candidate.escalationLevel,
        templateId: candidate.templateId,
      });

      await mutateData((current) => {
        const invoice = current.invoices.find((item) => item.id === candidate.invoiceId);
        if (!invoice) return;
        if (templateSentForCycle(invoice, candidate.templateId, candidate.routedAt)) return;
        invoice.escalations.push({
          id: createId("escalation-event"),
          templateId: candidate.templateId,
          escalationLevel: candidate.escalationLevel,
          sentAt: now.toISOString(),
          routedAt: candidate.routedAt,
          daysToNotify: candidate.daysToNotify,
          businessDaysWaiting: candidate.businessDaysWaiting,
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
            `${candidate.departmentName}; level ${candidate.escalationLevel}; ` +
            `template ${candidate.templateName}; days ${candidate.daysToNotify}; ` +
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
    errors: result.errors,
  };
  await mutateData((data) => {
    data.escalationRunSummaries.unshift(summary);
    data.escalationRunSummaries = data.escalationRunSummaries.slice(0, 20);
  });
}
