import { updateEscalationContacts } from "@/lib/actions";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function TextInput({
  defaultValue,
  label,
  name,
  required,
  type = "text",
}: {
  defaultValue?: string;
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
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

function EscalationContactFields({
  emailName,
  emailValue,
  nameName,
  nameValue,
  titleName,
  titleValue,
}: {
  emailName: string;
  emailValue: string;
  nameName: string;
  nameValue: string;
  titleName: string;
  titleValue: string;
}) {
  return (
    <div className="grid gap-3 border border-[var(--line)] bg-white p-3 md:grid-cols-3">
      <TextInput
        defaultValue={titleValue}
        label="Title"
        name={titleName}
        required
      />
      <TextInput defaultValue={nameValue} label="Name" name={nameName} />
      <TextInput
        defaultValue={emailValue}
        label="Email"
        name={emailName}
        type="email"
      />
    </div>
  );
}

export default async function EscalationSettingsPage() {
  const data = await readData();
  const contacts = data.escalationContacts;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Escalation Emails</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Configure organization-level escalation recipients for future overdue
          invoice reminders. Titles are customizable.
        </p>
      </div>

      <form
        action={updateEscalationContacts}
        className="space-y-4 border border-[var(--line)] bg-[var(--panel)] p-4"
      >
        <EscalationContactFields
          emailName="apSupervisorEmail"
          emailValue={contacts.apSupervisor.email}
          nameName="apSupervisorName"
          nameValue={contacts.apSupervisor.name}
          titleName="apSupervisorTitle"
          titleValue={contacts.apSupervisor.title}
        />
        <EscalationContactFields
          emailName="cfoEmail"
          emailValue={contacts.cfo.email}
          nameName="cfoName"
          nameValue={contacts.cfo.name}
          titleName="cfoTitle"
          titleValue={contacts.cfo.title}
        />
        <EscalationContactFields
          emailName="executiveEmail"
          emailValue={contacts.executive.email}
          nameName="executiveName"
          nameValue={contacts.executive.name}
          titleName="executiveTitle"
          titleValue={contacts.executive.title}
        />
        <div className="flex justify-end">
          <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Save Escalation Emails
          </button>
        </div>
      </form>
    </section>
  );
}
