import {
  addOrganizationEscalationContact,
  deleteOrganizationEscalationContact,
  updateOrganizationEscalationContact,
} from "@/lib/actions";
import { DepartmentScopeSelect } from "@/components/department-scope-select";
import { readData } from "@/lib/store";
import { formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function Checkbox({
  defaultChecked,
  form,
  label,
  name,
  value,
}: {
  defaultChecked?: boolean;
  form?: string;
  label: string;
  name: string;
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

function departmentScopeLabel(
  contact: Awaited<ReturnType<typeof readData>>["organizationEscalationContacts"][number],
  departments: Awaited<ReturnType<typeof readData>>["departments"],
) {
  if (contact.departmentScope.appliesToAllDepartments) return "All Departments";
  const names = contact.departmentScope.departmentIds.map((id) => {
    const department = departments.find((item) => item.id === id);
    return department?.name || `${id} (inactive)`;
  });
  if (names.length <= 2) return names.join(", ") || "No departments selected";
  return `${names.length} Departments`;
}

export default async function OrganizationEscalationContactsPage() {
  const data = await readData();

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Organization Escalation Contacts</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Maintain customizable escalation contacts and assign them to one or
          more reusable escalation schedules.
        </p>
      </div>

      <form
        action={addOrganizationEscalationContact}
        className="grid gap-3 border border-[var(--line)] bg-[var(--panel)] p-4 lg:grid-cols-3"
      >
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Title / Role
          <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" name="title" required />
        </label>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Name
          <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" name="name" required />
        </label>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Email
          <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" name="email" required type="email" />
        </label>
        <fieldset className="border border-[var(--line)] bg-white p-3 lg:col-span-2">
          <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">
            Assigned Schedules
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {data.escalationSchedules.map((schedule) => (
              <Checkbox key={schedule.id} label={schedule.name} name="assignedScheduleIds" value={schedule.id} />
            ))}
          </div>
        </fieldset>
        <fieldset className="border border-[var(--line)] bg-white p-3">
          <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">
            Department Scope
          </legend>
          <DepartmentScopeSelect
            departments={data.departments}
            initialScope={{ appliesToAllDepartments: true, departmentIds: [] }}
          />
        </fieldset>
        <label className="text-xs font-semibold uppercase text-[var(--muted)] lg:col-span-2">
          Notes
          <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" name="notes" />
        </label>
        <div className="grid gap-2 self-end">
          <Checkbox defaultChecked label="Enabled" name="enabled" />
          <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Add Contact
          </button>
        </div>
      </form>

      <section className="grid gap-4">
        {data.organizationEscalationContacts.map((contact) => {
          const formId = `org-contact-${contact.id}`;
          return (
            <article className="border border-[var(--line)] bg-[var(--panel)] p-4" key={contact.id}>
              <form action={updateOrganizationEscalationContact} className="grid gap-3 lg:grid-cols-3" id={formId}>
                <input name="contactId" type="hidden" value={contact.id} />
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                  Title / Role
                  <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" defaultValue={contact.title} name="title" required />
                </label>
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                  Name
                  <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" defaultValue={contact.name} name="name" required />
                </label>
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                  Email
                  <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" defaultValue={contact.email} name="email" required type="email" />
                </label>
                <fieldset className="border border-[var(--line)] bg-white p-3 lg:col-span-2">
                  <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">
                    Assigned Schedules
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {data.escalationSchedules.map((schedule) => (
                      <Checkbox
                        defaultChecked={contact.assignedScheduleIds.includes(schedule.id)}
                        key={schedule.id}
                        label={schedule.name}
                        name="assignedScheduleIds"
                        value={schedule.id}
                      />
                    ))}
                  </div>
                  {contact.enabled && contact.assignedScheduleIds.length === 0 ? (
                    <div className="mt-2 text-xs text-amber-700">
                      Enabled contacts should be assigned to at least one schedule.
                    </div>
                  ) : null}
                </fieldset>
                <fieldset className="border border-[var(--line)] bg-white p-3">
                  <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">
                    Department Scope
                  </legend>
                  <DepartmentScopeSelect
                    departments={data.departments}
                    initialScope={contact.departmentScope}
                  />
                  <div className="mt-2 text-xs text-[var(--muted)]">
                    Current: {departmentScopeLabel(contact, data.departments)}
                  </div>
                  {contact.enabled &&
                  !contact.departmentScope.appliesToAllDepartments &&
                  contact.departmentScope.departmentIds.length === 0 ? (
                    <div className="mt-2 text-xs text-amber-700">
                      Enabled scoped contacts should have at least one department selected.
                    </div>
                  ) : null}
                </fieldset>
                <label className="text-xs font-semibold uppercase text-[var(--muted)] lg:col-span-2">
                  Notes
                  <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" defaultValue={contact.notes} name="notes" />
                </label>
                <div className="grid gap-2 self-end">
                  <Checkbox defaultChecked={contact.enabled} form={formId} label="Enabled" name="enabled" />
                  <div className="text-xs text-[var(--muted)]">
                    Updated {formatDateTime(contact.updatedAt)}
                  </div>
                </div>
              </form>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
                <button className="focus-ring border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-teal-50" form={formId}>
                  Save
                </button>
                <form action={deleteOrganizationEscalationContact}>
                  <input name="contactId" type="hidden" value={contact.id} />
                  <button className="focus-ring border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                    Delete / Disable
                  </button>
                </form>
              </div>
            </article>
          );
        })}
        {data.organizationEscalationContacts.length === 0 ? (
          <div className="border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-[var(--muted)]">
            No organization escalation contacts have been configured.
          </div>
        ) : null}
      </section>
    </section>
  );
}
