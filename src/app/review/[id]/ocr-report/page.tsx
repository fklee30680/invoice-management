import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceProcessingReport } from "@/components/invoice-processing-report";
import { requireApUser } from "@/lib/session";
import { statusBadgeClass } from "@/lib/status-config";
import { readData } from "@/lib/store";
import { currencyDisplay, formatDate } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OcrReportPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OcrReportPage({ params }: OcrReportPageProps) {
  const { id } = await params;
  await requireApUser();
  const data = await readData();
  const invoice = data.invoices.find((item) => item.id === id);
  if (!invoice) notFound();

  const processingDocument = invoice.documentId
    ? data.invoiceDocuments.find((item) => item.id === invoice.documentId)
    : undefined;
  const extraction = invoice.extractionId
    ? data.invoiceExtractions.find((item) => item.id === invoice.extractionId)
    : undefined;
  const invoiceFile = invoice.fileId
    ? data.invoiceFiles.find((item) => item.id === invoice.fileId)
    : undefined;
  const fieldCandidates = data.invoiceFieldCandidates
    .filter((candidate) => candidate.invoiceId === invoice.id)
    .sort((left, right) => {
      const fieldCompare = left.fieldName.localeCompare(right.fieldName);
      if (fieldCompare !== 0) return fieldCompare;
      return Number(right.selected) - Number(left.selected);
    });
  const validationResults = data.invoiceValidationResults
    .filter((result) => result.invoiceId === invoice.id)
    .sort((left, right) => {
      const severityOrder = { blocking: 0, warning: 1, info: 2 };
      return severityOrder[left.severity] - severityOrder[right.severity];
    });

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-[var(--muted)]">
              OCR extraction, validation results, and candidate values
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">
              Invoice Processing Report
            </h1>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--muted)]">
              <span>{invoice.vendorName || "Unknown Vendor"}</span>
              <span>|</span>
              <span>Invoice {invoice.invoiceNumber || "Not set"}</span>
              <span>|</span>
              <span>{formatDate(invoice.invoiceDate)}</span>
              <span>|</span>
              <span>{currencyDisplay(invoice.amount)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex border px-3 py-2 text-sm font-semibold ${statusBadgeClass(data, invoice.status)}`}
            >
              {invoice.status}
            </span>
            <Link
              className="focus-ring inline-flex border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
              href={`/review/${invoice.id}`}
            >
              Back to Invoice Review
            </Link>
          </div>
        </header>

        <InvoiceProcessingReport
          extraction={extraction}
          fieldCandidates={fieldCandidates}
          invoice={invoice}
          invoiceFile={invoiceFile}
          processingDocument={processingDocument}
          validationResults={validationResults}
        />
      </div>
    </main>
  );
}
