import Link from "next/link";
import { addDepartment, deleteDepartment, updateDepartment } from "@/lib/actions";
import { requireApUser } from "@/lib/session";
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

export default async function SettingsPage() {
  const user = await requireApUser();
  const data = await readData();

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              className="focus-ring inline-flex border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-100"
              href="/"
            >
              Back to Dashboard
            </Link>
            <p className="mt-4 text-sm font-semibold uppercase tracking-normal text-[var(--accent)]">
              AP Setup
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
              Department Email Setup
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Maintain the department routing table used for invoice notifications.
              PO uploads can create departments by name, but invoices only auto-send
              when the department has an email address here.
            </p>
          </div>
          <div className="border border-[var(--line)] bg-white px-4 py-3 text-sm">
            <div className="font-semibold">{user.name}</div>
            <div className="mt-1 text-[var(--muted)]">AP access required</div>
          </div>
        </header>

        <form
          action={addDepartment}
          className="grid gap-3 border border-[var(--line)] bg-[var(--panel)] p-4 md:grid-cols-[1fr_1fr_auto]"
        >
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Department
            <input
              className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
              name="name"
              placeholder="Facilities"
              required
            />
          </label>
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Department Email
            <input
              className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
              name="email"
              placeholder="facilities@example.com"
              type="email"
              required
            />
          </label>
          <button className="focus-ring self-end bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Add Department
          </button>
        </form>

        <section className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="border-b border-[var(--line)] px-3 py-3">
                  Department
                </th>
                <th className="border-b border-[var(--line)] px-3 py-3">
                  Department Email
                </th>
                <th className="border-b border-[var(--line)] px-3 py-3">
                  Invoices
                </th>
                <th className="border-b border-[var(--line)] px-3 py-3">POs</th>
                <th className="border-b border-[var(--line)] px-3 py-3">
                  Users
                </th>
                <th className="border-b border-[var(--line)] px-3 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {data.departments.map((department) => {
                const counts = usageCounts(department.id, data);
                const inUse =
                  counts.invoices > 0 || counts.purchaseOrders > 0 || counts.users > 0;

                return (
                  <tr className="align-top hover:bg-slate-50" key={department.id}>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      <form
                        action={updateDepartment}
                        className="grid gap-2"
                        id={`department-${department.id}`}
                      >
                        <input
                          name="departmentId"
                          type="hidden"
                          value={department.id}
                        />
                        <input
                          className="focus-ring min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-medium"
                          name="name"
                          defaultValue={department.name}
                          required
                        />
                      </form>
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      <input
                        className="focus-ring min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm"
                        form={`department-${department.id}`}
                        name="email"
                        type="email"
                        defaultValue={department.email}
                        placeholder="required before auto-send"
                        required
                      />
                      {!department.email ? (
                        <div className="mt-1 text-xs font-semibold text-[var(--warning)]">
                          Missing email: matched invoices will require AP review.
                        </div>
                      ) : null}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {counts.invoices}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {counts.purchaseOrders}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {counts.users}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="focus-ring border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-teal-50"
                          form={`department-${department.id}`}
                        >
                          Save
                        </button>
                        <form action={deleteDepartment}>
                          <input
                            name="departmentId"
                            type="hidden"
                            value={department.id}
                          />
                          <button
                            className="focus-ring border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
                            disabled={inUse}
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
