import Image from "next/image";
import {
  addPaymentFileColumn,
  deletePaymentFileColumn,
  updatePaymentFileSettings,
} from "@/lib/actions";
import { PAYMENT_FILE_FIELD_OPTIONS } from "@/lib/payment-file";
import { requireApUser } from "@/lib/session";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PaymentFilePage() {
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
                Payment File
              </h1>
            </div>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
            Define the export columns used when AP creates a payment file from
            invoices waiting for manual payment.
          </p>
        </header>

        <form
          action={updatePaymentFileSettings}
          className="space-y-4 border border-[var(--line)] bg-[var(--panel)] p-4"
        >
          <div>
            <h2 className="text-base font-semibold">Payment File Columns</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Included columns are exported in the order shown below.
            </p>
          </div>

          <div className="space-y-3">
            {data.paymentFile.columns.map((column, index) => (
              <article
                className="grid gap-3 border border-[var(--line)] bg-white p-3 lg:grid-cols-[64px_1fr_1fr_110px_auto]"
                key={column.id}
              >
                <input name="columnId" type="hidden" value={column.id} />
                <div className="text-xs font-semibold uppercase text-[var(--muted)]">
                  Order
                  <div className="mt-2 text-base text-[var(--foreground)]">
                    {index + 1}
                  </div>
                </div>
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                  Header
                  <input
                    className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                    defaultValue={column.header}
                    name={`header-${column.id}`}
                    required
                  />
                </label>
                <label className="text-xs font-semibold uppercase text-[var(--muted)]">
                  Invoice Field
                  <select
                    className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
                    defaultValue={column.source}
                    name={`source-${column.id}`}
                    required
                  >
                    {PAYMENT_FILE_FIELD_OPTIONS.map((option) => (
                      <option key={option.source} value={option.source}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 pt-6 text-sm font-semibold">
                  <input
                    className="h-4 w-4 accent-[var(--accent)]"
                    defaultChecked={column.included}
                    name={`included-${column.id}`}
                    type="checkbox"
                  />
                  Include
                </label>
                <div className="pt-5">
                  <button
                    className="focus-ring border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                    form={`delete-payment-column-${column.id}`}
                    type="submit"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="flex justify-end">
            <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
              Save Payment File
            </button>
          </div>
        </form>

        {data.paymentFile.columns.map((column) => (
          <form
            action={deletePaymentFileColumn}
            className="hidden"
            id={`delete-payment-column-${column.id}`}
            key={`delete-${column.id}`}
          >
            <input name="columnId" type="hidden" value={column.id} />
          </form>
        ))}

        <form
          action={addPaymentFileColumn}
          className="grid gap-3 border border-[var(--line)] bg-[var(--panel)] p-4 lg:grid-cols-[1fr_1fr_auto]"
        >
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            New Header
            <input
              className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
              name="header"
              placeholder="Payment Reference"
            />
          </label>
          <label className="text-xs font-semibold uppercase text-[var(--muted)]">
            Invoice Field
            <select
              className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
              name="source"
              required
            >
              {PAYMENT_FILE_FIELD_OPTIONS.map((option) => (
                <option key={option.source} value={option.source}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button className="focus-ring w-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
              Add Column
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
