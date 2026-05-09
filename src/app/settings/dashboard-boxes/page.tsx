import {
  addDashboardBox,
  deleteDashboardBox,
  updateDashboardBox,
} from "@/lib/actions";
import { DepartmentScopeSelect } from "@/components/department-scope-select";
import { StatusFilterSelect } from "@/components/status-filter-select";
import {
  DASHBOARD_BOX_METRICS,
  DASHBOARD_BOX_VIEWS,
} from "@/lib/dashboard-boxes";
import { INVOICE_SUMMARY_VIEWS } from "@/lib/invoice-views";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function Checkbox({
  defaultChecked,
  form,
  label,
  name,
}: {
  defaultChecked?: boolean;
  form?: string;
  label: string;
  name: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium normal-case text-[var(--foreground)]">
      <input
        className="h-4 w-4 accent-[var(--accent)]"
        defaultChecked={defaultChecked}
        form={form}
        name={name}
        type="checkbox"
      />
      {label}
    </label>
  );
}

function departmentSummary(
  scope: { appliesToAllDepartments: boolean; departmentIds: string[] },
  data: Awaited<ReturnType<typeof readData>>,
) {
  if (scope.appliesToAllDepartments) return "All Departments";
  const labels = scope.departmentIds.map(
    (id) => data.departments.find((department) => department.id === id)?.name || `${id} (inactive)`,
  );
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.length} departments selected`;
}

function statusSummary(statusIds: string[], data: Awaited<ReturnType<typeof readData>>) {
  const labels = statusIds.map((id) => {
    const status = data.statuses.find((item) => item.id === id);
    if (!status) return `${id} (unavailable)`;
    return status.active ? status.label : `${status.label} (inactive)`;
  });
  if (labels.length === 0) return "No statuses selected";
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.length} statuses selected`;
}

function metricLabel(value: string) {
  return DASHBOARD_BOX_METRICS.find((metric) => metric.value === value)?.label || "Count";
}

export default async function DashboardBoxesPage() {
  const data = await readData();

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Dashboard Boxes</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Configure the boxes shown on the AP Dashboard. Choose box names,
          linked pages, departments, statuses, display metrics, and order.
        </p>
      </div>

      <form
        action={addDashboardBox}
        className="grid gap-3 border border-[var(--line)] bg-[var(--panel)] p-4 xl:grid-cols-[1fr_180px_220px_220px_170px_100px_auto]"
      >
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Box Name
          <input
            className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
            name="name"
            required
          />
        </label>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Linked Page
          <select
            className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
            name="linkedViewId"
            required
          >
            {DASHBOARD_BOX_VIEWS.map((view) => (
              <option key={view} value={view}>
                {INVOICE_SUMMARY_VIEWS[view].label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Departments
          <div className="mt-1">
            <DepartmentScopeSelect departments={data.departments} />
          </div>
        </label>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Statuses
          <div className="mt-1">
            <StatusFilterSelect statuses={data.statuses} />
          </div>
        </label>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Metric Display
          <select
            className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
            name="metricType"
            defaultValue="count"
          >
            {DASHBOARD_BOX_METRICS.map((metric) => (
              <option key={metric.value} value={metric.value}>
                {metric.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Order
          <input
            className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
            min={1}
            name="order"
            type="number"
          />
        </label>
        <div className="grid gap-2 self-end">
          <Checkbox defaultChecked label="Enabled" name="enabled" />
          <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Add Box
          </button>
        </div>
      </form>

      <section className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
        <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
          <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="border-b border-[var(--line)] px-3 py-3">Order</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Box</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Linked Page</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Departments</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Statuses</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Metric</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.dashboardBoxes.map((box) => {
              const formId = `dashboard-box-${box.id}`;
              return (
                <tr className="align-top hover:bg-slate-50" key={box.id}>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    <input
                      className="focus-ring min-h-10 w-20 border border-[var(--line)] bg-white px-3 text-sm"
                      defaultValue={box.order}
                      form={formId}
                      min={1}
                      name="order"
                      type="number"
                    />
                  </td>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    <form action={updateDashboardBox} className="grid gap-2" id={formId}>
                      <input name="boxId" type="hidden" value={box.id} />
                      <input
                        className="focus-ring min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-medium"
                        defaultValue={box.name}
                        name="name"
                        required
                      />
                      <Checkbox defaultChecked={box.enabled} form={formId} label="Enabled" name="enabled" />
                    </form>
                  </td>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    <select
                      className="focus-ring min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm"
                      defaultValue={box.linkedViewId}
                      form={formId}
                      name="linkedViewId"
                    >
                      {DASHBOARD_BOX_VIEWS.map((view) => (
                        <option key={view} value={view}>
                          {INVOICE_SUMMARY_VIEWS[view].label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    <DepartmentScopeSelect
                      departments={data.departments}
                      formId={formId}
                      initialScope={box.departmentScope}
                    />
                    <div className="mt-2 text-xs text-[var(--muted)]">
                      {departmentSummary(box.departmentScope, data)}
                    </div>
                  </td>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    <StatusFilterSelect
                      formId={formId}
                      initialSelected={box.statusIds}
                      statuses={data.statuses}
                    />
                    <div className="mt-2 text-xs text-[var(--muted)]">
                      {statusSummary(box.statusIds, data)}
                    </div>
                  </td>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    <select
                      className="focus-ring min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm"
                      defaultValue={box.metricType}
                      form={formId}
                      name="metricType"
                    >
                      {DASHBOARD_BOX_METRICS.map((metric) => (
                        <option key={metric.value} value={metric.value}>
                          {metric.label}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 text-xs text-[var(--muted)]">
                      {metricLabel(box.metricType)}
                    </div>
                  </td>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="focus-ring border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-teal-50"
                        form={formId}
                      >
                        Save
                      </button>
                      <form action={deleteDashboardBox}>
                        <input name="boxId" type="hidden" value={box.id} />
                        <button className="focus-ring border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {data.dashboardBoxes.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-[var(--muted)]" colSpan={7}>
                  No dashboard boxes have been configured.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </section>
  );
}
