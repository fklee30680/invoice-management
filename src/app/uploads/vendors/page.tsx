import {
  deleteAllVendors,
  updateVendor,
  uploadVendorList,
} from "@/lib/actions";
import { DeleteVendorConfirmation } from "@/components/delete-vendor-confirmation";
import { VendorImportMappingForm } from "@/components/vendor-import-mapping-form";
import { requireApUser } from "@/lib/session";
import { readData } from "@/lib/store";
import { formatDate } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VendorUploadPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function vendorReferenceCount(
  data: Awaited<ReturnType<typeof readData>>,
  vendorId: string,
  vendorNumber: string,
) {
  const normalizedVendorNumber = vendorNumber.trim().toLowerCase();
  return data.invoices.filter(
    (invoice) =>
      invoice.vendorId === vendorId ||
      invoice.vendorRecordId === vendorId ||
      (normalizedVendorNumber &&
        (invoice.vendorNumber || "").trim().toLowerCase() === normalizedVendorNumber),
  ).length;
}

export default async function VendorUploadPage({
  searchParams,
}: VendorUploadPageProps) {
  await requireApUser();
  const data = await readData();
  const query = (await searchParams) || {};
  const settings = data.vendorImportSettings;
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
  const filteredVendors = data.vendors.filter((vendor) =>
    [
      vendor.vendorName,
      vendor.vendorNumber,
      vendor.email,
      vendor.active ? "active" : "inactive",
    ]
      .join(" ")
      .toLowerCase()
      .includes(search),
  );

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="border-b border-[var(--line)] pb-5">
          <h1 className="text-3xl font-semibold tracking-normal">
            Vendor File
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
            Import vendors of record. Vendor matching is used when invoices are
            validated against the vendor file.
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
            Imported {result.imported || "0"} vendors. Updated{" "}
            {result.updated || "0"}. Filled missing data on{" "}
            {result.filled || "0"}. Skipped {result.skipped || "0"}.
            Warnings {result.warnings || "0"}. Errors {result.errors || "0"}.
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

        <form
          action={uploadVendorList}
          className="space-y-5 border border-[var(--line)] bg-[var(--panel)] p-4"
        >
          <div>
            <h2 className="text-base font-semibold">Import Vendor File</h2>
            <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
              Choose the file and header row, then map each vendor field to a
              column from that row. Column selections are saved for the next
              import. Imported blank values will not overwrite existing vendor
              data.
            </p>
          </div>

          <VendorImportMappingForm settings={settings} />

          <section>
            <h3 className="text-sm font-semibold">Import Options</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="flex min-h-10 items-center gap-3 border border-[var(--line)] bg-white px-3 py-2 text-sm">
                <input
                  className="h-4 w-4 accent-[var(--accent)]"
                  defaultChecked={settings.updateExisting}
                  name="updateExisting"
                  type="checkbox"
                />
                <span>
                  <span className="block font-semibold">
                    Update existing vendors
                  </span>
                  <span className="block text-xs text-[var(--muted)]">
                    Imported nonblank values overwrite saved values.
                  </span>
                </span>
              </label>
              <label className="flex min-h-10 items-center gap-3 border border-[var(--line)] bg-white px-3 py-2 text-sm">
                <input
                  className="h-4 w-4 accent-[var(--accent)]"
                  defaultChecked={settings.fillMissingData}
                  name="fillMissingData"
                  type="checkbox"
                />
                <span>
                  <span className="block font-semibold">
                    Fill missing data on existing vendors
                  </span>
                  <span className="block text-xs text-[var(--muted)]">
                    Imported values fill blank fields without overwriting saved
                    values.
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section className="flex justify-end">
            <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
              Import Vendor File
            </button>
          </section>
        </form>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Vendors Of Record</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {data.vendors.length} vendors available for invoice validation.
            </p>
          </div>
          <form className="flex max-w-lg gap-2" method="get">
            <input
              className="focus-ring min-h-10 flex-1 border border-[var(--line)] bg-white px-3 text-sm"
              defaultValue={one(query.search)}
              name="search"
              placeholder="Search vendor, vendor number, email, or status"
            />
            <button className="focus-ring border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-slate-100">
              Search
            </button>
          </form>

          <div className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="border-b border-[var(--line)] px-3 py-3">
                    Vendor
                  </th>
                  <th className="border-b border-[var(--line)] px-3 py-3">
                    Vendor Number
                  </th>
                  <th className="border-b border-[var(--line)] px-3 py-3">
                    Email
                  </th>
                  <th className="border-b border-[var(--line)] px-3 py-3">
                    Status
                  </th>
                  <th className="border-b border-[var(--line)] px-3 py-3">
                    Uploaded
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
                {filteredVendors.map((vendor) => {
                  const rowFormId = `vendor-${vendor.id}`;
                  return (
                    <tr className="align-top hover:bg-slate-50" key={vendor.id}>
                      <td className="border-b border-[var(--line)] px-3 py-3 font-medium">
                        <form action={updateVendor} id={rowFormId}>
                          <input name="vendorId" type="hidden" value={vendor.id} />
                        </form>
                        <input
                          className="focus-ring min-h-9 w-full border border-[var(--line)] bg-white px-2 text-sm font-normal normal-case text-[var(--foreground)]"
                          defaultValue={vendor.vendorName}
                          form={rowFormId}
                          name="vendorName"
                          required
                        />
                      </td>
                      <td className="border-b border-[var(--line)] px-3 py-3">
                        <input
                          className="focus-ring min-h-9 w-full border border-[var(--line)] bg-white px-2 text-sm font-normal normal-case text-[var(--foreground)]"
                          defaultValue={vendor.vendorNumber}
                          form={rowFormId}
                          name="vendorNumber"
                          required
                        />
                      </td>
                      <td className="border-b border-[var(--line)] px-3 py-3">
                        <input
                          className="focus-ring min-h-9 w-full border border-[var(--line)] bg-white px-2 text-sm font-normal normal-case text-[var(--foreground)]"
                          defaultValue={vendor.email}
                          form={rowFormId}
                          name="email"
                          type="email"
                        />
                      </td>
                      <td className="border-b border-[var(--line)] px-3 py-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            className="h-4 w-4 accent-[var(--accent)]"
                            defaultChecked={vendor.active}
                            form={rowFormId}
                            name="active"
                            type="checkbox"
                          />
                          Active
                        </label>
                      </td>
                      <td className="border-b border-[var(--line)] px-3 py-3">
                        {formatDate(vendor.uploadedAt)}
                      </td>
                      <td className="border-b border-[var(--line)] px-3 py-3">
                        {vendor.updatedAt ? formatDate(vendor.updatedAt) : "Not set"}
                      </td>
                      <td className="border-b border-[var(--line)] px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="focus-ring border border-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-teal-50"
                            form={rowFormId}
                          >
                            Save
                          </button>
                          <DeleteVendorConfirmation
                            invoiceReferenceCount={vendorReferenceCount(
                              data,
                              vendor.id,
                              vendor.vendorNumber,
                            )}
                            vendorId={vendor.id}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredVendors.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-8 text-center text-[var(--muted)]"
                      colSpan={7}
                    >
                      {data.vendors.length === 0
                        ? "No vendor records have been imported."
                        : "No vendors match the current search."}
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
            Delete all vendors? This removes the entire imported vendor list.
            Existing invoices will not be deleted or changed, but vendor
            validation will no longer find these vendors.
          </p>
          <form
            action={deleteAllVendors}
            className="mt-3 flex flex-col gap-3 sm:flex-row"
          >
            <input
              className="focus-ring min-h-10 border border-red-300 bg-white px-3 text-sm"
              name="confirmPhrase"
              placeholder="Type DELETE"
            />
            <button className="focus-ring bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">
              Delete All Vendors
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
