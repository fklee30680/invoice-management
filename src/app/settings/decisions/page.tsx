import {
  addDepartmentDecision,
  deleteDepartmentDecision,
  updateDepartmentDecision,
} from "@/lib/actions";
import type { DecisionWorkflowAction } from "@/lib/types";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const workflowOptions: {
  value: DecisionWorkflowAction;
  label: string;
  description: string;
}[] = [
  {
    value: "complete",
    label: "Approve / Complete",
    description: "Marks the invoice completed and adds it to manual payment if unpaid.",
  },
  {
    value: "reject",
    label: "Reject",
    description: "Marks the invoice rejected.",
  },
  {
    value: "hold",
    label: "Hold",
    description: "Marks the invoice on hold.",
  },
  {
    value: "apRework",
    label: "Return To AP Rework",
    description: "Sends the invoice back to AP for correction or rerouting.",
  },
];

function usageCount(decision: string, data: Awaited<ReturnType<typeof readData>>) {
  return data.invoices.filter((invoice) => invoice.departmentDecision === decision)
    .length;
}

function Checkbox({
  label,
  name,
  defaultChecked,
  form,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  form?: string;
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

export default async function DecisionSettingsPage() {
  const data = await readData();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Decision Types</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Configure the choices department users see when reviewing invoices. The
          workflow action controls what happens after the decision is submitted.
        </p>
      </div>

      <form
        action={addDepartmentDecision}
        className="grid gap-3 border border-[var(--line)] bg-[var(--panel)] p-4 lg:grid-cols-[1fr_240px_220px_auto]"
      >
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          New Decision
          <input
            className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
            name="label"
            placeholder="Approved for payment"
            required
          />
        </label>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Workflow Action
          <select
            className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
            defaultValue="complete"
            name="workflowAction"
          >
            {workflowOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="grid gap-2 border border-[var(--line)] bg-white px-3 py-2">
          <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">
            Options
          </legend>
          <Checkbox defaultChecked label="Active" name="active" />
          <Checkbox label="Require comment" name="requireComment" />
        </fieldset>
        <button className="focus-ring self-end bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
          Add Decision
        </button>
      </form>

      <section className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
        <table className="w-full min-w-[1050px] table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[24%]" />
            <col className="w-[18%]" />
            <col className="w-[10%]" />
            <col className="w-[24%]" />
          </colgroup>
          <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="border-b border-[var(--line)] px-3 py-3">Decision</th>
              <th className="border-b border-[var(--line)] px-3 py-3">
                Workflow Action
              </th>
              <th className="border-b border-[var(--line)] px-3 py-3">Options</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Invoices</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.departmentDecisions.map((decision) => {
              const formId = `decision-${decision.id}`;
              const deleteFormId = `delete-${decision.id}`;
              const count = usageCount(decision.label, data);
              const replacementOptions = data.departmentDecisions.filter(
                (candidate) => candidate.id !== decision.id,
              );
              const canDelete = count === 0 || replacementOptions.length > 0;

              return (
                <tr className="align-top hover:bg-slate-50" key={decision.id}>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    <form action={updateDepartmentDecision} id={formId}>
                      <input name="decisionId" type="hidden" value={decision.id} />
                      <input
                        className="focus-ring min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-medium"
                        defaultValue={decision.label}
                        name="label"
                        required
                      />
                    </form>
                  </td>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    <select
                      className="focus-ring min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm"
                      defaultValue={decision.workflowAction}
                      form={formId}
                      name="workflowAction"
                    >
                      {workflowOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 text-xs text-[var(--muted)]">
                      {
                        workflowOptions.find(
                          (option) => option.value === decision.workflowAction,
                        )?.description
                      }
                    </div>
                  </td>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    <div className="grid gap-2">
                      <Checkbox
                        defaultChecked={decision.active}
                        form={formId}
                        label="Active"
                        name="active"
                      />
                      <Checkbox
                        defaultChecked={decision.requireComment}
                        form={formId}
                        label="Require comment"
                        name="requireComment"
                      />
                    </div>
                  </td>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    {count}
                  </td>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    <label className="mb-3 block text-xs font-semibold uppercase text-[var(--muted)]">
                      Move To Before Delete
                      <select
                        className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)] disabled:opacity-45"
                        disabled={count === 0}
                        form={deleteFormId}
                        name="replacementDecisionId"
                        required={count > 0}
                      >
                        <option value="">
                          {count > 0 ? "Select replacement" : "Not needed"}
                        </option>
                        {replacementOptions.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="focus-ring border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-teal-50"
                        form={formId}
                      >
                        Save
                      </button>
                      <form action={deleteDepartmentDecision} id={deleteFormId}>
                        <input name="decisionId" type="hidden" value={decision.id} />
                        <button
                          className="focus-ring border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
                          disabled={!canDelete}
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                    {!canDelete ? (
                      <div className="mt-2 text-xs text-[var(--muted)]">
                        Add another decision before deleting this one.
                      </div>
                    ) : count > 0 ? (
                      <div className="mt-2 text-xs text-[var(--muted)]">
                        Deleting will move current invoice decisions to the
                        selected replacement.
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </section>
  );
}
