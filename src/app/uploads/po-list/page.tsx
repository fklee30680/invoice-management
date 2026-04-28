import Image from "next/image";
import { uploadPoList } from "@/lib/actions";
import { requireApUser } from "@/lib/session";
import { readData } from "@/lib/store";
import { formatDate } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function departmentName(data: Awaited<ReturnType<typeof readData>>, departmentId: string) {
  return (
    data.departments.find((department) => department.id === departmentId)?.name ||
    "Unassigned"
  );
}

export default async function PoListUploadPage() {
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
                PO List Update
              </h1>
            </div>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
            Import purchase orders used for automatic department routing.
          </p>
        </header>

        <form
          action={uploadPoList}
          className="space-y-4 border border-[var(--line)] bg-[var(--panel)] p-4"
        >
          <div>
            <h2 className="text-base font-semibold">Import PO List</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Required columns: PO number, vendor, department.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
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
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="border-b border-[var(--line)] px-3 py-3">PO</th>
                  <th className="border-b border-[var(--line)] px-3 py-3">
                    Vendor
                  </th>
                  <th className="border-b border-[var(--line)] px-3 py-3">
                    Department
                  </th>
                  <th className="border-b border-[var(--line)] px-3 py-3">
                    Uploaded
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
                      {departmentName(data, po.departmentId)}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {formatDate(po.uploadedAt)}
                    </td>
                  </tr>
                ))}
                {data.purchaseOrders.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-8 text-center text-[var(--muted)]"
                      colSpan={4}
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
