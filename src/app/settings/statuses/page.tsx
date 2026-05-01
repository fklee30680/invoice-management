import {
  addInvoiceStatus,
  deleteInvoiceStatus,
  updateInvoiceStatus,
} from "@/lib/actions";
import {
  STATUS_TONES,
  STATUS_TONE_CLASSES,
  statusRoleLabel,
  statusRoles,
} from "@/lib/status-config";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function usageCount(status: string, data: Awaited<ReturnType<typeof readData>>) {
  return data.invoices.filter((invoice) => invoice.status === status).length;
}

function Checkbox({
  label,
  name,
  defaultChecked,
  disabled,
  form,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
  disabled?: boolean;
  form?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium normal-case text-[var(--foreground)]">
      <input
        className="h-4 w-4 accent-[var(--accent)]"
        defaultChecked={defaultChecked}
        disabled={disabled}
        form={form}
        name={name}
        type="checkbox"
      />
      {label}
    </label>
  );
}

export default async function StatusSettingsPage() {
  const data = await readData();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Statuses</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Configure invoice status names, badge colors, filter choices, and which
          records show in the AP, department, and completed invoice areas.
        </p>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
          Statuses used by invoices or workflow routing can be deleted after you
          choose a replacement status. Any workflow behavior assigned to the
          deleted status will move to the replacement.
        </p>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
          Include in Payment File allows invoices in that status to be exported
          only when their department decision type is also payment-file eligible.
        </p>
      </div>

      <form
        action={addInvoiceStatus}
        className="grid gap-3 border border-[var(--line)] bg-[var(--panel)] p-4 lg:grid-cols-[1fr_180px_1.5fr_auto]"
      >
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          New Status
          <input
            className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
            name="label"
            placeholder="Waiting on vendor"
            required
          />
        </label>
        <label className="text-xs font-semibold uppercase text-[var(--muted)]">
          Badge Color
          <select
            className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
            name="tone"
            defaultValue="blue"
          >
            {STATUS_TONES.map((tone) => (
              <option key={tone} value={tone}>
                {tone}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="grid gap-2 border border-[var(--line)] bg-white px-3 py-2 sm:grid-cols-2">
          <legend className="px-1 text-xs font-semibold uppercase text-[var(--muted)]">
            Show Records In
          </legend>
          <Checkbox defaultChecked label="Status filter" name="showInFilter" />
          <Checkbox label="AP work area" name="showInApWorkQueue" />
          <Checkbox label="Department work area" name="showInDepartmentWork" />
          <Checkbox label="Completed list" name="showInCompleted" />
          <Checkbox label="Escalation processing" name="includeInEscalation" />
          <Checkbox label="Include in Payment File" name="includeInPaymentFile" />
        </fieldset>
        <button className="focus-ring self-end bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
          Add Status
        </button>
      </form>

      <section className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
        <table className="w-full min-w-[980px] table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[18%]" />
            <col className="w-[30%]" />
            <col className="w-[8%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
            <tr>
              <th className="border-b border-[var(--line)] px-3 py-3">Status</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Badge</th>
              <th className="border-b border-[var(--line)] px-3 py-3">
                Show Records In
              </th>
              <th className="border-b border-[var(--line)] px-3 py-3">Invoices</th>
              <th className="border-b border-[var(--line)] px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.statuses.map((status) => {
              const formId = `status-${status.id}`;
              const deleteFormId = `delete-${status.id}`;
              const count = usageCount(status.label, data);
              const roleLabel = statusRoleLabel(status);
              const protectedProcessedForPayment = statusRoles(status).includes(
                "processedForPayment",
              );
              const replacementOptions = data.statuses.filter(
                (candidate) => candidate.id !== status.id,
              );
              const needsReplacement = Boolean(roleLabel || count > 0);
              const canDelete =
                !protectedProcessedForPayment &&
                (!needsReplacement || replacementOptions.length > 0);

              return (
                <tr className="align-top hover:bg-slate-50" key={status.id}>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    <form action={updateInvoiceStatus} id={formId}>
                      <input name="statusId" type="hidden" value={status.id} />
                      <input
                        className="focus-ring min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-medium"
                        name="label"
                        defaultValue={status.label}
                        required
                      />
                      {roleLabel ? (
                        <div className="mt-1 break-words text-xs text-[var(--muted)]">
                          Workflow: {roleLabel}
                        </div>
                      ) : null}
                      {protectedProcessedForPayment ? (
                        <div className="mt-1 text-xs text-[var(--muted)]">
                          This system status is used when AP processes invoices for
                          payment. Only the name can be changed.
                        </div>
                      ) : null}
                    </form>
                  </td>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    <select
                      className="focus-ring min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm"
                      defaultValue={status.tone}
                      disabled={protectedProcessedForPayment}
                      form={formId}
                      name="tone"
                    >
                      {STATUS_TONES.map((tone) => (
                        <option key={tone} value={tone}>
                          {tone}
                        </option>
                      ))}
                    </select>
                    <span
                      className={`mt-2 inline-flex max-w-full break-words border px-2 py-1 text-xs font-semibold ${STATUS_TONE_CLASSES[status.tone]}`}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Checkbox
                        defaultChecked={status.showInFilter}
                        disabled={protectedProcessedForPayment}
                        form={formId}
                        label="Status filter"
                        name="showInFilter"
                      />
                      <Checkbox
                        defaultChecked={status.showInApWorkQueue}
                        disabled={protectedProcessedForPayment}
                        form={formId}
                        label="AP work area"
                        name="showInApWorkQueue"
                      />
                      <Checkbox
                        defaultChecked={status.showInDepartmentWork}
                        disabled={protectedProcessedForPayment}
                        form={formId}
                        label="Department work area"
                        name="showInDepartmentWork"
                      />
                      <Checkbox
                        defaultChecked={status.showInCompleted}
                        disabled={protectedProcessedForPayment}
                        form={formId}
                        label="Completed list"
                        name="showInCompleted"
                      />
                      <Checkbox
                        defaultChecked={status.includeInEscalation}
                        disabled={protectedProcessedForPayment}
                        form={formId}
                        label="Escalation processing"
                        name="includeInEscalation"
                      />
                      <Checkbox
                        defaultChecked={status.includeInPaymentFile}
                        disabled={protectedProcessedForPayment}
                        form={formId}
                        label="Include in Payment File"
                        name="includeInPaymentFile"
                      />
                    </div>
                  </td>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    {count}
                  </td>
                  <td className="border-b border-[var(--line)] px-3 py-3">
                    {!protectedProcessedForPayment ? (
                      <label className="mb-3 block text-xs font-semibold uppercase text-[var(--muted)]">
                        Move To Before Delete
                        <select
                          className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)] disabled:opacity-45"
                          disabled={!needsReplacement}
                          form={deleteFormId}
                          name="replacementStatusId"
                          required={needsReplacement}
                        >
                          <option value="">
                            {needsReplacement
                              ? "Select replacement"
                              : "Not needed"}
                          </option>
                          {replacementOptions.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="focus-ring border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-teal-50"
                        form={formId}
                      >
                        Save
                      </button>
                      {!protectedProcessedForPayment ? (
                        <form action={deleteInvoiceStatus} id={deleteFormId}>
                          <input name="statusId" type="hidden" value={status.id} />
                          <button
                            className="focus-ring border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
                            disabled={!canDelete}
                          >
                            Delete
                          </button>
                        </form>
                      ) : null}
                    </div>
                    {protectedProcessedForPayment ? null : !canDelete ? (
                      <div className="mt-2 text-xs text-[var(--muted)]">
                        Add another status before deleting this one.
                      </div>
                    ) : needsReplacement ? (
                      <div className="mt-2 text-xs text-[var(--muted)]">
                        Deleting will move current invoices and any workflow role
                        to the selected replacement.
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
