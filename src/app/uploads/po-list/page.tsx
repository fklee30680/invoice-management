import { uploadPoList } from "@/lib/actions";
import { requireApUser } from "@/lib/session";
import { readData } from "@/lib/store";
import { formatDate } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PoListUploadPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function departmentName(data: Awaited<ReturnType<typeof readData>>, departmentId: string) {
  return (
    data.departments.find((department) => department.id === departmentId)?.name ||
    "Unassigned"
  );
}

function TextInput({
  defaultValue,
  helperText,
  label,
  name,
  placeholder,
  required,
  type = "text",
}: {
  defaultValue?: string | number;
  helperText?: string;
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="text-xs font-semibold uppercase text-[var(--muted)]">
      {label}
      <input
        className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
        defaultValue={defaultValue}
        min={type === "number" ? 1 : undefined}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
      {helperText ? (
        <span className="mt-1 block text-xs font-normal normal-case text-[var(--muted)]">
          {helperText}
        </span>
      ) : null}
    </label>
  );
}

export default async function PoListUploadPage({
  searchParams,
}: PoListUploadPageProps) {
  await requireApUser();
  const data = await readData();
  const query = (await searchParams) || {};
  const settings = data.poImportSettings;
  const result = {
    imported: one(query.imported),
    updated: one(query.updated),
    skipped: one(query.skipped),
    warnings: one(query.warnings),
    errors: one(query.errors),
  };
  const hasResult = Object.values(result).some(Boolean);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="border-b border-[var(--line)] pb-5">
          <h1 className="text-3xl font-semibold tracking-normal">
            PO List Update
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
            Import purchase orders used for automatic department routing.
          </p>
        </header>

        {hasResult ? (
          <section
            className={`border px-4 py-3 text-sm ${
              result.errors !== "0"
                ? "border-red-300 bg-red-50 text-red-900"
                : "border-emerald-300 bg-emerald-50 text-emerald-900"
            }`}
          >
            Imported {result.imported || "0"} POs. Updated {result.updated || "0"}.
            Skipped {result.skipped || "0"}. Warnings {result.warnings || "0"}.
            Errors {result.errors || "0"}.
          </section>
        ) : null}

        <form
          action={uploadPoList}
          className="space-y-4 border border-[var(--line)] bg-[var(--panel)] p-4"
        >
          <div>
            <h2 className="text-base font-semibold">Import PO List</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              For column fields, enter the column header name or spreadsheet
              column letter, such as A, B, C. Upload Date is recorded
              automatically and is not imported from the file.
            </p>
          </div>

          <section>
            <h3 className="text-sm font-semibold">Import Mapping</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <TextInput
                defaultValue={settings.headerRow}
                helperText="Enter the row number that contains column headers."
                label="Header Row"
                name="headerRow"
                required
                type="number"
              />
              <TextInput
                defaultValue={settings.poNumberColumn}
                label="PO Number Column"
                name="poNumberColumn"
                placeholder="PO Number or A"
                required
              />
              <TextInput
                defaultValue={settings.vendorNameColumn}
                label="Vendor Name Column"
                name="vendorNameColumn"
                placeholder="Vendor Name or B"
                required
              />
              <TextInput
                defaultValue={settings.vendorNumberColumn}
                label="Vendor Number Column"
                name="vendorNumberColumn"
                placeholder="Vendor Number or C"
              />
              <TextInput
                defaultValue={settings.departmentColumn}
                label="Department Column"
                name="departmentColumn"
                placeholder="Department or D"
                required
              />
              <label className="flex min-h-10 items-center gap-3 self-end border border-[var(--line)] bg-white px-3 py-2 text-sm">
                <input
                  className="h-4 w-4 accent-[var(--accent)]"
                  defaultChecked={settings.updateExisting}
                  name="updateExisting"
                  type="checkbox"
                />
                <span>
                  <span className="block font-semibold">Update existing POs</span>
                  <span className="block text-xs text-[var(--muted)]">
                    Rows with an existing PO number update the saved PO record.
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold">Upload</h3>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                accept=".csv,.xlsx,.xls"
                className="focus-ring min-h-10 flex-1 border border-[var(--line)] bg-white px-3 py-2 text-sm"
                name="poFile"
                required
                type="file"
              />
              <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
                Import PO List
              </button>
            </div>
          </section>
        </form>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Purchase Orders</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {data.purchaseOrders.length} purchase orders available for invoice
              routing.
            </p>
          </div>

          <div className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="border-b border-[var(--line)] px-3 py-3">PO</th>
                  <th className="border-b border-[var(--line)] px-3 py-3">
                    Vendor
                  </th>
                  <th className="border-b border-[var(--line)] px-3 py-3">
                    Vendor Number
                  </th>
                  <th className="border-b border-[var(--line)] px-3 py-3">
                    Department
                  </th>
                  <th className="border-b border-[var(--line)] px-3 py-3">
                    Upload Date
                  </th>
                  <th className="border-b border-[var(--line)] px-3 py-3">
                    Last Updated
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.purchaseOrders.map((po) => (
                  <tr className="align-top hover:bg-slate-50" key={po.id}>
                    <td className="border-b border-[var(--line)] px-3 py-3 font-mono text-xs">
                      {po.poNumber}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3 font-medium">
                      {po.vendorName}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {po.vendorNumber || "Not set"}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {po.departmentId
                        ? departmentName(data, po.departmentId)
                        : po.departmentName || "Unassigned"}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {formatDate(po.uploadedAt)}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {po.updatedAt ? formatDate(po.updatedAt) : "Not set"}
                    </td>
                  </tr>
                ))}
                {data.purchaseOrders.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-8 text-center text-[var(--muted)]"
                      colSpan={6}
                    >
                      No purchase orders have been imported.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
