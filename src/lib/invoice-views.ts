import { statusesForApWorkQueue, statusesForCompleted } from "./status-config";
import type { AppData, Invoice } from "./types";

export type InvoiceSummaryView =
  | "total"
  | "needs-ap-work"
  | "with-departments"
  | "completed";

export const INVOICE_SUMMARY_VIEWS: Record<
  InvoiceSummaryView,
  { label: string; description: string }
> = {
  total: {
    label: "Total invoices",
    description: "All invoices currently stored in the system.",
  },
  "needs-ap-work": {
    label: "Needs AP work",
    description: "Invoices waiting for AP review or AP rework.",
  },
  "with-departments": {
    label: "With departments",
    description: "Invoices that have been assigned to a department.",
  },
  completed: {
    label: "Completed",
    description: "Invoices marked approved and completed.",
  },
};

export function summaryViewPath(view: InvoiceSummaryView) {
  return `/invoices/${view}`;
}

export function invoicesForSummaryView(
  invoices: Invoice[],
  view: InvoiceSummaryView,
  data?: AppData,
) {
  if (view === "needs-ap-work") {
    const statuses = data ? statusesForApWorkQueue(data) : ["Needs AP Review", "Needs AP Rework"];
    return invoices.filter((invoice) => statuses.includes(invoice.status));
  }

  if (view === "with-departments") {
    return invoices.filter((invoice) => Boolean(invoice.departmentId));
  }

  if (view === "completed") {
    const statuses = data ? statusesForCompleted(data) : ["Approved/Completed"];
    return invoices.filter((invoice) => statuses.includes(invoice.status));
  }

  return invoices;
}

export function isInvoiceSummaryView(value: string): value is InvoiceSummaryView {
  return value in INVOICE_SUMMARY_VIEWS;
}
