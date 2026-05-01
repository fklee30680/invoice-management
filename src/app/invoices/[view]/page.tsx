import { notFound } from "next/navigation";
import { markManualPaymentInvoicesPaid } from "@/lib/actions";
import {
  FilterBar,
  InvoiceTable,
  filterInvoices,
  many,
  one,
  sortDirection,
  sortKey,
} from "@/components/invoice-list";
import {
  INVOICE_SUMMARY_VIEWS,
  invoicesForSummaryView,
  isInvoiceSummaryView,
  summaryViewPath,
} from "@/lib/invoice-views";
import { requireApUser } from "@/lib/session";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InvoiceViewPageProps = {
  params: Promise<{ view: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InvoiceViewPage({
  params,
  searchParams,
}: InvoiceViewPageProps) {
  await requireApUser();
  const { view } = await params;
  if (!isInvoiceSummaryView(view)) notFound();

  const query = (await searchParams) || {};
  const filters = {
    statuses: many(query.status),
    departments: many(query.department),
    decisionType: one(query.decisionType),
    search: one(query.search),
    sort: sortKey(query.sort),
    direction: sortDirection(query.direction),
  };
  const data = await readData();
  const viewConfig = INVOICE_SUMMARY_VIEWS[view];
  const baseInvoices = invoicesForSummaryView(data.invoices, view, data);
  const invoices = filterInvoices(baseInvoices, data, filters);
  const isManualPaymentView = view === "manual-payment";

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal">
              {viewConfig.label}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              {viewConfig.description}
            </p>
          </div>
          <div className="border border-[var(--line)] bg-white px-4 py-3 text-sm">
            <div className="text-sm text-[var(--muted)]">Showing</div>
            <div className="mt-1 text-2xl font-semibold">{invoices.length}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              of {baseInvoices.length} invoices in this category
            </div>
          </div>
        </header>

        {isManualPaymentView ? (
          <section className="flex flex-col gap-3 border border-[var(--line)] bg-[var(--panel)] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold">Payment File Actions</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Create a payment file from invoices that match the payment-file
                rules and current filters, or mark the visible eligible invoices
                as paid.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action="/files/payment-file/download" method="get">
                {invoices.map((invoice) => (
                  <input
                    key={invoice.id}
                    name="invoiceId"
                    type="hidden"
                    value={invoice.id}
                  />
                ))}
                <button
                  className="focus-ring bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={invoices.length === 0}
                >
                  Create And Download Payment File
                </button>
              </form>
              <form action={markManualPaymentInvoicesPaid}>
                {invoices.map((invoice) => (
                  <input
                    key={invoice.id}
                    name="invoiceId"
                    type="hidden"
                    value={invoice.id}
                  />
                ))}
                <button
                  className="focus-ring border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={invoices.length === 0}
                >
                  Paid
                </button>
              </form>
            </div>
          </section>
        ) : null}

        <FilterBar
          clearHref={summaryViewPath(view)}
          data={data}
          filters={filters}
          showDecisionTypeFilter={isManualPaymentView}
        />
        <InvoiceTable
          baseHref={summaryViewPath(view)}
          data={data}
          filters={filters}
          invoices={invoices}
        />
      </div>
    </main>
  );
}
