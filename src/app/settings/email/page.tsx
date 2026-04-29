import Link from "next/link";
import {
  addEscalationTemplate,
  addHoliday,
  deleteEscalationTemplate,
  deleteHoliday,
  runEscalationsNow,
  sendTestEscalationEmail,
  updateEscalationSchedulerSettings,
  updateEscalationTemplate,
  updateHoliday,
  updateNotificationTemplate,
} from "@/lib/actions";
import {
  renderEscalationTemplate,
  runEscalationCheck,
  type EscalationCandidate,
} from "@/lib/escalations";
import { readData } from "@/lib/store";
import type { EscalationRecipientConfig, EscalationRecipientType } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmailSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const recipientOptions: { value: EscalationRecipientType; label: string }[] = [
  { value: "departmentEmail", label: "Department email" },
  { value: "departmentHeadEmail", label: "Department head email" },
  { value: "departmentEscalationEmail", label: "Department escalation email" },
  { value: "apSupervisorEmail", label: "AP supervisor email" },
  { value: "cfoEmail", label: "CFO email" },
  { value: "executiveEmail", label: "Executive email" },
  { value: "customEmail", label: "Custom email" },
];

const weekdays = [
  ["0", "Sunday"],
  ["1", "Monday"],
  ["2", "Tuesday"],
  ["3", "Wednesday"],
  ["4", "Thursday"],
  ["5", "Friday"],
  ["6", "Saturday"],
];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function Checkbox({
  label,
  name,
  defaultChecked,
  form,
  value,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  form?: string;
  value?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium normal-case text-[var(--foreground)]">
      <input
        className="h-4 w-4 accent-[var(--accent)]"
        defaultChecked={defaultChecked}
        form={form}
        name={name}
        type="checkbox"
        value={value}
      />
      {label}
    </label>
  );
}

function TextInput({
  defaultValue,
  form,
  label,
  name,
  placeholder,
  required,
  type = "text",
}: {
  defaultValue?: string | number;
  form?: string;
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="text-xs font-semibold uppercase text-[var(--muted)]">
      {label}
      <input
        className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
        defaultValue={defaultValue}
        form={form}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}

function RecipientSelector({
  configs,
  form,
  name,
}: {
  configs: EscalationRecipientConfig[];
  form?: string;
  name: "toRecipients" | "ccRecipients" | "bccRecipients";
}) {
  const selected = new Set(configs.map((config) => config.type));
  const custom = configs.find((config) => config.type === "customEmail")?.customEmail || "";

  return (
    <div className="grid gap-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {recipientOptions.map((option) => (
          <Checkbox
            defaultChecked={selected.has(option.value)}
            form={form}
            key={option.value}
            label={option.label}
            name={name}
            value={option.value}
          />
        ))}
      </div>
      <input
        className="focus-ring min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm"
        defaultValue={custom}
        form={form}
        name={`${name}Custom`}
        placeholder="custom@example.com"
        type="email"
      />
    </div>
  );
}

function CandidateTable({ candidates }: { candidates: EscalationCandidate[] }) {
  return (
    <div className="overflow-x-auto border border-[var(--line)] bg-white">
      <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
        <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
          <tr>
            <th className="border-b border-[var(--line)] px-3 py-3">Routed</th>
            <th className="border-b border-[var(--line)] px-3 py-3">Vendor</th>
            <th className="border-b border-[var(--line)] px-3 py-3">Invoice</th>
            <th className="border-b border-[var(--line)] px-3 py-3">Department</th>
            <th className="border-b border-[var(--line)] px-3 py-3">Escalation</th>
            <th className="border-b border-[var(--line)] px-3 py-3">Business Days</th>
            <th className="border-b border-[var(--line)] px-3 py-3">Recipients</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => (
            <tr className="align-top hover:bg-slate-50" key={`${candidate.invoiceId}-${candidate.templateId}`}>
              <td className="border-b border-[var(--line)] px-3 py-3">
                {formatDate(candidate.routedAt)}
              </td>
              <td className="border-b border-[var(--line)] px-3 py-3">
                {candidate.vendorName}
              </td>
              <td className="border-b border-[var(--line)] px-3 py-3">
                {candidate.invoiceNumber}
              </td>
              <td className="border-b border-[var(--line)] px-3 py-3">
                {candidate.departmentName}
              </td>
              <td className="border-b border-[var(--line)] px-3 py-3">
                {candidate.escalationLevel}
                <div className="text-xs text-[var(--muted)]">{candidate.templateName}</div>
              </td>
              <td className="border-b border-[var(--line)] px-3 py-3">
                {candidate.businessDaysWaiting} / {candidate.daysToNotify}
              </td>
              <td className="border-b border-[var(--line)] px-3 py-3">
                {[...candidate.to, ...candidate.cc, ...candidate.bcc].join(", ")}
                {candidate.warnings.length ? (
                  <div className="mt-1 text-xs text-amber-700">
                    {candidate.warnings.join(" ")}
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
          {candidates.length === 0 ? (
            <tr>
              <td className="px-3 py-8 text-center text-[var(--muted)]" colSpan={7}>
                No invoices would escalate with the current setup.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export default async function EmailSettingsPage({
  searchParams,
}: EmailSettingsPageProps) {
  const query = (await searchParams) || {};
  const data = await readData();
  const previewTemplateId = one(query.previewTemplate) || data.escalationTemplates[0]?.id || "";
  const previewTemplate = data.escalationTemplates.find(
    (template) => template.id === previewTemplateId,
  );
  const preview = previewTemplate
    ? renderEscalationTemplate(previewTemplate, {
        vendor_name: "Sample Vendor",
        invoice_number: "INV-1001",
        po_number: "PO-1001",
        amount: "$1,250.00",
        department_name: "Sample Department",
        review_link: "https://example.com/review/sample",
        escalation_level: previewTemplate.escalationLevel,
        days_waiting: String(previewTemplate.daysToNotify),
        business_days_waiting: String(previewTemplate.daysToNotify),
        routed_at: "Apr 26, 2026",
        notification_sent_at: "Apr 26, 2026",
        department_head_name: "Department Head",
        department_escalation_name: "Department Escalation",
        ap_supervisor_name: data.organizationEscalationContacts.apSupervisorName,
        cfo_name: data.organizationEscalationContacts.cfoName,
        executive_name: data.organizationEscalationContacts.executiveName,
      })
    : null;
  const dryRun = one(query.dryRun) === "1" ? await runEscalationCheck({ dryRun: true }) : null;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Email Templates</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Configure department notification emails, escalation templates,
          scheduler rules, holidays, previews, and manual escalation runs.
        </p>
      </div>

      <form
        action={updateNotificationTemplate}
        className="grid gap-4 border border-[var(--line)] bg-[var(--panel)] p-4"
      >
        <h3 className="font-semibold">Department Notification Template</h3>
        <div className="border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--muted)]">
          Placeholders: {"{{vendor_name}}"}, {"{{invoice_number}}"}, {"{{po_number}}"},{" "}
          {"{{amount}}"}, {"{{department_name}}"}, {"{{review_link}}"}
        </div>
        <TextInput
          defaultValue={data.notificationTemplate.departmentSubject}
          label="Department Subject"
          name="departmentSubject"
          required
        />
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Department Body
          <textarea
            className="focus-ring mt-1 min-h-44 w-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-normal normal-case text-[var(--foreground)]"
            name="departmentBody"
            defaultValue={data.notificationTemplate.departmentBody}
            required
          />
        </label>
        <div className="flex justify-end">
          <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Save Department Template
          </button>
        </div>
      </form>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Escalation Email Templates</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            AP defines the escalation schedule here. No escalation emails are sent
            until at least one enabled template is configured.
          </p>
        </div>

        <form
          action={addEscalationTemplate}
          className="grid gap-3 border border-[var(--line)] bg-[var(--panel)] p-4"
        >
          <h4 className="font-semibold">Add Escalation Template</h4>
          <div className="grid gap-3 md:grid-cols-4">
            <TextInput label="Template Name" name="name" required />
            <TextInput label="Escalation Level" name="escalationLevel" required />
            <TextInput defaultValue={1} label="Days To Notify" name="daysToNotify" required type="number" />
            <TextInput defaultValue={data.escalationTemplates.length + 1} label="Sort Order" name="sortOrder" type="number" />
          </div>
          <Checkbox defaultChecked label="Enabled" name="enabled" />
          <TextInput label="Subject" name="subject" required />
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Body
            <textarea
              className="focus-ring mt-1 min-h-36 w-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-normal normal-case text-[var(--foreground)]"
              name="body"
              required
            />
          </label>
          <div className="grid gap-4 lg:grid-cols-3">
            <fieldset className="border border-[var(--line)] bg-white p-3">
              <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">To Recipients</legend>
              <RecipientSelector configs={[]} name="toRecipients" />
            </fieldset>
            <fieldset className="border border-[var(--line)] bg-white p-3">
              <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">CC Recipients</legend>
              <RecipientSelector configs={[]} name="ccRecipients" />
            </fieldset>
            <fieldset className="border border-[var(--line)] bg-white p-3">
              <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">BCC Recipients</legend>
              <RecipientSelector configs={[]} name="bccRecipients" />
            </fieldset>
          </div>
          <div className="flex justify-end">
            <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
              Add Escalation Template
            </button>
          </div>
        </form>

        <div className="grid gap-4">
          {data.escalationTemplates.map((template) => {
            const formId = `template-${template.id}`;
            return (
              <article className="border border-[var(--line)] bg-[var(--panel)] p-4" key={template.id}>
                <form action={updateEscalationTemplate} className="grid gap-3" id={formId}>
                  <input name="templateId" type="hidden" value={template.id} />
                  <div className="grid gap-3 md:grid-cols-4">
                    <TextInput defaultValue={template.name} form={formId} label="Template Name" name="name" required />
                    <TextInput defaultValue={template.escalationLevel} form={formId} label="Escalation Level" name="escalationLevel" required />
                    <TextInput defaultValue={template.daysToNotify} form={formId} label="Days To Notify" name="daysToNotify" required type="number" />
                    <TextInput defaultValue={template.sortOrder} form={formId} label="Sort Order" name="sortOrder" type="number" />
                  </div>
                  <Checkbox defaultChecked={template.enabled} form={formId} label="Enabled" name="enabled" />
                  <TextInput defaultValue={template.subject} form={formId} label="Subject" name="subject" required />
                  <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                    Body
                    <textarea
                      className="focus-ring mt-1 min-h-36 w-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-normal normal-case text-[var(--foreground)]"
                      defaultValue={template.body}
                      form={formId}
                      name="body"
                      required
                    />
                  </label>
                  <div className="grid gap-4 lg:grid-cols-3">
                    <fieldset className="border border-[var(--line)] bg-white p-3">
                      <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">To Recipients</legend>
                      <RecipientSelector configs={template.toRecipients} form={formId} name="toRecipients" />
                    </fieldset>
                    <fieldset className="border border-[var(--line)] bg-white p-3">
                      <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">CC Recipients</legend>
                      <RecipientSelector configs={template.ccRecipients} form={formId} name="ccRecipients" />
                    </fieldset>
                    <fieldset className="border border-[var(--line)] bg-white p-3">
                      <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">BCC Recipients</legend>
                      <RecipientSelector configs={template.bccRecipients} form={formId} name="bccRecipients" />
                    </fieldset>
                  </div>
                </form>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
                  <button className="focus-ring border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-teal-50" form={formId}>
                    Save
                  </button>
                  <form action={deleteEscalationTemplate}>
                    <input name="templateId" type="hidden" value={template.id} />
                    <button className="focus-ring border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                      Delete
                    </button>
                  </form>
                  <Link className="focus-ring border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-slate-100" href={`/settings/email?previewTemplate=${template.id}`}>
                    Preview
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <form
        action={updateEscalationSchedulerSettings}
        className="grid gap-4 border border-[var(--line)] bg-[var(--panel)] p-4"
      >
        <h3 className="text-lg font-semibold">Escalation Scheduler</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <TextInput defaultValue={data.escalationScheduler.timeOfDay} label="Scheduler Time" name="timeOfDay" type="time" />
          <TextInput defaultValue={data.escalationScheduler.timezone} label="Scheduler Timezone" name="timezone" />
          <div className="self-end">
            <Checkbox defaultChecked={data.escalationScheduler.enabled} label="Enable escalation scheduler" name="enabled" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <fieldset className="border border-[var(--line)] bg-white p-3">
            <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">Scheduler Days</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {weekdays.map(([value, label]) => (
                <Checkbox
                  defaultChecked={data.escalationScheduler.daysOfWeek.includes(Number(value))}
                  key={value}
                  label={label}
                  name="daysOfWeek"
                  value={value}
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="border border-[var(--line)] bg-white p-3">
            <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">Business Day Settings</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {weekdays.map(([value, label]) => (
                <Checkbox
                  defaultChecked={data.escalationScheduler.excludedWeekdays.includes(Number(value))}
                  key={value}
                  label={`Exclude ${label}`}
                  name="excludedWeekdays"
                  value={value}
                />
              ))}
              <Checkbox defaultChecked={data.escalationScheduler.excludeHolidays} label="Exclude configured holidays" name="excludeHolidays" />
              <Checkbox defaultChecked={data.escalationScheduler.countRoutedDateAsDayOne} label="Count routed date as day one" name="countRoutedDateAsDayOne" />
            </div>
          </fieldset>
        </div>
        <h4 className="font-semibold">Organization Escalation Contacts</h4>
        <div className="grid gap-3 md:grid-cols-3">
          <TextInput defaultValue={data.organizationEscalationContacts.apSupervisorTitle} label="AP Supervisor Title" name="apSupervisorTitle" />
          <TextInput defaultValue={data.organizationEscalationContacts.apSupervisorName} label="AP Supervisor Name" name="apSupervisorName" />
          <TextInput defaultValue={data.organizationEscalationContacts.apSupervisorEmail} label="AP Supervisor Email" name="apSupervisorEmail" type="email" />
          <TextInput defaultValue={data.organizationEscalationContacts.cfoTitle} label="CFO Title" name="cfoTitle" />
          <TextInput defaultValue={data.organizationEscalationContacts.cfoName} label="CFO Name" name="cfoName" />
          <TextInput defaultValue={data.organizationEscalationContacts.cfoEmail} label="CFO Email" name="cfoEmail" type="email" />
          <TextInput defaultValue={data.organizationEscalationContacts.executiveTitle} label="Executive Title" name="executiveTitle" />
          <TextInput defaultValue={data.organizationEscalationContacts.executiveName} label="Executive Name" name="executiveName" />
          <TextInput defaultValue={data.organizationEscalationContacts.executiveEmail} label="Executive Email" name="executiveEmail" type="email" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Save Scheduler Settings
          </button>
          <Link className="focus-ring inline-flex items-center justify-center border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100" href="/settings/email?dryRun=1">
            Preview Escalation Run
          </Link>
        </div>
      </form>

      <section className="grid gap-4 border border-[var(--line)] bg-[var(--panel)] p-4">
        <h3 className="text-lg font-semibold">Holidays</h3>
        <form action={addHoliday} className="grid gap-3 md:grid-cols-[160px_1fr_1fr_auto_auto]">
          <TextInput label="Holiday Date" name="date" required type="date" />
          <TextInput label="Holiday Name" name="name" required />
          <TextInput label="Notes" name="notes" />
          <div className="self-end">
            <Checkbox defaultChecked label="Enabled" name="enabled" />
          </div>
          <button className="focus-ring self-end bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Add Holiday
          </button>
        </form>
        <div className="grid gap-3">
          {data.holidays.map((holiday) => {
            const formId = `holiday-${holiday.id}`;
            return (
              <div className="grid gap-2 border border-[var(--line)] bg-white p-3 md:grid-cols-[160px_1fr_1fr_auto_auto]" key={holiday.id}>
                <form action={updateHoliday} className="contents" id={formId}>
                  <input name="holidayId" type="hidden" value={holiday.id} />
                  <TextInput defaultValue={holiday.date} form={formId} label="Date" name="date" required type="date" />
                  <TextInput defaultValue={holiday.name} form={formId} label="Name" name="name" required />
                  <TextInput defaultValue={holiday.notes} form={formId} label="Notes" name="notes" />
                  <div className="self-end">
                    <Checkbox defaultChecked={holiday.enabled} form={formId} label="Enabled" name="enabled" />
                  </div>
                </form>
                <div className="flex gap-2 self-end">
                  <button className="focus-ring border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-teal-50" form={formId}>
                    Save
                  </button>
                  <form action={deleteHoliday}>
                    <input name="holidayId" type="hidden" value={holiday.id} />
                    <button className="focus-ring border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 border border-[var(--line)] bg-[var(--panel)] p-4">
        <h3 className="text-lg font-semibold">Preview And Testing</h3>
        <form className="grid gap-3 md:grid-cols-[1fr_auto]" method="get">
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Preview Template
            <select className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" name="previewTemplate" defaultValue={previewTemplateId}>
              {data.escalationTemplates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </label>
          <button className="focus-ring self-end border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100">
            Preview Template
          </button>
        </form>
        {preview ? (
          <div className="border border-[var(--line)] bg-white p-4">
            <div className="text-sm font-semibold">{preview.subject}</div>
            <pre className="mt-3 whitespace-pre-wrap text-sm text-[var(--foreground)]">{preview.body}</pre>
          </div>
        ) : (
          <div className="border border-dashed border-[var(--line)] bg-white p-6 text-center text-sm text-[var(--muted)]">
            Add an escalation template to preview or test escalation email content.
          </div>
        )}
        <form action={sendTestEscalationEmail} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Template
            <select className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" name="templateId" required>
              {data.escalationTemplates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </label>
          <TextInput label="Send Test To" name="testEmail" required type="email" />
          <button className="focus-ring self-end border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-teal-50">
            Send Test
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          <Link className="focus-ring inline-flex items-center justify-center border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100" href="/settings/email?dryRun=1">
            Dry Run
          </Link>
          <form action={runEscalationsNow}>
            <button className="focus-ring bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              Run Escalation Check Now
            </button>
          </form>
        </div>
        {dryRun ? (
          <div className="space-y-3">
            <div className="text-sm text-[var(--muted)]">
              Dry run at {formatDateTime(dryRun.runAt)}. {dryRun.wouldSendCount} emails would be sent.
            </div>
            <CandidateTable candidates={dryRun.candidates} />
          </div>
        ) : null}
      </section>

      <section className="border border-[var(--line)] bg-[var(--panel)] p-4">
        <h3 className="text-lg font-semibold">Scheduler Run Summary</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-left text-sm">
            <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="border-b border-[var(--line)] px-3 py-3">Run Date</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Mode</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Sent</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Would Send</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Failed</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Errors</th>
              </tr>
            </thead>
            <tbody>
              {data.escalationRunSummaries.map((summary) => (
                <tr className="align-top hover:bg-slate-50" key={summary.id}>
                  <td className="border-b border-[var(--line)] px-3 py-3">{formatDateTime(summary.runAt)}</td>
                  <td className="border-b border-[var(--line)] px-3 py-3">{summary.mode}</td>
                  <td className="border-b border-[var(--line)] px-3 py-3">{summary.sentCount}</td>
                  <td className="border-b border-[var(--line)] px-3 py-3">{summary.wouldSendCount}</td>
                  <td className="border-b border-[var(--line)] px-3 py-3">{summary.failedCount}</td>
                  <td className="border-b border-[var(--line)] px-3 py-3">{summary.errors.join(" ") || "None"}</td>
                </tr>
              ))}
              {data.escalationRunSummaries.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-[var(--muted)]" colSpan={6}>
                    No escalation scheduler runs have been recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
