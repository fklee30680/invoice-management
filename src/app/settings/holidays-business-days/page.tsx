import {
  addHoliday,
  deleteHoliday,
  updateEscalationSchedulerSettings,
  updateHoliday,
} from "@/lib/actions";
import { readData } from "@/lib/store";

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

export default async function HolidaysBusinessDaysPage() {
  const data = await readData();

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold">Holidays And Business-Day Rules</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Configure the reusable business-day rules used by escalation schedules.
        </p>
      </div>

      <form action={updateEscalationSchedulerSettings} className="grid gap-4 border border-[var(--line)] bg-[var(--panel)] p-4">
        <input name="enabled" type="hidden" value={data.escalationScheduler.enabled ? "on" : ""} />
        <input name="timeOfDay" type="hidden" value={data.escalationScheduler.timeOfDay} />
        <input name="timezone" type="hidden" value={data.escalationScheduler.timezone} />
        {data.escalationScheduler.daysOfWeek.map((day) => (
          <input key={day} name="daysOfWeek" type="hidden" value={day} />
        ))}
        <fieldset className="border border-[var(--line)] bg-white p-3">
          <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">
            Excluded Weekdays
          </legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {weekdays.map(([value, label]) => (
              <Checkbox
                defaultChecked={data.escalationScheduler.excludedWeekdays.includes(Number(value))}
                key={value}
                label={label}
                name="excludedWeekdays"
                value={value}
              />
            ))}
          </div>
        </fieldset>
        <div className="grid gap-2">
          <Checkbox defaultChecked={data.escalationScheduler.excludeHolidays} label="Exclude configured holidays" name="excludeHolidays" />
          <Checkbox defaultChecked={data.escalationScheduler.countRoutedDateAsDayOne} label="Count routed date as business day one" name="countRoutedDateAsDayOne" />
        </div>
        <div>
          <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Save Business-Day Rules
          </button>
        </div>
      </form>

      <section className="grid gap-4 border border-[var(--line)] bg-[var(--panel)] p-4">
        <h3 className="text-lg font-semibold">Holidays</h3>
        <form action={addHoliday} className="grid gap-3 md:grid-cols-[160px_1fr_1fr_auto_auto]">
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Holiday Date
            <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" name="date" required type="date" />
          </label>
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Holiday Name
            <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" name="name" required />
          </label>
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Notes
            <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" name="notes" />
          </label>
          <div className="self-end">
            <Checkbox defaultChecked label="Enabled" name="enabled" />
          </div>
          <button className="focus-ring self-end bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Add Holiday
          </button>
        </form>
        <div className="grid gap-3">
          {data.holidays.map((holiday) => {
            const formId = `holiday-${holiday.id}`;
            return (
              <div className="grid gap-2 border border-[var(--line)] bg-white p-3 md:grid-cols-[160px_1fr_1fr_auto_auto]" key={holiday.id}>
                <form action={updateHoliday} className="contents" id={formId}>
                  <input name="holidayId" type="hidden" value={holiday.id} />
                  <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                    Date
                    <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" defaultValue={holiday.date} name="date" required type="date" />
                  </label>
                  <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                    Name
                    <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" defaultValue={holiday.name} name="name" required />
                  </label>
                  <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                    Notes
                    <input className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]" defaultValue={holiday.notes} name="notes" />
                  </label>
                  <div className="self-end">
                    <Checkbox defaultChecked={holiday.enabled} form={formId} label="Enabled" name="enabled" />
                  </div>
                </form>
                <div className="flex gap-2 self-end">
                  <button className="focus-ring border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-teal-50" form={formId}>
                    Save
                  </button>
                  <form action={deleteHoliday}>
                    <input name="holidayId" type="hidden" value={holiday.id} />
                    <button className="focus-ring border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
          {data.holidays.length === 0 ? (
            <div className="border border-dashed border-[var(--line)] bg-white p-8 text-center text-sm text-[var(--muted)]">
              No holidays have been configured.
            </div>
          ) : null}
        </div>
      </section>
    </section>
  );
}
