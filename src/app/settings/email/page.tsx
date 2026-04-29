import Link from "next/link";
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
import type { EscalationRecipientConfig } from "@/lib/types";
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

function RecipientConfigFields({
  config,
  data,
  form,
}: {
  config: EscalationRecipientConfig;
  data: Awaited<ReturnType<typeof readData>>;
  form?: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <fieldset className="border border-[var(--line)] bg-white p-3">
        <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">
          Department Recipients
        </legend>
        <div className="grid gap-2">
          <Checkbox defaultChecked={config.includeDepartmentEmail} form={form} label="Department email" name="includeDepartmentEmail" />
          <Checkbox defaultChecked={config.includeDepartmentHeadEmail} form={form} label="Department head email" name="includeDepartmentHeadEmail" />
          <Checkbox defaultChecked={config.includeDepartmentEscalationEmail} form={form} label="Department escalation email" name="includeDepartmentEscalationEmail" />
        </div>
      </fieldset>
      <fieldset className="border border-[var(--line)] bg-white p-3">
        <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">
          Organization Contacts
        </legend>
        <div className="grid gap-2">
          <Checkbox
            defaultChecked={config.includeOrganizationContactsForTriggeredSchedule}
            form={form}
            label="Include contacts assigned to triggered schedule"
            name="includeOrganizationContactsForTriggeredSchedule"
          />
          {data.organizationEscalationContacts.map((contact) => (
            <Checkbox
              defaultChecked={config.specificOrganizationContactIds.includes(contact.id)}
              form={form}
              key={contact.id}
              label={`${contact.title}: ${contact.name}`}
              name="specificOrganizationContactIds"
              value={contact.id}
            />
          ))}
        </div>
      </fieldset>
      <TextArea
        defaultValue={config.customToEmails.join("\n")}
        form={form}
        label="Custom To Emails"
        name="customToEmails"
      />
      <TextArea
        defaultValue={config.customCcEmails.join("\n")}
        form={form}
        label="Custom CC Emails"
        name="customCcEmails"
      />
      <TextArea
        defaultValue={config.customBccEmails.join("\n")}
        form={form}
        label="Custom BCC Emails"
        name="customBccEmails"
      />
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
  customToEmails: [],
  customCcEmails: [],
  customBccEmails: [],
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
        <form action={addEscalationTemplate} className="grid gap-3 border border-[var(--line)] bg-[var(--panel)] p-4">
          <h4 className="font-semibold">Add Escalation Template</h4>
          <div className="grid gap-3 md:grid-cols-3">
            <TextInput label="Template Name" name="name" required />
            <TextInput label="Sort Order" name="sortOrder" type="number" />
            <div className="self-end">
              <Checkbox defaultChecked label="Enabled" name="enabled" />
            </div>
          </div>
          <fieldset className="border border-[var(--line)] bg-white p-3">
            <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">
              Assigned Schedules
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.escalationSchedules.map((schedule) => (
                <Checkbox key={schedule.id} label={schedule.name} name="scheduleIds" value={schedule.id} />
              ))}
            </div>
          </fieldset>
          <TextInput label="Subject" name="subject" required />
          <TextArea label="Body" name="body" required />
          <RecipientConfigFields config={emptyRecipientConfig} data={data} />
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
              <form action={updateEscalationTemplate} className="grid gap-3" id={formId}>
                <input name="templateId" type="hidden" value={template.id} />
                <div className="grid gap-3 md:grid-cols-3">
                  <TextInput defaultValue={template.name} form={formId} label="Template Name" name="name" required />
                  <TextInput defaultValue={template.sortOrder} form={formId} label="Sort Order" name="sortOrder" type="number" />
                  <div className="self-end">
                    <Checkbox defaultChecked={template.enabled} form={formId} label="Enabled" name="enabled" />
                  </div>
                </div>
                <fieldset className="border border-[var(--line)] bg-white p-3">
                  <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">
                    Assigned Schedules
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {data.escalationSchedules.map((schedule) => (
                      <Checkbox
                        defaultChecked={template.scheduleIds.includes(schedule.id)}
                        form={formId}
                        key={schedule.id}
                        label={schedule.name}
                        name="scheduleIds"
                        value={schedule.id}
                      />
                    ))}
                  </div>
                </fieldset>
                <TextInput defaultValue={template.subject} form={formId} label="Subject" name="subject" required />
                <TextArea defaultValue={template.body} form={formId} label="Body" name="body" required />
                <RecipientConfigFields config={template.recipientConfig} data={data} form={formId} />
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
              Dry run at {formatDateTime(dryRun.runAt)}. {dryRun.wouldSendCount} emails would be sent.
            </div>
            <CandidateTable candidates={dryRun.candidates} />
          </div>
        ) : null}
      </section>
    </section>
  );
}
