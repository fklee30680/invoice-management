import { INVOICE_SUMMARY_VIEWS, summaryViewPath } from "./invoice-views";
import type {
  MenuConfigItem,
  MenuLinkTarget,
  MenuRole,
  MenuSettings,
} from "./types";

const BASE_MENU_TARGETS: MenuLinkTarget[] = [
  { id: "dashboard", label: "Dashboard", href: "/", roles: ["AP"], locked: true, category: "Main" },
  { id: "audit", label: "Audit Log", href: "/audit", roles: ["AP"], category: "Main" },
  { id: "reports", label: "Reports", href: "/reports", roles: ["AP"], category: "Main" },
  { id: "payment-file", label: "Payment File", href: "/files/payment-file", roles: ["AP"], category: "Files" },
  { id: "po-list-update", label: "PO List Update", href: "/uploads/po-list", roles: ["AP"], category: "Files" },
  { id: "vendor-file", label: "Vendor File", href: "/uploads/vendors", roles: ["AP"], category: "Files" },
  { id: "branding", label: "Branding", href: "/settings/branding", roles: ["AP"], category: "Setup" },
  { id: "dashboard-boxes", label: "Dashboard Boxes", href: "/settings/dashboard-boxes", roles: ["AP"], category: "Setup" },
  { id: "decision-types", label: "Decision Types", href: "/settings/decisions", roles: ["AP"], category: "Setup" },
  { id: "department-emails", label: "Department Emails", href: "/settings/departments", roles: ["AP"], category: "Setup" },
  { id: "email-templates", label: "Email Templates", href: "/settings/email", roles: ["AP"], category: "Setup" },
  { id: "environment", label: "Environment", href: "/settings/environment", roles: ["AP"], category: "Setup" },
  { id: "escalation-schedules", label: "Escalation Schedules", href: "/settings/escalation-schedules", roles: ["AP"], category: "Setup" },
  { id: "holidays-business-days", label: "Holidays And Business Days", href: "/settings/holidays-business-days", roles: ["AP"], category: "Setup" },
  { id: "invoice-fields", label: "Invoice Fields", href: "/settings/invoice-fields", roles: ["AP"], category: "Setup" },
  { id: "menu-setup", label: "Menu Setup", href: "/settings/menu", roles: ["AP"], locked: true, category: "Setup" },
  { id: "organization-escalation-contacts", label: "Organization Escalation Contacts", href: "/settings/organization-escalation-contacts", roles: ["AP"], category: "Setup" },
  { id: "po-validation", label: "PO Validation", href: "/settings/po-validation", roles: ["AP"], category: "Setup" },
  { id: "scheduler-runtime", label: "Scheduler Runtime", href: "/settings/scheduler", roles: ["AP"], category: "Setup" },
  { id: "statuses", label: "Statuses", href: "/settings/statuses", roles: ["AP"], category: "Setup" },
  { id: "department-dashboard", label: "Department Dashboard", href: "/department", roles: ["DEPARTMENT"], locked: true, category: "Department" },
];

export const AVAILABLE_MENU_TARGETS: MenuLinkTarget[] = [
  ...BASE_MENU_TARGETS,
  ...Object.entries(INVOICE_SUMMARY_VIEWS).map(([view, config]) => ({
    id: `invoice-${view}`,
    label: config.label,
    href: summaryViewPath(view as keyof typeof INVOICE_SUMMARY_VIEWS),
    roles: ["AP"] as MenuRole[],
    category: "Invoices",
  })),
];

const targetsById = new Map(AVAILABLE_MENU_TARGETS.map((target) => [target.id, target]));
const targetsByHref = new Map(AVAILABLE_MENU_TARGETS.map((target) => [target.href, target]));

export function menuTargetByHref(href: string | undefined) {
  return href ? targetsByHref.get(href) : undefined;
}

export function menuTargetById(id: string | undefined) {
  return id ? targetsById.get(id) : undefined;
}

export function menuTargetOptions() {
  return AVAILABLE_MENU_TARGETS;
}

export function defaultMenuSettings(): MenuSettings {
  return {
    items: [
      menuLink("audit", 1),
      menuLink("dashboard", 2),
      menuGroup("files", "Files", 3, ["AP"], [
        menuLink("payment-file", 1),
        menuLink("po-list-update", 2),
        menuLink("vendor-file", 3),
      ]),
      menuGroup("invoices", "Invoices", 4, ["AP"], invoiceMenuLinks()),
      menuLink("reports", 5),
      menuGroup("setup", "Setup", 6, ["AP"], [
        menuLink("branding", 1),
        menuLink("dashboard-boxes", 2),
        menuLink("decision-types", 3),
        menuLink("department-emails", 4),
        menuLink("email-templates", 5),
        menuLink("environment", 6),
        menuLink("escalation-schedules", 7),
        menuLink("holidays-business-days", 8),
        menuLink("invoice-fields", 9),
        menuLink("menu-setup", 10),
        menuLink("organization-escalation-contacts", 11),
        menuLink("po-validation", 12),
        menuLink("scheduler-runtime", 13),
        menuLink("statuses", 14),
      ]),
      menuLink("department-dashboard", 7),
    ],
  };
}

export function normalizeMenuSettings(settings: MenuSettings | undefined): MenuSettings {
  const defaults = defaultMenuSettings();
  if (!settings?.items?.length) return defaults;

  const items = settings.items
    .map((item, index) => normalizeMenuItem(item, index, defaults))
    .filter((item): item is MenuConfigItem => Boolean(item));

  for (const lockedDefault of flattenMenuItems(defaults.items).filter((item) => item.locked)) {
    if (flattenMenuItems(items).some((item) => item.id === lockedDefault.id)) continue;
    if (lockedDefault.id === "menu-setup") {
      const setupGroup = items.find((item) => item.id === "setup" && item.type === "group");
      if (setupGroup) {
        setupGroup.children = normalizeOrder([
          ...(setupGroup.children || []),
          { ...lockedDefault, order: (setupGroup.children || []).length + 1 },
        ]);
        continue;
      }
    }
    items.push({ ...lockedDefault, order: items.length + 1 });
  }
  const setupGroup = items.find((item) => item.id === "setup" && item.type === "group");
  if (setupGroup) {
    for (const targetId of ["dashboard-boxes", "po-validation"]) {
      const target = menuTargetById(targetId);
      if (!target) continue;
      if (flattenMenuItems(items).some((item) => item.href === target.href)) continue;
      setupGroup.children = normalizeOrder([
        ...(setupGroup.children || []),
        menuLink(targetId, (setupGroup.children || []).length + 1),
      ]);
    }
  }

  return { items: normalizeOrder(items) };
}

export function menuItemAvailable(item: MenuConfigItem) {
  return item.type === "group" || Boolean(menuTargetByHref(item.href));
}

export function menuItemRoles(item: MenuConfigItem) {
  return item.roles.length > 0 ? item.roles : menuTargetByHref(item.href)?.roles || ["AP"];
}

export function flattenMenuItems(items: MenuConfigItem[]) {
  return items.flatMap((item) => [item, ...(item.children || [])]);
}

function menuLink(targetId: string, order: number): MenuConfigItem {
  const target = menuTargetById(targetId);
  if (!target) throw new Error(`Missing menu target ${targetId}`);

  return {
    id: target.id,
    type: "link",
    label: target.label,
    href: target.href,
    enabled: true,
    order,
    roles: target.roles,
    locked: target.locked === true,
  };
}

function menuGroup(
  id: string,
  label: string,
  order: number,
  roles: MenuRole[],
  children: MenuConfigItem[],
): MenuConfigItem {
  return {
    id,
    type: "group",
    label,
    enabled: true,
    order,
    roles,
    children,
  };
}

function invoiceMenuLinks() {
  return Object.keys(INVOICE_SUMMARY_VIEWS).map((view, index) =>
    menuLink(`invoice-${view}`, index + 1),
  );
}

function normalizeMenuItem(
  item: MenuConfigItem,
  index: number,
  defaults: MenuSettings,
): MenuConfigItem | null {
  const defaultItem = flattenMenuItems(defaults.items).find((entry) => entry.id === item.id);
  const target = menuTargetByHref(item.href);
  const locked = item.locked === true || defaultItem?.locked === true || target?.locked === true;
  const type = item.type === "group" ? "group" : "link";
  const label = item.label?.trim() || defaultItem?.label || target?.label || "Menu Item";
  const roles = validRoles(item.roles?.length ? item.roles : defaultItem?.roles || target?.roles);

  if (type === "link") {
    return {
      id: item.id || target?.id || `menu-link-${index + 1}`,
      type,
      label,
      href: item.href || target?.href || defaultItem?.href || "",
      enabled: locked ? true : item.enabled !== false,
      order: validOrder(item.order, index),
      roles,
      locked,
    };
  }

  return {
    id: item.id || `menu-group-${index + 1}`,
    type,
    label,
    enabled: locked ? true : item.enabled !== false,
    order: validOrder(item.order, index),
    roles,
    locked,
    children: normalizeOrder(
      (item.children || [])
        .map((child, childIndex) => normalizeMenuItem(child, childIndex, defaults))
        .filter((child): child is MenuConfigItem => Boolean(child)),
    ),
  };
}

function validRoles(roles: MenuRole[] | undefined): MenuRole[] {
  const normalized = (roles || ["AP"]).filter(
    (role): role is MenuRole => role === "AP" || role === "DEPARTMENT",
  );
  return normalized.length > 0 ? normalized : ["AP"];
}

function validOrder(order: number, index: number) {
  return Number.isInteger(Number(order)) && Number(order) >= 1 ? Number(order) : index + 1;
}

function normalizeOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items]
    .sort((left, right) => left.order - right.order)
    .map((item, index) => ({ ...item, order: index + 1 }));
}
