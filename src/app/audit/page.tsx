import Image from "next/image";
import Link from "next/link";
import { requireApUser } from "@/lib/session";
import { readData } from "@/lib/store";
import { formatDateTime } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = await requireApUser();
  const data = await readData();
  const branding = data.branding;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              className="focus-ring inline-flex border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-100"
              href="/"
            >
              Back to Dashboard
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-3">
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
                  AP Audit
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-normal">
                  Audit Log
                </h1>
              </div>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Review invoice uploads, routing changes, department decisions,
              notifications, setup changes, and deletion activity.
            </p>
          </div>
          <div className="border border-[var(--line)] bg-white px-4 py-3 text-sm">
            <div className="font-semibold">{user.name}</div>
            <div className="mt-1 text-[var(--muted)]">AP access required</div>
          </div>
        </header>

        <section className="overflow-x-auto border border-[var(--line)] bg-[var(--panel)]">
          <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
            <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
              <tr>
                <th className="border-b border-[var(--line)] px-3 py-3">Date</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Actor</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Type</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Invoice</th>
                <th className="border-b border-[var(--line)] px-3 py-3">Message</th>
              </tr>
            </thead>
            <tbody>
              {data.auditEvents.map((event) => {
                const invoice = event.invoiceId
                  ? data.invoices.find((item) => item.id === event.invoiceId)
                  : undefined;

                return (
                  <tr className="align-top hover:bg-slate-50" key={event.id}>
                    <td className="border-b border-[var(--line)] px-3 py-3 text-[var(--muted)]">
                      {formatDateTime(event.createdAt)}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {event.actor}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3 font-mono text-xs uppercase text-[var(--muted)]">
                      {event.type}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {invoice ? (
                        <Link
                          className="focus-ring font-semibold text-[var(--accent)] hover:underline"
                          href={`/review/${invoice.id}`}
                        >
                          {invoice.invoiceNumber || invoice.vendorName || invoice.id}
                        </Link>
                      ) : (
                        <span className="text-[var(--muted)]">Not invoice-specific</span>
                      )}
                    </td>
                    <td className="border-b border-[var(--line)] px-3 py-3">
                      {event.message}
                    </td>
                  </tr>
                );
              })}
              {data.auditEvents.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-[var(--muted)]" colSpan={5}>
                    No audit events have been recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
