import { updateNotificationTemplate } from "@/lib/actions";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EmailSettingsPage() {
  const data = await readData();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Email Templates</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Configure department and escalation notification emails.
        </p>
      </div>

      <form
        action={updateNotificationTemplate}
        className="grid gap-4 border border-[var(--line)] bg-[var(--panel)] p-4"
      >
        <div className="border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--muted)]">
          Available placeholders: {"{{vendor_name}}"}, {"{{invoice_number}}"},
          {"{{po_number}}"}, {"{{amount}}"}, {"{{department_name}}"},{" "}
          {"{{review_link}}"}, {"{{days_waiting}}"}
        </div>
        <h3 className="font-semibold">Department Review Email</h3>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Department Subject
          <input
            className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
            name="departmentSubject"
            defaultValue={data.notificationTemplate.departmentSubject}
            required
          />
        </label>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Department Body
          <textarea
            className="focus-ring mt-1 min-h-56 w-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-normal normal-case text-[var(--foreground)]"
            name="departmentBody"
            defaultValue={data.notificationTemplate.departmentBody}
            required
          />
        </label>
        <h3 className="border-t border-[var(--line)] pt-4 font-semibold">
          Escalation Email
        </h3>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Escalation Subject
          <input
            className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
            name="escalationSubject"
            defaultValue={data.notificationTemplate.escalationSubject}
            required
          />
        </label>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Escalation Body
          <textarea
            className="focus-ring mt-1 min-h-56 w-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-normal normal-case text-[var(--foreground)]"
            name="escalationBody"
            defaultValue={data.notificationTemplate.escalationBody}
            required
          />
        </label>
        <div className="flex justify-end">
          <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Save Email Templates
          </button>
        </div>
      </form>
    </section>
  );
}
