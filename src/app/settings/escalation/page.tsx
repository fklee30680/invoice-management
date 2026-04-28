import {
  addEscalationContact,
  deleteEscalationContact,
  updateEscalationContact,
} from "@/lib/actions";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function DepartmentSelect({
  selectedIds = [],
  allDepartments = true,
  departments,
  form,
}: {
  selectedIds?: string[];
  allDepartments?: boolean;
  departments: Awaited<ReturnType<typeof readData>>["departments"];
  form?: string;
}) {
  return (
    <select
      className="focus-ring min-h-28 w-full border border-[var(--line)] bg-white px-3 py-2 text-sm"
      defaultValue={allDepartments ? ["all"] : selectedIds}
      form={form}
      multiple
      name="departmentIds"
    >
      <option value="all">All Departments</option>
      {departments.map((department) => (
        <option key={department.id} value={department.id}>
          {department.name}
        </option>
      ))}
    </select>
  );
}

export default async function EscalationSettingsPage() {
  const data = await readData();

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Escalation Emails</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Configure who receives escalation emails and when they should be
          notified.
        </p>
      </div>

      <form
        action={addEscalationContact}
        className="space-y-4 border border-[var(--line)] bg-[var(--panel)] p-4"
      >
        <h3 className="font-semibold">Add Escalation Recipient</h3>
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.5fr_160px]">
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Name
            <input
              className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
              name="name"
              required
            />
          </label>
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Email
            <input
              className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
              name="email"
              required
              type="email"
            />
          </label>
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Department
            <DepartmentSelect departments={data.departments} />
          </label>
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Days To Notify
            <input
              className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
              defaultValue={1}
              min={1}
              name="daysToNotify"
              required
              type="number"
            />
          </label>
        </div>
        <div className="flex justify-end">
          <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Add Recipient
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <div>
          <h3 className="font-semibold">Escalation Recipients</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Department supports multiple selections. Use All Departments when the
            recipient should receive every escalation.
          </p>
        </div>
        <div className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
          <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
            <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="border-b border-[var(--line)] px-3 py-3">Name</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Email</th>
                <th className="border-b border-[var(--line)] px-3 py-3">
                  Department
                </th>
                <th className="border-b border-[var(--line)] px-3 py-3">
                  Days To Notify
                </th>
                <th className="border-b border-[var(--line)] px-3 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {data.escalationContacts.map((contact) => {
                const formId = `escalation-${contact.id}`;
                return (
                  <tr className="align-top hover:bg-slate-50" key={contact.id}>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      <form action={updateEscalationContact} id={formId}>
                        <input name="contactId" type="hidden" value={contact.id} />
                        <input
                          className="focus-ring min-h-10 w-full border border-[var(--line)] px-3 text-sm"
                          defaultValue={contact.name}
                          name="name"
                          required
                        />
                      </form>
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      <input
                        className="focus-ring min-h-10 w-full border border-[var(--line)] px-3 text-sm"
                        defaultValue={contact.email}
                        form={formId}
                        name="email"
                        required
                        type="email"
                      />
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      <DepartmentSelect
                        allDepartments={contact.allDepartments}
                        departments={data.departments}
                        form={formId}
                        selectedIds={contact.departmentIds}
                      />
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      <input
                        className="focus-ring min-h-10 w-full border border-[var(--line)] px-3 text-sm"
                        defaultValue={contact.daysToNotify}
                        form={formId}
                        min={1}
                        name="daysToNotify"
                        required
                        type="number"
                      />
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="focus-ring border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-teal-50"
                          form={formId}
                        >
                          Save
                        </button>
                        <form action={deleteEscalationContact}>
                          <input
                            name="contactId"
                            type="hidden"
                            value={contact.id}
                          />
                          <button className="focus-ring border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                            Delete
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data.escalationContacts.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-8 text-center text-[var(--muted)]"
                    colSpan={5}
                  >
                    No escalation recipients have been configured.
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
