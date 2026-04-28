import type {
  AppData,
  InvoiceStatusDefinition,
  StatusSystemRole,
  StatusTone,
  WorkflowStatus,
} from "./types";

export const STATUS_TONES: StatusTone[] = [
  "slate",
  "amber",
  "orange",
  "teal",
  "emerald",
  "red",
  "purple",
  "blue",
];

export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  slate: "border-slate-300 bg-slate-50 text-slate-700",
  amber: "border-amber-300 bg-amber-50 text-amber-800",
  orange: "border-orange-300 bg-orange-50 text-orange-800",
  teal: "border-teal-300 bg-teal-50 text-teal-800",
  emerald: "border-emerald-300 bg-emerald-50 text-emerald-800",
  red: "border-red-300 bg-red-50 text-red-800",
  purple: "border-purple-300 bg-purple-50 text-purple-800",
  blue: "border-blue-300 bg-blue-50 text-blue-800",
};

export function defaultStatuses(): InvoiceStatusDefinition[] {
  return [
    {
      id: "status-uploaded",
      label: "Uploaded",
      tone: "slate",
      showInFilter: true,
      showInApWorkQueue: false,
      showInDepartmentWork: false,
      showInCompleted: false,
      systemRole: "uploaded",
    },
    {
      id: "status-needs-ap-review",
      label: "Needs AP Review",
      tone: "amber",
      showInFilter: true,
      showInApWorkQueue: true,
      showInDepartmentWork: false,
      showInCompleted: false,
      systemRole: "apReview",
    },
    {
      id: "status-needs-ap-rework",
      label: "Needs AP Rework",
      tone: "orange",
      showInFilter: true,
      showInApWorkQueue: true,
      showInDepartmentWork: false,
      showInCompleted: false,
      systemRole: "apRework",
    },
    {
      id: "status-routed",
      label: "Routed",
      tone: "teal",
      showInFilter: true,
      showInApWorkQueue: false,
      showInDepartmentWork: true,
      showInCompleted: false,
      systemRole: "routed",
    },
    {
      id: "status-completed",
      label: "Approved/Completed",
      tone: "emerald",
      showInFilter: true,
      showInApWorkQueue: false,
      showInDepartmentWork: false,
      showInCompleted: true,
      systemRole: "completed",
    },
    {
      id: "status-rejected",
      label: "Rejected",
      tone: "red",
      showInFilter: true,
      showInApWorkQueue: false,
      showInDepartmentWork: false,
      showInCompleted: false,
      systemRole: "rejected",
    },
    {
      id: "status-hold",
      label: "Hold",
      tone: "purple",
      showInFilter: true,
      showInApWorkQueue: false,
      showInDepartmentWork: false,
      showInCompleted: false,
      systemRole: "hold",
    },
  ];
}

export function getStatusByRole(data: AppData, role: StatusSystemRole) {
  return data.statuses.find((status) => statusRoles(status).includes(role));
}

export function statusLabelForRole(data: AppData, role: StatusSystemRole) {
  const fallback = defaultStatuses().find((status) => status.systemRole === role);
  return getStatusByRole(data, role)?.label || fallback?.label || role;
}

export function statusBadgeClass(data: AppData, status: WorkflowStatus) {
  const configured = data.statuses.find((item) => item.label === status);
  return STATUS_TONE_CLASSES[configured?.tone || "slate"];
}

export function filterableStatuses(data: AppData) {
  return data.statuses.filter((status) => status.showInFilter);
}

export function statusesForApWorkQueue(data: AppData) {
  return data.statuses
    .filter((status) => status.showInApWorkQueue)
    .map((status) => status.label);
}

export function statusesForDepartmentWork(data: AppData) {
  return data.statuses
    .filter((status) => status.showInDepartmentWork)
    .map((status) => status.label);
}

export function statusesForCompleted(data: AppData) {
  return data.statuses
    .filter((status) => status.showInCompleted)
    .map((status) => status.label);
}

export function statusRoles(status: InvoiceStatusDefinition) {
  return Array.from(
    new Set([
      ...(status.systemRoles || []),
      ...(status.systemRole ? [status.systemRole] : []),
    ]),
  );
}

export function statusRoleLabel(status: InvoiceStatusDefinition) {
  const roles = statusRoles(status);
  return roles.length ? roles.join(", ") : "";
}
