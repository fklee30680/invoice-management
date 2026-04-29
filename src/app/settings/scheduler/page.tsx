import Link from "next/link";
import { runEscalationsNow, updateEscalationSchedulerSettings } from "@/lib/actions";
import { readData } from "@/lib/store";
import { formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const weekdays = [
  ["0", "Sunday"],
  ["1", "Monday"],
  ["2", "Tuesday"],
  ["3", "Wednesday"],
  ["4", "Thursday"],
  ["5", "Friday"],
  ["6", "Saturday"],
];

function Checkbox({
  defaultChecked,
  label,
  name,
  value,
}: {
  defaultChecked?: boolean;
  label: string;
  name: string;
  value?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium normal-case text-[var(--foreground)]">
      <input
        className="h-4 w-4 accent-[var(--accent)]"
        defaultChecked={defaultChecked}
        name={name}
        type="checkbox"
        value={value}
      />
      {label}
    </label>
  );
}

export default async function SchedulerRuntimePage() {
  const data = await readData();

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Scheduler Runtime Settings</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Control when the escalation scheduler is allowed to run. Business-day
          rules are configured on the Holidays And Business Days page.
        </p>
      </div>

      <form action={updateEscalationSchedulerSettings} className="grid gap-4 border border-[var(--line)] bg-[var(--panel)] p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Scheduler Time
            <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" defaultValue={data.escalationScheduler.timeOfDay} name="timeOfDay" type="time" />
          </label>
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Timezone
            <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" defaultValue={data.escalationScheduler.timezone} name="timezone" />
          </label>
          <div className="self-end">
            <Checkbox defaultChecked={data.escalationScheduler.enabled} label="Enable escalation scheduler" name="enabled" />
          </div>
        </div>
        <fieldset className="border border-[var(--line)] bg-white p-3">
          <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">
            Scheduler Days
          </legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {weekdays.map(([value, label]) => (
              <Checkbox
                defaultChecked={data.escalationScheduler.daysOfWeek.includes(Number(value))}
                key={value}
                label={label}
                name="daysOfWeek"
                value={value}
              />
            ))}
          </div>
        </fieldset>
        {data.escalationScheduler.excludedWeekdays.map((day) => (
          <input key={day} name="excludedWeekdays" type="hidden" value={day} />
        ))}
        <input name="excludeHolidays" type="hidden" value={data.escalationScheduler.excludeHolidays ? "on" : ""} />
        {data.escalationScheduler.countRoutedDateAsDayOne ? (
          <input name="countRoutedDateAsDayOne" type="hidden" value="on" />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Save Runtime Settings
          </button>
          <Link className="focus-ring inline-flex items-center justify-center border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100" href="/settings/email?dryRun=1">
            Preview Escalation Run
          </Link>
          <form action={runEscalationsNow}>
            <button className="focus-ring bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              Run Escalation Check Now
            </button>
          </form>
        </div>
      </form>

      <section className="border border-[var(--line)] bg-[var(--panel)] p-4">
        <h3 className="text-lg font-semibold">Scheduler Run Summary</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-left text-sm">
            <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="border-b border-[var(--line)] px-3 py-3">Run Date</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Mode</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Sent</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Would Send</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Failed</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Skipped</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Errors</th>
              </tr>
            </thead>
            <tbody>
              {data.escalationRunSummaries.map((summary) => (
                <tr className="align-top hover:bg-slate-50" key={summary.id}>
                  <td className="border-b border-[var(--line)] px-3 py-3">{formatDateTime(summary.runAt)}</td>
                  <td className="border-b border-[var(--line)] px-3 py-3">{summary.mode}</td>
                  <td className="border-b border-[var(--line)] px-3 py-3">{summary.sentCount}</td>
                  <td className="border-b border-[var(--line)] px-3 py-3">{summary.wouldSendCount}</td>
                  <td className="border-b border-[var(--line)] px-3 py-3">{summary.failedCount}</td>
                  <td className="border-b border-[var(--line)] px-3 py-3">{summary.skippedCount || 0}</td>
                  <td className="border-b border-[var(--line)] px-3 py-3">{summary.errors.join(" ") || "None"}</td>
                </tr>
              ))}
              {data.escalationRunSummaries.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-[var(--muted)]" colSpan={7}>
                    No escalation scheduler runs have been recorded.
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
