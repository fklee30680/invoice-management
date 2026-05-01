import { updatePoValidationSettings } from "@/lib/actions";
import { invoiceFieldEnabled } from "@/lib/invoice-fields";
import { normalizePoValidationSettings } from "@/lib/po-validation";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function Checkbox({
  checked,
  label,
  name,
}: {
  checked: boolean;
  label: string;
  name: string;
}) {
  return (
    <label className="flex items-start gap-3 border border-[var(--line)] bg-white p-3 text-sm">
      <input
        className="mt-1 h-4 w-4 accent-[var(--accent)]"
        defaultChecked={checked}
        name={name}
        type="checkbox"
      />
      <span className="font-semibold">{label}</span>
    </label>
  );
}

export default async function PoValidationPage() {
  const data = await readData();
  const settings = normalizePoValidationSettings(data.poValidationSettings);
  const poNumberEnabled = invoiceFieldEnabled(data, "poNumber");

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">PO Validation</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Configure whether invoice PO numbers are validated against the imported
          PO list.
        </p>
      </div>

      {!poNumberEnabled ? (
        <div className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          PO Number is disabled in Invoice Fields. PO validation will not run
          until PO Number is enabled.
        </div>
      ) : null}

      <form action={updatePoValidationSettings} className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <Checkbox
            checked={settings.enabled}
            label="Enable PO Validation"
            name="enabled"
          />
          <Checkbox
            checked={settings.requirePoToExistInPoList}
            label="Require PO to Exist in PO List"
            name="requirePoToExistInPoList"
          />
          <Checkbox
            checked={settings.blockSaveOnVendorMismatch}
            label="Block Vendor Mismatch"
            name="blockSaveOnVendorMismatch"
          />
          <Checkbox
            checked={settings.allowVendorUpdateFromPo}
            label="Allow Vendor Update From PO"
            name="allowVendorUpdateFromPo"
          />
          <Checkbox
            checked={settings.fuzzyVendorMatch}
            label="Fuzzy Vendor Matching"
            name="fuzzyVendorMatch"
          />
          <label className="border border-[var(--line)] bg-white p-3 text-sm font-semibold">
            Vendor Match Threshold
            <input
              className="focus-ring mt-2 min-h-10 w-full border border-[var(--line)] px-3 text-sm font-normal"
              defaultValue={settings.vendorMatchThreshold}
              max={1}
              min={0}
              name="vendorMatchThreshold"
              step="0.01"
              type="number"
            />
            <span className="mt-1 block text-xs font-normal text-[var(--muted)]">
              Default is 0.85. Higher values require closer vendor matches.
            </span>
          </label>
        </div>

        <div className="flex justify-end">
          <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Save PO Validation
          </button>
        </div>
      </form>
    </section>
  );
}
