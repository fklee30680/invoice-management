import {
  addDepartment,
  deleteDepartment,
  updateDepartment,
} from "@/lib/actions";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function usageCounts(departmentId: string, data: Awaited<ReturnType<typeof readData>>) {
  return {
    invoices: data.invoices.filter((invoice) => invoice.departmentId === departmentId)
      .length,
    purchaseOrders: data.purchaseOrders.filter((po) => po.departmentId === departmentId)
      .length,
    users: data.users.filter((user) => user.departmentId === departmentId).length,
  };
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
  defaultValue?: string;
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

export default async function DepartmentSettingsPage() {
  const data = await readData();

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Department Emails</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Maintain department routing contacts used for invoice notifications.
        </p>
      </div>

      <form
        action={addDepartment}
        className="space-y-4 border border-[var(--line)] bg-[var(--panel)] p-4"
      >
        <h3 className="font-semibold">Add Department</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput label="Department" name="name" placeholder="Facilities" required />
          <TextInput
            label="Department Email"
            name="email"
            placeholder="facilities@example.com"
            required
            type="email"
          />
          <TextInput label="Department Head Name" name="departmentHeadName" />
          <TextInput label="Department Head Email" name="departmentHeadEmail" type="email" />
          <TextInput label="Department Escalation Name" name="escalationName" />
          <TextInput label="Department Escalation Email" name="escalationEmail" type="email" />
        </div>
        <div className="flex justify-end">
          <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Add Department
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <div>
          <h3 className="font-semibold">Departments</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Edit department names and routing email addresses.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {data.departments.map((department) => {
            const counts = usageCounts(department.id, data);
            const inUse =
              counts.invoices > 0 || counts.purchaseOrders > 0 || counts.users > 0;
            const formId = `department-${department.id}`;

            return (
              <article
                className="border border-[var(--line)] bg-[var(--panel)] p-4"
                key={department.id}
              >
                <form action={updateDepartment} className="grid gap-3" id={formId}>
                  <input name="departmentId" type="hidden" value={department.id} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <TextInput
                      defaultValue={department.name}
                      label="Department"
                      name="name"
                      required
                    />
                    <TextInput
                      defaultValue={department.email}
                      label="Department Email"
                      name="email"
                      placeholder="required before auto-send"
                      required
                      type="email"
                    />
                    <TextInput
                      defaultValue={department.departmentHeadName}
                      label="Department Head Name"
                      name="departmentHeadName"
                    />
                    <TextInput
                      defaultValue={department.departmentHeadEmail}
                      label="Department Head Email"
                      name="departmentHeadEmail"
                      type="email"
                    />
                    <TextInput
                      defaultValue={department.escalationName}
                      label="Department Escalation Name"
                      name="escalationName"
                    />
                    <TextInput
                      defaultValue={department.escalationEmail}
                      label="Department Escalation Email"
                      name="escalationEmail"
                      type="email"
                    />
                  </div>
                </form>

                {!department.email ? (
                  <div className="mt-3 text-xs font-semibold text-[var(--warning)]">
                    Missing department email: matched invoices will require AP review.
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
                  <div className="flex flex-wrap gap-3 text-xs text-[var(--muted)]">
                    <span>{counts.invoices} invoices</span>
                    <span>{counts.purchaseOrders} POs</span>
                    <span>{counts.users} users</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="focus-ring border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-teal-50"
                      form={formId}
                    >
                      Save
                    </button>
                    <form action={deleteDepartment}>
                      <input name="departmentId" type="hidden" value={department.id} />
                      <button
                        className="focus-ring border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={inUse}
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
