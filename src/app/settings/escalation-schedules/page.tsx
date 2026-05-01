import {
  addEscalationSchedule,
  deleteEscalationSchedule,
  updateEscalationSchedule,
} from "@/lib/actions";
import { StatusMultiSelect } from "@/components/status-multi-select";
import { readData } from "@/lib/store";
import { formatDateTime } from "@/lib/utils";

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

function usage(scheduleId: string, data: Awaited<ReturnType<typeof readData>>) {
  return {
    contacts: data.organizationEscalationContacts.filter((contact) =>
      contact.assignedScheduleIds.includes(scheduleId),
    ).length,
    templates: data.escalationTemplates.filter((template) =>
      template.scheduleIds.includes(scheduleId),
    ).length,
    history: data.invoices.reduce(
      (count, invoice) =>
        count +
        invoice.escalations.filter((event) => event.scheduleId === scheduleId).length,
      0,
    ),
  };
}

function statusSummary(
  statusIds: string[],
  statuses: Awaited<ReturnType<typeof readData>>["statuses"],
) {
  if (statusIds.length === 0) return "No statuses selected";
  const labels = statusIds.map((id) => {
    const status = statuses.find((item) => item.id === id);
    if (!status) return `${id} (unavailable)`;
    return status.includeInEscalation ? status.label : `${status.label} (inactive)`;
  });
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.length} statuses selected`;
}

function hasUnavailableStatus(
  statusIds: string[],
  statuses: Awaited<ReturnType<typeof readData>>["statuses"],
) {
  return statusIds.some((id) => {
    const status = statuses.find((item) => item.id === id);
    return !status || !status.includeInEscalation;
  });
}

export default async function EscalationSchedulesPage() {
  const data = await readData();

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Escalation Schedules</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Define reusable timing thresholds. Email templates and organization
          contacts can be assigned to these schedules.
        </p>
      </div>

      <form
        action={addEscalationSchedule}
        className="grid gap-3 border border-[var(--line)] bg-[var(--panel)] p-4 lg:grid-cols-[1fr_1.5fr_160px_170px_120px_auto]"
      >
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Schedule Name
          <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" name="name" required />
        </label>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Description
          <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" name="description" />
        </label>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Days To Notify
          <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" min={0} name="daysToNotify" required type="number" />
        </label>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Statuses
          <div className="mt-1">
            <StatusMultiSelect statuses={data.statuses} />
          </div>
        </label>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Sort Order
          <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" name="sortOrder" type="number" />
        </label>
        <div className="grid gap-2 self-end">
          <Checkbox defaultChecked label="Enabled" name="enabled" />
          <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Add Schedule
          </button>
        </div>
      </form>

      <section className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
        <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
          <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="border-b border-[var(--line)] px-3 py-3">Schedule</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Days</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Statuses</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Assignments</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Dates</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.escalationSchedules.map((schedule) => {
              const formId = `schedule-${schedule.id}`;
              const counts = usage(schedule.id, data);
              return (
                <tr className="align-top hover:bg-slate-50" key={schedule.id}>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    <form action={updateEscalationSchedule} className="grid gap-2" id={formId}>
                      <input name="scheduleId" type="hidden" value={schedule.id} />
                      <input className="focus-ring min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-medium" defaultValue={schedule.name} name="name" required />
                      <input className="focus-ring min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm" defaultValue={schedule.description} name="description" placeholder="Description" />
                      <Checkbox defaultChecked={schedule.enabled} form={formId} label="Enabled" name="enabled" />
                    </form>
                  </td>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    <input className="focus-ring min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm" defaultValue={schedule.daysToNotify} form={formId} min={0} name="daysToNotify" required type="number" />
                    <input className="focus-ring mt-2 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm" defaultValue={schedule.sortOrder} form={formId} name="sortOrder" placeholder="Sort order" type="number" />
                  </td>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    <StatusMultiSelect
                      formId={formId}
                      initialSelected={schedule.statusIds || []}
                      statuses={data.statuses}
                    />
                    <div className="mt-2 text-xs text-[var(--muted)]">
                      {statusSummary(schedule.statusIds || [], data.statuses)}
                    </div>
                    {hasUnavailableStatus(schedule.statusIds || [], data.statuses) ? (
                      <div className="mt-1 text-xs font-semibold text-amber-700">
                        Some selected statuses are inactive or unavailable.
                      </div>
                    ) : null}
                  </td>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    <div>{counts.contacts} contacts</div>
                    <div>{counts.templates} templates</div>
                    <div>{counts.history} historical sends</div>
                    {counts.contacts || counts.templates ? (
                      <div className="mt-2 text-xs text-amber-700">
                        Used by active setup. Disabling is safer than deleting.
                      </div>
                    ) : null}
                  </td>
                  <td className="border-b border-[var(--line)] px-3 py-3 text-xs text-[var(--muted)]">
                    <div>Created: {formatDateTime(schedule.createdAt)}</div>
                    <div>Updated: {formatDateTime(schedule.updatedAt)}</div>
                  </td>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button className="focus-ring border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-teal-50" form={formId}>
                        Save
                      </button>
                      <form action={deleteEscalationSchedule}>
                        <input name="scheduleId" type="hidden" value={schedule.id} />
                        <button className="focus-ring border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                          Delete / Disable
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {data.escalationSchedules.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-[var(--muted)]" colSpan={6}>
                  No escalation schedules have been configured.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </section>
  );
}
