import { updateNotificationTemplate } from "@/lib/actions";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EmailSettingsPage() {
  const data = await readData();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Email Template</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Configure the department notification that is sent when an invoice is
          routed for review.
        </p>
      </div>

      <form
        action={updateNotificationTemplate}
        className="grid gap-4 border border-[var(--line)] bg-[var(--panel)] p-4"
      >
        <div className="border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--muted)]">
          Available placeholders: {"{{vendor_name}}"}, {"{{invoice_number}}"},
          {"{{po_number}}"}, {"{{amount}}"}, {"{{department_name}}"}, {"{{review_link}}"}
        </div>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Subject
          <input
            className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
            name="departmentSubject"
            defaultValue={data.notificationTemplate.departmentSubject}
            required
          />
        </label>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Body
          <textarea
            className="focus-ring mt-1 min-h-56 w-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-normal normal-case text-[var(--foreground)]"
            name="departmentBody"
            defaultValue={data.notificationTemplate.departmentBody}
            required
          />
        </label>
        <div className="flex justify-end">
          <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Save Email Template
          </button>
        </div>
      </form>
    </section>
  );
}
