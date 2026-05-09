import {
  addDepartment,
  updateDepartment,
  uploadDepartmentEmails,
} from "@/lib/actions";
import { DeleteDepartmentConfirmation } from "@/components/delete-department-confirmation";
import { DepartmentImportMappingForm } from "@/components/department-import-mapping-form";
import { requireApUser } from "@/lib/session";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DepartmentSettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

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

export default async function DepartmentSettingsPage({
  searchParams,
}: DepartmentSettingsPageProps) {
  await requireApUser();
  const data = await readData();
  const query = (await searchParams) || {};
  const settings = data.departmentImportSettings;
  const search = one(query.search).toLowerCase();
  const result = {
    imported: one(query.imported),
    updated: one(query.updated),
    filled: one(query.filled),
    skipped: one(query.skipped),
    warnings: one(query.warnings),
    errors: one(query.errors),
  };
  const hasResult = Object.values(result).some(Boolean);
  const message = one(query.message);
  const messageType = one(query.messageType);
  const filteredDepartments = data.departments.filter((department) =>
    [
      department.name,
      department.email,
      department.departmentHeadName,
      department.departmentHeadEmail,
      department.escalationName,
      department.escalationEmail,
    ]
      .join(" ")
      .toLowerCase()
      .includes(search),
  );

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Department Emails</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Maintain department routing contacts used for invoice notifications.
        </p>
      </div>

      {hasResult ? (
        <section
          className={`border px-4 py-3 text-sm ${
            result.errors !== "0"
              ? "border-red-300 bg-red-50 text-red-900"
              : "border-emerald-300 bg-emerald-50 text-emerald-900"
          }`}
        >
          Imported {result.imported || "0"} departments. Updated{" "}
          {result.updated || "0"}. Filled missing data on {result.filled || "0"}.
          Skipped {result.skipped || "0"}. Warnings {result.warnings || "0"}.
          Errors {result.errors || "0"}.
        </section>
      ) : null}

      {message ? (
        <section
          className={`border px-4 py-3 text-sm ${
            messageType === "error"
              ? "border-red-300 bg-red-50 text-red-900"
              : messageType === "warning"
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-emerald-300 bg-emerald-50 text-emerald-900"
          }`}
        >
          {message}
        </section>
      ) : null}

      <form
        action={uploadDepartmentEmails}
        className="space-y-5 border border-[var(--line)] bg-[var(--panel)] p-4"
      >
        <div>
          <h3 className="font-semibold">Import Department Emails</h3>
          <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
            Upload a department email list and map the columns from the header
            row. Column selections are saved for the next import.
          </p>
        </div>

        <DepartmentImportMappingForm settings={settings} />

        <section>
          <h3 className="text-sm font-semibold">Import Options</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="flex min-h-10 items-center gap-3 border border-[var(--line)] bg-white px-3 py-2 text-sm">
              <input
                className="h-4 w-4 accent-[var(--accent)]"
                defaultChecked={settings.updateExisting}
                name="updateExisting"
                type="checkbox"
              />
              <span>
                <span className="block font-semibold">
                  Update existing departments
                </span>
                <span className="block text-xs text-[var(--muted)]">
                  Imported nonblank values overwrite saved values.
                </span>
              </span>
            </label>
            <label className="flex min-h-10 items-center gap-3 border border-[var(--line)] bg-white px-3 py-2 text-sm">
              <input
                className="h-4 w-4 accent-[var(--accent)]"
                defaultChecked={settings.fillMissingData}
                name="fillMissingData"
                type="checkbox"
              />
              <span>
                <span className="block font-semibold">
                  Fill missing data on existing departments
                </span>
                <span className="block text-xs text-[var(--muted)]">
                  Imported values fill blank fields without overwriting saved
                  values.
                </span>
              </span>
            </label>
          </div>
        </section>

        <div className="flex justify-end">
          <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Import Department Emails
          </button>
        </div>
      </form>

      <details className="border border-[var(--line)] bg-[var(--panel)] p-4">
        <summary className="cursor-pointer font-semibold">Add Department Manually</summary>
        <form action={addDepartment} className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
      </details>

      <section className="space-y-3">
        <div>
          <h3 className="font-semibold">Departments</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {data.departments.length} departments available for routing and
            escalation contacts.
          </p>
        </div>

        <form className="flex max-w-2xl flex-col gap-2 sm:flex-row" method="get">
          <input
            className="focus-ring min-h-10 flex-1 border border-[var(--line)] bg-white px-3 text-sm"
            defaultValue={one(query.search)}
            name="search"
            placeholder="Search by department, email, or name"
          />
          <div className="flex gap-2">
            <button className="focus-ring border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-slate-100">
              Search
            </button>
            {search ? (
              <a
                className="focus-ring border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-slate-100"
                href="/settings/departments"
              >
                Clear filter
              </a>
            ) : null}
          </div>
        </form>

        <div className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
          <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
            <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="w-[220px] border-b border-[var(--line)] px-3 py-3">
                  Department
                </th>
                <th className="border-b border-[var(--line)] px-3 py-3">
                  Department Email
                </th>
                <th className="border-b border-[var(--line)] px-3 py-3">
                  Department Head
                </th>
                <th className="border-b border-[var(--line)] px-3 py-3">
                  Head Email
                </th>
                <th className="border-b border-[var(--line)] px-3 py-3">
                  Escalation Contact
                </th>
                <th className="border-b border-[var(--line)] px-3 py-3">
                  Escalation Email
                </th>
                <th className="border-b border-[var(--line)] px-3 py-3">
                  Usage
                </th>
                <th className="border-b border-[var(--line)] px-3 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredDepartments.map((department) => {
                const counts = usageCounts(department.id, data);
                const inUse =
                  counts.invoices > 0 || counts.purchaseOrders > 0 || counts.users > 0;
                const formId = `department-${department.id}`;

                return (
                  <tr className="align-top hover:bg-slate-50" key={department.id}>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      <form action={updateDepartment} id={formId}>
                        <input name="departmentId" type="hidden" value={department.id} />
                      </form>
                      <input
                        className="focus-ring min-h-9 w-full border border-[var(--line)] bg-white px-2 text-sm font-semibold normal-case text-[var(--foreground)]"
                        defaultValue={department.name}
                        form={formId}
                        name="name"
                        required
                      />
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      <input
                        className="focus-ring min-h-9 w-full border border-[var(--line)] bg-white px-2 text-sm font-normal normal-case text-[var(--foreground)]"
                        defaultValue={department.email}
                        form={formId}
                        name="email"
                        placeholder="required before auto-send"
                        required
                        type="email"
                      />
                      {!department.email ? (
                        <div className="mt-1 text-xs font-semibold text-[var(--warning)]">
                          Missing email
                        </div>
                      ) : null}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      <input
                        className="focus-ring min-h-9 w-full border border-[var(--line)] bg-white px-2 text-sm font-normal normal-case text-[var(--foreground)]"
                        defaultValue={department.departmentHeadName}
                        form={formId}
                        name="departmentHeadName"
                      />
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      <input
                        className="focus-ring min-h-9 w-full border border-[var(--line)] bg-white px-2 text-sm font-normal normal-case text-[var(--foreground)]"
                        defaultValue={department.departmentHeadEmail}
                        form={formId}
                        name="departmentHeadEmail"
                        type="email"
                      />
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      <input
                        className="focus-ring min-h-9 w-full border border-[var(--line)] bg-white px-2 text-sm font-normal normal-case text-[var(--foreground)]"
                        defaultValue={department.escalationName}
                        form={formId}
                        name="escalationName"
                      />
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      <input
                        className="focus-ring min-h-9 w-full border border-[var(--line)] bg-white px-2 text-sm font-normal normal-case text-[var(--foreground)]"
                        defaultValue={department.escalationEmail}
                        form={formId}
                        name="escalationEmail"
                        type="email"
                      />
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3 text-xs text-[var(--muted)]">
                      {counts.invoices} inv / {counts.purchaseOrders} PO /{" "}
                      {counts.users} user
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="focus-ring border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-teal-50"
                          form={formId}
                        >
                          Save
                        </button>
                        {inUse ? (
                          <button
                            className="focus-ring border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 opacity-45 disabled:cursor-not-allowed"
                            disabled
                            title="Department is in use and cannot be deleted."
                            type="button"
                          >
                            Delete
                          </button>
                        ) : (
                          <DeleteDepartmentConfirmation departmentId={department.id} />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredDepartments.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-8 text-center text-[var(--muted)]"
                    colSpan={8}
                  >
                    {data.departments.length === 0
                      ? "No departments have been added."
                      : "No departments match the current filter."}
                    {data.departments.length > 0 && search ? (
                      <a
                        className="ml-2 font-semibold text-[var(--accent)]"
                        href="/settings/departments"
                      >
                        Clear filter
                      </a>
                    ) : null}
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
