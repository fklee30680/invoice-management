import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FilterBar,
  InvoiceTable,
  filterInvoices,
  many,
  one,
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
    department: one(query.department),
    search: one(query.search),
  };
  const data = await readData();
  const branding = data.branding;
  const viewConfig = INVOICE_SUMMARY_VIEWS[view];
  const baseInvoices = invoicesForSummaryView(data.invoices, view);
  const invoices = filterInvoices(baseInvoices, data, filters);

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
                  Invoice List
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-normal">
                  {viewConfig.label}
                </h1>
              </div>
            </div>
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

        <FilterBar
          clearHref={summaryViewPath(view)}
          data={data}
          filters={filters}
        />
        <InvoiceTable data={data} invoices={invoices} />
      </div>
    </main>
  );
}
