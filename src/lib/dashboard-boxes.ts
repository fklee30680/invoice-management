import {
  INVOICE_SUMMARY_VIEWS,
  invoicesForSummaryView,
  summaryViewPath,
} from "./invoice-views";
import type {
  AppData,
  DashboardBox,
  DashboardBoxLinkedView,
  DashboardBoxMetricType,
  Invoice,
} from "./types";
import { currencyDisplay } from "./utils";

export const DASHBOARD_BOX_VIEWS: DashboardBoxLinkedView[] = [
  "total",
  "needs-ap-work",
  "with-departments",
  "completed",
];

export const DASHBOARD_BOX_METRICS: {
  label: string;
  value: DashboardBoxMetricType;
}[] = [
  { value: "count", label: "Count" },
  { value: "dollars", label: "Dollars" },
  { value: "countAndDollars", label: "Count and Dollars" },
];

export function defaultDashboardBoxes(data: Pick<AppData, "statuses">): DashboardBox[] {
  const now = new Date().toISOString();
  return DASHBOARD_BOX_VIEWS.map((view, index) => ({
    id: `dashboard-box-${view}`,
    name: INVOICE_SUMMARY_VIEWS[view].label,
    enabled: true,
    order: index + 1,
    linkedViewId: view,
    departmentScope: { appliesToAllDepartments: true, departmentIds: [] },
    statusIds: defaultStatusIdsForDashboardView(data, view),
    metricType: "count",
    createdAt: now,
    updatedAt: now,
  }));
}

export function defaultStatusIdsForDashboardView(
  data: Pick<AppData, "statuses">,
  view: DashboardBoxLinkedView,
) {
  if (view === "needs-ap-work") {
    return data.statuses
      .filter((status) => status.active && status.showInApWorkQueue)
      .map((status) => status.id);
  }
  if (view === "with-departments") {
    return data.statuses
      .filter((status) => status.active && status.showInDepartmentWork)
      .map((status) => status.id);
  }
  if (view === "completed") {
    return data.statuses
      .filter((status) => status.active && status.showInCompleted)
      .map((status) => status.id);
  }
  return data.statuses.filter((status) => status.active).map((status) => status.id);
}

export function isDashboardBoxLinkedView(value: string): value is DashboardBoxLinkedView {
  return DASHBOARD_BOX_VIEWS.includes(value as DashboardBoxLinkedView);
}

export function dashboardBoxInvoices(data: AppData, box: DashboardBox): Invoice[] {
  if (!isDashboardBoxLinkedView(box.linkedViewId)) return [];
  if (!box.statusIds.length) return [];

  const selectedStatusLabels = new Set(
    box.statusIds
      .map(
        (statusId) =>
          data.statuses.find((status) => status.id === statusId && status.active)
            ?.label,
      )
      .filter((label): label is string => Boolean(label)),
  );
  if (selectedStatusLabels.size === 0) return [];

  return invoicesForSummaryView(data.invoices, box.linkedViewId, data).filter((invoice) => {
    const matchesDepartment =
      box.departmentScope.appliesToAllDepartments ||
      box.departmentScope.departmentIds.includes(invoice.departmentId);
    const matchesStatus = selectedStatusLabels.has(invoice.status);
    return matchesDepartment && matchesStatus;
  });
}

export function dashboardBoxHref(data: AppData, box: DashboardBox) {
  const params = new URLSearchParams();
  if (!box.departmentScope.appliesToAllDepartments) {
    for (const departmentId of box.departmentScope.departmentIds) {
      params.append("department", departmentId);
    }
  }
  let activeStatusCount = 0;
  for (const statusId of box.statusIds) {
    const status = data.statuses.find((item) => item.id === statusId);
    if (status?.active) {
      params.append("status", status.label);
      activeStatusCount += 1;
    }
  }
  if (box.statusIds.length > 0 && activeStatusCount === 0) {
    params.append("status", "__inactive_status_filter__");
  }
  const query = params.toString();
  const path = summaryViewPath(box.linkedViewId);
  return query ? `${path}?${query}` : path;
}

export function dashboardBoxMetric(data: AppData, box: DashboardBox) {
  const invoices = dashboardBoxInvoices(data, box);
  return {
    count: invoices.length,
    dollars: invoices.reduce((total, invoice) => total + amountValue(invoice.amount), 0),
  };
}

export function dashboardBoxMetricDisplay(data: AppData, box: DashboardBox) {
  const metric = dashboardBoxMetric(data, box);
  if (box.metricType === "dollars") return currencyDisplay(String(metric.dollars));
  if (box.metricType === "countAndDollars") {
    return `${metric.count} / ${currencyDisplay(String(metric.dollars))}`;
  }
  return String(metric.count);
}

export function dashboardBoxMetricLabel(box: DashboardBox) {
  if (box.metricType === "dollars") return "Total dollars";
  if (box.metricType === "countAndDollars") return "Count / dollars";
  return "Invoice count";
}

function amountValue(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
