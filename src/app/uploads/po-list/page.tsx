import {
  deleteAllPurchaseOrders,
  updatePurchaseOrder,
  uploadPoList,
} from "@/lib/actions";
import { CollapsibleSection } from "@/components/collapsible-section";
import { DeletePoConfirmation } from "@/components/delete-po-confirmation";
import { requireApUser } from "@/lib/session";
import { readData } from "@/lib/store";
import { formatDate, normalizePoNumber } from "@/lib/utils";

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
    filled: one(query.filled),
    skipped: one(query.skipped),
    warnings: one(query.warnings),
    errors: one(query.errors),
  };
  const message = one(query.message);
  const messageType = one(query.messageType);
  const search = one(query.search).toLowerCase();
  const hasResult = Object.values(result).some(Boolean);
  const importSectionOpen =
    hasResult || messageType === "error" || messageType === "warning";
  const filteredPurchaseOrders = data.purchaseOrders.filter((po) =>
    [po.poNumber, po.vendorName, po.vendorNumber, po.departmentName]
      .join(" ")
      .toLowerCase()
      .includes(search),
  );

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
            Filled missing data on {result.filled || "0"}. Skipped{" "}
            {result.skipped || "0"}. Warnings {result.warnings || "0"}. Errors{" "}
            {result.errors || "0"}.
          </section>
        ) : null}

        {message ? (
          <section
            className={`border px-4 py-3 text-sm ${
              messageType === "error"
                ? "border-red-300 bg-red-50 text-red-900"
                : messageType === "warning"
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-emerald-300 bg-emerald-50 text-emerald-900"
            }`}
          >
            {message}
          </section>
        ) : null}

        <CollapsibleSection
          defaultOpen={importSectionOpen}
          summaryText={
            hasResult
              ? "Recent import result available"
              : importSectionOpen
                ? "Review message available"
                : "Collapsed"
          }
          title="Import PO List"
        >
          <form action={uploadPoList} className="space-y-4">
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
                    Imported nonblank values overwrite saved values.
                  </span>
                </span>
              </label>
              <label className="flex min-h-10 items-center gap-3 self-end border border-[var(--line)] bg-white px-3 py-2 text-sm">
                <input
                  className="h-4 w-4 accent-[var(--accent)]"
                  defaultChecked={settings.fillMissingData}
                  name="fillMissingData"
                  type="checkbox"
                />
                <span>
                  <span className="block font-semibold">
                    Fill missing data on existing POs
                  </span>
                  <span className="block text-xs text-[var(--muted)]">
                    Imported values fill blank fields without overwriting saved
                    values.
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
        </CollapsibleSection>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Purchase Orders</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {data.purchaseOrders.length} purchase orders available for invoice
              routing.
            </p>
          </div>
          <CollapsibleSection
            defaultOpen={Boolean(search)}
            summaryText={
              search
                ? `${filteredPurchaseOrders.length} of ${data.purchaseOrders.length} shown`
                : "Collapsed"
            }
            title="Search Purchase Orders"
          >
            <form className="flex max-w-lg gap-2" method="get">
              <input
                className="focus-ring min-h-10 flex-1 border border-[var(--line)] bg-white px-3 text-sm"
                defaultValue={one(query.search)}
                name="search"
                placeholder="Search PO, vendor, vendor number, or department"
              />
              <button className="focus-ring border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-slate-100">
                Search
              </button>
            </form>
          </CollapsibleSection>

          <div className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
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
                  <th className="border-b border-[var(--line)] px-3 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchaseOrders.map((po) => {
                  const rowFormId = `po-${po.id}`;
                  const invoiceReferenceCount = data.invoices.filter(
                    (invoice) =>
                      normalizePoNumber(invoice.poNumber) === po.normalizedPoNumber,
                  ).length;

                  return (
                    <tr className="align-top hover:bg-slate-50" key={po.id}>
                      <td className="border-b border-[var(--line)] px-3 py-3 font-mono text-xs">
                        <form action={updatePurchaseOrder} id={rowFormId}>
                          <input
                            name="purchaseOrderId"
                            type="hidden"
                            value={po.id}
                          />
                        </form>
                        <input
                          className="focus-ring min-h-9 w-full border border-[var(--line)] bg-white px-2 text-xs font-normal normal-case text-[var(--foreground)]"
                          defaultValue={po.poNumber}
                          form={rowFormId}
                          name="poNumber"
                          required
                        />
                      </td>
                      <td className="border-b border-[var(--line)] px-3 py-3 font-medium">
                        <input
                          className="focus-ring min-h-9 w-full border border-[var(--line)] bg-white px-2 text-sm font-normal normal-case text-[var(--foreground)]"
                          defaultValue={po.vendorName}
                          form={rowFormId}
                          name="vendorName"
                          required
                        />
                      </td>
                      <td className="border-b border-[var(--line)] px-3 py-3">
                        <input
                          className="focus-ring min-h-9 w-full border border-[var(--line)] bg-white px-2 text-sm font-normal normal-case text-[var(--foreground)]"
                          defaultValue={po.vendorNumber}
                          form={rowFormId}
                          name="vendorNumber"
                        />
                      </td>
                      <td className="border-b border-[var(--line)] px-3 py-3">
                        <input
                          className="focus-ring min-h-9 w-full border border-[var(--line)] bg-white px-2 text-sm font-normal normal-case text-[var(--foreground)]"
                          defaultValue={
                            po.departmentId
                              ? departmentName(data, po.departmentId)
                              : po.departmentName
                          }
                          form={rowFormId}
                          name="departmentName"
                          required
                        />
                      </td>
                      <td className="border-b border-[var(--line)] px-3 py-3">
                        {formatDate(po.uploadedAt)}
                      </td>
                      <td className="border-b border-[var(--line)] px-3 py-3">
                        {po.updatedAt ? formatDate(po.updatedAt) : "Not set"}
                      </td>
                      <td className="border-b border-[var(--line)] px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="focus-ring border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-teal-50"
                            form={rowFormId}
                          >
                            Save
                          </button>
                          <DeletePoConfirmation
                            invoiceReferenceCount={invoiceReferenceCount}
                            purchaseOrderId={po.id}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredPurchaseOrders.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-8 text-center text-[var(--muted)]"
                      colSpan={7}
                    >
                      {data.purchaseOrders.length === 0
                        ? "No purchase orders have been imported."
                        : "No purchase orders match the current search."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border border-red-200 bg-red-50 p-4">
          <h2 className="text-base font-semibold text-red-900">Danger Zone</h2>
          <p className="mt-1 max-w-3xl text-sm text-red-900">
            Delete all POs? This removes the entire imported PO list. Existing
            invoices will not be deleted, but PO validation will no longer find
            these POs.
          </p>
          <form
            action={deleteAllPurchaseOrders}
            className="mt-3 flex flex-col gap-3 sm:flex-row"
          >
            <input
              className="focus-ring min-h-10 border border-red-300 bg-white px-3 text-sm"
              name="confirmPhrase"
              placeholder="Type DELETE"
            />
            <button className="focus-ring bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">
              Delete All POs
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
