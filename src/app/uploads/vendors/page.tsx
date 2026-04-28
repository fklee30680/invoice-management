import Image from "next/image";
import { uploadVendorList } from "@/lib/actions";
import { requireApUser } from "@/lib/session";
import { readData } from "@/lib/store";
import { formatDate } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function TextInput({
  defaultValue,
  label,
  name,
  placeholder,
  required,
  type = "text",
}: {
  defaultValue?: string;
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
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}

export default async function VendorUploadPage() {
  await requireApUser();
  const data = await readData();
  const branding = data.branding;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="border-b border-[var(--line)] pb-5">
          <div className="flex flex-wrap items-center gap-3">
            {branding.logo ? (
              <Image
                alt={`${branding.appTitle} logo`}
                className="max-h-12 max-w-40 object-contain"
                height={48}
                src="/branding/logo"
                unoptimized
                width={160}
              />
            ) : null}
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-[var(--accent)]">
                Files
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-normal">
                Vendor File
              </h1>
            </div>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
            Import vendors of record. Vendor matching is used when an invoice has
            no matching purchase order.
          </p>
        </header>

        <form
          action={uploadVendorList}
          className="space-y-4 border border-[var(--line)] bg-[var(--panel)] p-4"
        >
          <div>
            <h2 className="text-base font-semibold">Import Vendor File</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Map each field to either a column header from the file or a column
              letter such as A, B, or C.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <TextInput
              defaultValue="1"
              label="Header Row Number"
              name="headerRow"
              required
              type="number"
            />
            <TextInput
              defaultValue="Vendor Name"
              label="Vendor Name Column"
              name="vendorNameColumn"
              placeholder="Vendor Name or A"
              required
            />
            <TextInput
              label="Vendor Number Column"
              name="vendorNumberColumn"
              placeholder="Vendor Number or B"
            />
            <TextInput
              label="Vendor Email Column"
              name="vendorEmailColumn"
              placeholder="Email or C"
              type="text"
            />
            <TextInput
              label="Active Column"
              name="activeColumn"
              placeholder="Status or D"
            />
            <label className="text-xs font-semibold uppercase text-[var(--muted)]">
              Vendor File
              <input
                accept=".csv,.xlsx,.xls"
                className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 py-2 text-sm font-normal normal-case text-[var(--foreground)]"
                name="vendorFile"
                required
                type="file"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
              Import Vendor File
            </button>
          </div>
        </form>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold">Vendors Of Record</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {data.vendors.length} vendors available for invoice validation.
            </p>
          </div>

          <div className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
            <table className="w-full min-w-[800px] border-collapse text-left text-sm">
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
                </tr>
              </thead>
              <tbody>
                {data.vendors.map((vendor) => (
                  <tr className="align-top hover:bg-slate-50" key={vendor.id}>
                    <td className="border-b border-[var(--line)] px-3 py-3 font-medium">
                      {vendor.vendorName}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {vendor.vendorNumber || "Not set"}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {vendor.email || "Not set"}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {vendor.active ? "Active" : "Inactive"}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {formatDate(vendor.uploadedAt)}
                    </td>
                  </tr>
                ))}
                {data.vendors.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-8 text-center text-[var(--muted)]"
                      colSpan={5}
                    >
                      No vendor records have been imported.
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
