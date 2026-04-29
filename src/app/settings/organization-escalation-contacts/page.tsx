import {
  addOrganizationEscalationContact,
  deleteOrganizationEscalationContact,
  updateOrganizationEscalationContact,
} from "@/lib/actions";
import { DepartmentScopeSelect } from "@/components/department-scope-select";
import { ScheduleMultiSelect } from "@/components/schedule-multi-select";
import { readData } from "@/lib/store";
import { formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fieldLabelClass = "text-xs font-semibold uppercase text-[var(--muted)]";
const inputClass =
  "focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]";

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

function assignedSchedulesLabel(
  contact: Awaited<ReturnType<typeof readData>>["organizationEscalationContacts"][number],
  schedules: Awaited<ReturnType<typeof readData>>["escalationSchedules"],
) {
  const names = contact.assignedScheduleIds.map((id) => {
    const schedule = schedules.find((item) => item.id === id);
    if (!schedule) return `${id} (inactive)`;
    return schedule.enabled ? schedule.name : `${schedule.name} (inactive)`;
  });
  if (names.length <= 2) return names.join(", ") || "No schedules selected";
  return `${names.length} schedules selected`;
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
        className="grid gap-4 border border-[var(--line)] bg-[var(--panel)] p-4"
      >
        <fieldset className="grid gap-3 lg:grid-cols-4">
          <legend className="sr-only">Contact Details</legend>
          <label className={fieldLabelClass}>
            Title / Role
            <input className={inputClass} name="title" required />
          </label>
          <label className={fieldLabelClass}>
            Name
            <input className={inputClass} name="name" required />
          </label>
          <label className={fieldLabelClass}>
            Email
            <input className={inputClass} name="email" required type="email" />
          </label>
          <div className="flex items-end">
            <Checkbox defaultChecked label="Enabled" name="enabled" />
          </div>
        </fieldset>

        <fieldset className="grid gap-3 lg:grid-cols-2">
          <legend className="sr-only">Escalation Assignment</legend>
          <div>
            <div className={fieldLabelClass}>Assigned Schedules</div>
            <div className="mt-1">
              <ScheduleMultiSelect schedules={data.escalationSchedules} />
            </div>
          </div>
          <div>
            <div className={fieldLabelClass}>Department Scope</div>
            <div className="mt-1">
              <DepartmentScopeSelect
                departments={data.departments}
                initialScope={{ appliesToAllDepartments: true, departmentIds: [] }}
              />
            </div>
          </div>
        </fieldset>

        <label className={fieldLabelClass}>
          Notes
          <input className={inputClass} name="notes" />
        </label>
        <div className="flex justify-end">
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
              <div className="grid gap-3 border-b border-[var(--line)] pb-3 text-sm lg:grid-cols-[1fr_1fr_1.3fr_1.4fr_1.4fr_auto]">
                <div>
                  <div className="text-xs font-semibold uppercase text-[var(--muted)]">Title</div>
                  <div>{contact.title}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-[var(--muted)]">Name</div>
                  <div>{contact.name}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-[var(--muted)]">Email</div>
                  <div className="break-all">{contact.email}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-[var(--muted)]">Assigned Schedules</div>
                  <div>{assignedSchedulesLabel(contact, data.escalationSchedules)}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-[var(--muted)]">Department Scope</div>
                  <div>{departmentScopeLabel(contact, data.departments)}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase text-[var(--muted)]">Status</div>
                  <div>{contact.enabled ? "Enabled" : "Disabled"}</div>
                </div>
              </div>

              <form action={updateOrganizationEscalationContact} className="mt-3 grid gap-4" id={formId}>
                <input name="contactId" type="hidden" value={contact.id} />

                <fieldset className="grid gap-3 lg:grid-cols-4">
                  <legend className="sr-only">Contact Details</legend>
                  <label className={fieldLabelClass}>
                    Title / Role
                    <input className={inputClass} defaultValue={contact.title} name="title" required />
                  </label>
                  <label className={fieldLabelClass}>
                    Name
                    <input className={inputClass} defaultValue={contact.name} name="name" required />
                  </label>
                  <label className={fieldLabelClass}>
                    Email
                    <input className={inputClass} defaultValue={contact.email} name="email" required type="email" />
                  </label>
                  <div className="flex items-end">
                    <Checkbox defaultChecked={contact.enabled} form={formId} label="Enabled" name="enabled" />
                  </div>
                </fieldset>

                <fieldset className="grid gap-3 lg:grid-cols-2">
                  <legend className="sr-only">Escalation Assignment</legend>
                  <div>
                    <div className={fieldLabelClass}>
                      Assigned Schedules
                    </div>
                    <div className="mt-1" id={`${formId}-schedules`}>
                      <ScheduleMultiSelect
                        initialSelected={contact.assignedScheduleIds}
                        schedules={data.escalationSchedules}
                      />
                    </div>
                    {contact.enabled && contact.assignedScheduleIds.length === 0 ? (
                      <div className="mt-2 text-xs text-amber-700">
                        Enabled contacts should be assigned to at least one schedule.
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <div className={fieldLabelClass}>
                      Department Scope
                    </div>
                    <div className="mt-1" id={`${formId}-department-scope`}>
                      <DepartmentScopeSelect
                        departments={data.departments}
                        initialScope={contact.departmentScope}
                      />
                    </div>
                    {contact.enabled &&
                    !contact.departmentScope.appliesToAllDepartments &&
                    contact.departmentScope.departmentIds.length === 0 ? (
                      <div className="mt-2 text-xs text-amber-700">
                        Enabled scoped contacts should have at least one department selected.
                      </div>
                    ) : null}
                  </div>
                </fieldset>

                <label className={fieldLabelClass}>
                  Notes
                  <input className={inputClass} defaultValue={contact.notes} name="notes" />
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
                  <div className="text-xs text-[var(--muted)]">
                    Updated {formatDateTime(contact.updatedAt)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="focus-ring border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-teal-50" form={formId}>
                      Save
                    </button>
                    <button className="focus-ring border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50" form={`${formId}-delete`}>
                      Delete / Disable
                    </button>
                  </div>
                </div>
              </form>
              <form action={deleteOrganizationEscalationContact} id={`${formId}-delete`}>
                <input name="contactId" type="hidden" value={contact.id} />
              </form>
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
