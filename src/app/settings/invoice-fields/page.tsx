import { updateInvoiceFields } from "@/lib/actions";
import { normalizeInvoiceFields } from "@/lib/invoice-fields";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function InvoiceFieldsPage() {
  const data = await readData();
  const fields = normalizeInvoiceFields(data.invoiceFields);
  const poRequiredInUse = data.departmentDecisions.some(
    (decision) => decision.requirePoNumber,
  );

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Invoice Fields</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Choose which invoice fields your organization uses. Inactive fields will
          be hidden from invoice entry, review, and edit screens.
        </p>
      </div>

      {poRequiredInUse ? (
        <div className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          PO Number cannot be turned off while one or more decision types require
          PO. Turn off Require PO on Decision Types before disabling PO Number.
        </div>
      ) : null}

      <form action={updateInvoiceFields} className="space-y-4">
        <div className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
          <table className="w-full min-w-[850px] border-collapse text-left text-sm">
            <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="border-b border-[var(--line)] px-3 py-3">Field</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Used By AP</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Required</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Type</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => {
                const preventPoDisable = field.key === "poNumber" && poRequiredInUse;
                const locked = field.locked || preventPoDisable;
                return (
                  <tr className="align-top hover:bg-slate-50" key={field.key}>
                    <td className="border-b border-[var(--line)] px-3 py-3 font-medium">
                      {field.label}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          className="h-4 w-4 accent-[var(--accent)] disabled:opacity-45"
                          defaultChecked={field.enabled}
                          disabled={locked}
                          name={`enabled:${field.key}`}
                          type="checkbox"
                        />
                        Use this field
                      </label>
                      {field.locked ? (
                        <div className="mt-1 text-xs text-[var(--muted)]">
                          Locked on for workflow.
                        </div>
                      ) : null}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {field.readOnly ? (
                        <span className="text-[var(--muted)]">Read only</span>
                      ) : (
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            className="h-4 w-4 accent-[var(--accent)]"
                            defaultChecked={field.requiredForAp}
                            name={`requiredForAp:${field.key}`}
                            type="checkbox"
                          />
                          Required for AP entry
                        </label>
                      )}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {field.systemControlled
                        ? "System field"
                        : field.readOnly
                          ? "Read only"
                          : "Editable"}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3 text-[var(--muted)]">
                      {field.key === "departmentId"
                        ? "Department is required for routing."
                        : field.key === "status"
                          ? "Status is required for workflow."
                          : preventPoDisable
                            ? "PO Number is required by at least one decision type."
                            : field.systemControlled
                              ? "Can be hidden from screens; the system still tracks it internally."
                              : "Turning this off hides the field but preserves existing data."}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border border-[var(--line)] bg-white p-4 text-sm text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>
            Turning off a field hides it from invoice screens but does not delete
            existing invoice data.
          </span>
          <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Save Invoice Fields
          </button>
        </div>
      </form>
    </section>
  );
}
