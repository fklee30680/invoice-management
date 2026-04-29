import Link from "next/link";
import {
  DepartmentRecipientMultiSelect,
  OrganizationContactMultiSelect,
} from "@/components/email-template-recipient-selects";
import { ScheduleMultiSelect } from "@/components/schedule-multi-select";
import {
  addEscalationTemplate,
  deleteEscalationTemplate,
  sendTestEscalationEmail,
  updateEscalationTemplate,
  updateNotificationTemplate,
} from "@/lib/actions";
import {
  renderEscalationTemplate,
  runEscalationCheck,
  type EscalationCandidate,
} from "@/lib/escalations";
import { readData } from "@/lib/store";
import type { EscalationRecipientConfig, EscalationTemplate } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EmailSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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
  required,
  type = "text",
}: {
  defaultValue?: string | number;
  form?: string;
  label: string;
  name: string;
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
        required={required}
        type={type}
      />
    </label>
  );
}

function TextArea({
  defaultValue,
  form,
  label,
  name,
  required,
}: {
  defaultValue?: string;
  form?: string;
  label: string;
  name: string;
  required?: boolean;
}) {
  return (
    <label className="text-xs font-semibold uppercase text-[var(--muted)]">
      {label}
      <textarea
        className="focus-ring mt-1 min-h-36 w-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-normal normal-case text-[var(--foreground)]"
        defaultValue={defaultValue}
        form={form}
        name={name}
        required={required}
      />
    </label>
  );
}

function PlaceholderReference() {
  return (
    <details className="border border-[var(--line)] bg-white px-3 py-2 text-sm">
      <summary className="cursor-pointer font-semibold">Available placeholders</summary>
      <div className="mt-2 grid gap-1 text-xs text-[var(--muted)] sm:grid-cols-2 lg:grid-cols-3">
        {[
          "{{vendor_name}}",
          "{{invoice_number}}",
          "{{po_number}}",
          "{{amount}}",
          "{{department_name}}",
          "{{review_link}}",
          "{{routed_at}}",
          "{{notification_sent_at}}",
          "{{escalation_schedule_name}}",
          "{{escalation_schedule_days}}",
          "{{escalation_template_name}}",
          "{{business_days_waiting}}",
          "{{organization_contact_titles}}",
          "{{organization_contact_names}}",
        ].map((placeholder) => (
          <code key={placeholder}>{placeholder}</code>
        ))}
      </div>
    </details>
  );
}

function RecipientConfigFields({
  config,
  data,
}: {
  config: EscalationRecipientConfig;
  data: Awaited<ReturnType<typeof readData>>;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div>
        <div className="text-xs font-semibold uppercase text-[var(--muted)]">
          Department Recipients
        </div>
        <div className="mt-1">
          <DepartmentRecipientMultiSelect config={config} />
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase text-[var(--muted)]">
          Organization Contacts
        </div>
        <div className="mt-1">
          <OrganizationContactMultiSelect
            config={config}
            contacts={data.organizationEscalationContacts}
          />
        </div>
      </div>
    </div>
  );
}

function scheduleSummary(
  scheduleIds: string[],
  schedules: Awaited<ReturnType<typeof readData>>["escalationSchedules"],
) {
  const names = scheduleIds.map((id) => {
    const schedule = schedules.find((item) => item.id === id);
    if (!schedule) return `${id} (inactive)`;
    return schedule.enabled ? schedule.name : `${schedule.name} (inactive)`;
  });
  if (names.length <= 2) return names.join(", ") || "No schedules selected";
  return `${names.length} schedules selected`;
}

function departmentRecipientSummary(config: EscalationRecipientConfig) {
  const labels = [
    config.includeDepartmentEmail ? "Department Email" : "",
    config.includeDepartmentHeadEmail ? "Department Head" : "",
    config.includeDepartmentEscalationEmail ? "Department Escalation" : "",
  ].filter(Boolean);
  if (labels.length <= 2) return labels.join(", ") || "None selected";
  return `${labels.length} department recipients selected`;
}

function organizationContactSummary(
  config: EscalationRecipientConfig,
  contacts: Awaited<ReturnType<typeof readData>>["organizationEscalationContacts"],
) {
  const labels = [
    config.includeOrganizationContactsForTriggeredSchedule
      ? "Assigned contacts for triggered schedule"
      : "",
    ...config.specificOrganizationContactIds.map((id) => {
      const contact = contacts.find((item) => item.id === id);
      if (!contact) return `${id} (inactive)`;
      return contact.enabled
        ? `${contact.title} - ${contact.name}`
        : `${contact.title} - ${contact.name} (inactive)`;
    }),
  ].filter(Boolean);
  if (labels.length <= 1) return labels.join("") || "None selected";
  return `${labels.length} organization contact options selected`;
}

function TemplateSummary({
  data,
  template,
}: {
  data: Awaited<ReturnType<typeof readData>>;
  template: EscalationTemplate;
}) {
  return (
    <div className="grid gap-3 border-b border-[var(--line)] pb-3 text-sm lg:grid-cols-[1.3fr_1.2fr_1.4fr_1.6fr_auto]">
      <div>
        <div className="text-xs font-semibold uppercase text-[var(--muted)]">Template Name</div>
        <div>{template.name}</div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase text-[var(--muted)]">Assigned Schedules</div>
        <div>{scheduleSummary(template.scheduleIds, data.escalationSchedules)}</div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase text-[var(--muted)]">Department Recipients</div>
        <div>{departmentRecipientSummary(template.recipientConfig)}</div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase text-[var(--muted)]">Organization Contacts</div>
        <div>{organizationContactSummary(template.recipientConfig, data.organizationEscalationContacts)}</div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase text-[var(--muted)]">Status</div>
        <div>{template.enabled ? "Enabled" : "Disabled"}</div>
      </div>
    </div>
  );
}

function CandidateTable({ candidates }: { candidates: EscalationCandidate[] }) {
  return (
    <div className="overflow-x-auto border border-[var(--line)] bg-white">
      <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
        <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
          <tr>
            <th className="border-b border-[var(--line)] px-3 py-3">Invoice</th>
            <th className="border-b border-[var(--line)] px-3 py-3">Vendor</th>
            <th className="border-b border-[var(--line)] px-3 py-3">Department</th>
            <th className="border-b border-[var(--line)] px-3 py-3">Routed</th>
            <th className="border-b border-[var(--line)] px-3 py-3">Schedule</th>
            <th className="border-b border-[var(--line)] px-3 py-3">Template</th>
            <th className="border-b border-[var(--line)] px-3 py-3">Recipients</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => (
            <tr className="align-top hover:bg-slate-50" key={`${candidate.invoiceId}-${candidate.scheduleId}-${candidate.templateId}`}>
              <td className="border-b border-[var(--line)] px-3 py-3">{candidate.invoiceNumber}</td>
              <td className="border-b border-[var(--line)] px-3 py-3">{candidate.vendorName}</td>
              <td className="border-b border-[var(--line)] px-3 py-3">{candidate.departmentName}</td>
              <td className="border-b border-[var(--line)] px-3 py-3">{formatDate(candidate.routedAt)}</td>
              <td className="border-b border-[var(--line)] px-3 py-3">
                {candidate.scheduleName}
                <div className="text-xs text-[var(--muted)]">
                  {candidate.businessDaysWaiting} / {candidate.scheduleDaysToNotify} business days
                </div>
              </td>
              <td className="border-b border-[var(--line)] px-3 py-3">{candidate.templateName}</td>
              <td className="border-b border-[var(--line)] px-3 py-3">
                {[...candidate.to, ...candidate.cc, ...candidate.bcc].join(", ")}
                {candidate.warnings.length ? (
                  <div className="mt-1 text-xs text-amber-700">{candidate.warnings.join(" ")}</div>
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

const emptyRecipientConfig: EscalationRecipientConfig = {
  includeDepartmentEmail: true,
  includeDepartmentHeadEmail: false,
  includeDepartmentEscalationEmail: false,
  includeOrganizationContactsForTriggeredSchedule: false,
  specificOrganizationContactIds: [],
};

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
        routed_at: "Apr 26, 2026",
        notification_sent_at: "Apr 26, 2026",
        escalation_schedule_name: "Sample Schedule",
        escalation_schedule_days: "3",
        escalation_template_name: previewTemplate.name,
        business_days_waiting: "3",
        organization_contact_titles: "Finance Director",
        organization_contact_names: "Sample Contact",
      })
    : null;
  const dryRun = one(query.dryRun) === "1" ? await runEscalationCheck({ dryRun: true }) : null;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Email Templates</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Manage department notification content and escalation email template
          content. Escalation timing is assigned through reusable schedules.
        </p>
      </div>

      <form action={updateNotificationTemplate} className="grid gap-4 border border-[var(--line)] bg-[var(--panel)] p-4">
        <h3 className="font-semibold">Department Notification Template</h3>
        <TextInput defaultValue={data.notificationTemplate.departmentSubject} label="Department Subject" name="departmentSubject" required />
        <TextArea defaultValue={data.notificationTemplate.departmentBody} label="Department Body" name="departmentBody" required />
        <div className="flex justify-end">
          <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Save Department Template
          </button>
        </div>
      </form>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Escalation Email Templates</h3>
        <form action={addEscalationTemplate} className="grid gap-4 border border-[var(--line)] bg-[var(--panel)] p-4">
          <h4 className="font-semibold">Add Escalation Template</h4>
          <div className="grid gap-3 md:grid-cols-3">
            <TextInput label="Template Name" name="name" required />
            <TextInput label="Sort Order" name="sortOrder" type="number" />
            <div className="self-end">
              <Checkbox defaultChecked label="Enabled" name="enabled" />
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
            <div>
              <div className="text-xs font-semibold uppercase text-[var(--muted)]">
                Assigned Schedules
              </div>
              <div className="mt-1">
                <ScheduleMultiSelect
                  name="scheduleIds"
                  placeholder="Select assigned schedules"
                  schedules={data.escalationSchedules}
                />
              </div>
            </div>
            <RecipientConfigFields config={emptyRecipientConfig} data={data} />
          </div>
          <div className="grid gap-3">
            <TextInput label="Subject" name="subject" required />
            <TextArea label="Body" name="body" required />
            <PlaceholderReference />
          </div>
          <div className="flex justify-end">
            <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
              Add Escalation Template
            </button>
          </div>
        </form>

        {data.escalationTemplates.map((template) => {
          const formId = `template-${template.id}`;
          return (
            <article className="border border-[var(--line)] bg-[var(--panel)] p-4" key={template.id}>
              <TemplateSummary data={data} template={template} />
              <form action={updateEscalationTemplate} className="mt-3 grid gap-4" id={formId}>
                <input name="templateId" type="hidden" value={template.id} />
                <div className="grid gap-3 md:grid-cols-3">
                  <TextInput defaultValue={template.name} form={formId} label="Template Name" name="name" required />
                  <TextInput defaultValue={template.sortOrder} form={formId} label="Sort Order" name="sortOrder" type="number" />
                  <div className="self-end">
                    <Checkbox defaultChecked={template.enabled} form={formId} label="Enabled" name="enabled" />
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
                  <div>
                    <div className="text-xs font-semibold uppercase text-[var(--muted)]">
                      Assigned Schedules
                    </div>
                    <div className="mt-1">
                      <ScheduleMultiSelect
                        initialSelected={template.scheduleIds}
                        name="scheduleIds"
                        placeholder="Select assigned schedules"
                        schedules={data.escalationSchedules}
                      />
                    </div>
                    {template.enabled && template.scheduleIds.length === 0 ? (
                      <div className="mt-2 text-xs text-amber-700">
                        Enabled templates should be assigned to at least one schedule.
                      </div>
                    ) : null}
                  </div>
                  <RecipientConfigFields config={template.recipientConfig} data={data} />
                </div>
                <div className="grid gap-3">
                  <TextInput defaultValue={template.subject} form={formId} label="Subject" name="subject" required />
                  <TextArea defaultValue={template.body} form={formId} label="Body" name="body" required />
                  <PlaceholderReference />
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
      </section>

      <section className="grid gap-4 border border-[var(--line)] bg-[var(--panel)] p-4">
        <h3 className="text-lg font-semibold">Preview And Testing</h3>
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
        <Link className="focus-ring inline-flex w-fit items-center justify-center border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100" href="/settings/email?dryRun=1">
          Dry Run
        </Link>
        {dryRun ? (
          <div className="space-y-3">
            <div className="text-sm text-[var(--muted)]">
              Dry run at {formatDateTime(dryRun.runAt)}. {dryRun.wouldSendCount} emails would be sent. {dryRun.skippedNoRecipientCount} would be skipped for missing recipients.
            </div>
            {dryRun.errors.length ? (
              <div className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {dryRun.errors.join(" ")}
              </div>
            ) : null}
            <CandidateTable candidates={dryRun.candidates} />
          </div>
        ) : null}
      </section>
    </section>
  );
}
