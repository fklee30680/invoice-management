import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type {
  AppData,
  AuditEvent,
  BrandingSettings,
  Department,
  Invoice,
  InvoiceFile,
  NotificationTemplate,
  OrganizationEscalationSettings,
  PurchaseOrder,
  User,
} from "./types";
import {
  clearDatabaseIssue,
  getDatabaseConfig,
  reportDatabaseIssue,
} from "./runtime-config";
import { defaultStatuses, statusRoles } from "./status-config";
import { normalizePoNumber, slugify } from "./utils";

const RUNTIME_ROOT = process.env.VERCEL
  ? path.join("/tmp", "invoice-management")
  : process.cwd();

const DATA_DIR = path.join(RUNTIME_ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "app-data.json");
const UPLOAD_DIR = path.join(RUNTIME_ROOT, "uploads");
const APP_STATE_ID = "main";

type AppStateRow = {
  data: AppData;
};

let db: NeonQueryFunction<false, false> | null = null;
let schemaReady = false;

function defaultNotificationTemplate(): NotificationTemplate {
  return {
    departmentSubject: "Invoice review needed: {{vendor_name}}",
    departmentBody:
      "A new invoice requires your review.\n\nVendor: {{vendor_name}}\nInvoice Number: {{invoice_number}}\nPO Number: {{po_number}}\nAmount: {{amount}}\nDepartment: {{department_name}}\n\nOpen invoice: {{review_link}}",
  };
}

function defaultBranding(): BrandingSettings {
  return {
    appTitle: "Invoice Management",
    divisionLabel: "AP Division",
    fontFamily: "Arial, Helvetica, ui-sans-serif, system-ui, sans-serif",
    accentColor: "#0f766e",
    accentStrongColor: "#115e59",
    backgroundColor: "#f6f7f9",
    panelColor: "#ffffff",
    panelStrongColor: "#eef2f6",
    textColor: "#17202a",
    mutedColor: "#657386",
    lineColor: "#d8dee7",
    logo: null,
  };
}

function defaultEscalationContacts(): OrganizationEscalationSettings {
  return {
    apSupervisor: {
      title: "AP Supervisor",
      name: "",
      email: "",
    },
    cfo: {
      title: "CFO",
      name: "",
      email: "",
    },
    executive: {
      title: "Organization CEO or Manager",
      name: "",
      email: "",
    },
  };
}

function normalizeData(data: AppData): AppData {
  const defaultBrand = defaultBranding();
  const defaultEscalations = defaultEscalationContacts();
  const defaultStatusList = defaultStatuses();
  const invoices = (data.invoices || []).map((invoice) => {
    const legacyStatus = String(invoice.status);
    if (legacyStatus === "OCR Processing") {
      return { ...invoice, status: "Needs AP Review" as const };
    }
    if (legacyStatus === "Decision Received") {
      return { ...invoice, status: "Approved/Completed" as const };
    }
    return invoice;
  });
  const statuses = mergeStatuses(defaultStatusList, data.statuses || [], invoices);

  return {
    ...data,
    invoices,
    departments: (data.departments || []).map((department) => ({
      ...department,
      departmentHeadName: department.departmentHeadName || "",
      departmentHeadEmail: department.departmentHeadEmail || "",
      escalationName: department.escalationName || "",
      escalationEmail: department.escalationEmail || "",
    })),
    notificationTemplate: data.notificationTemplate || defaultNotificationTemplate(),
    branding: {
      ...defaultBrand,
      ...(data.branding || {}),
      logo: data.branding?.logo || null,
    },
    statuses,
    escalationContacts: {
      apSupervisor: {
        ...defaultEscalations.apSupervisor,
        ...(data.escalationContacts?.apSupervisor || {}),
      },
      cfo: {
        ...defaultEscalations.cfo,
        ...(data.escalationContacts?.cfo || {}),
      },
      executive: {
        ...defaultEscalations.executive,
        ...(data.escalationContacts?.executive || {}),
      },
    },
  };
}

function mergeStatuses(
  defaultStatusList: ReturnType<typeof defaultStatuses>,
  configuredStatuses: AppData["statuses"],
  invoices: AppData["invoices"],
) {
  const byRole = new Map(
    configuredStatuses.flatMap((status) =>
      statusRoles(status).map((role) => [role, status] as const),
    ),
  );
  const byLabel = new Map(configuredStatuses.map((status) => [status.label, status]));
  const statuses: AppData["statuses"] = [];

  for (const defaultStatus of defaultStatusList) {
    const configured = defaultStatus.systemRole
      ? byRole.get(defaultStatus.systemRole)
      : undefined;
    const candidate = { ...defaultStatus, ...configured };
    if (!statuses.some((status) => status.id === candidate.id)) {
      statuses.push(candidate);
    }
  }

  for (const status of configuredStatuses) {
    const roles = statusRoles(status);
    if (
      roles.length > 0 &&
      statuses.some((item) =>
        statusRoles(item).some((role) => roles.includes(role)),
      )
    ) {
      continue;
    }
    if (!statuses.some((item) => item.id === status.id || item.label === status.label)) {
      statuses.push(status);
    }
  }

  for (const invoice of invoices) {
    if (!invoice.status || statuses.some((status) => status.label === invoice.status)) {
      continue;
    }
    const configured = byLabel.get(invoice.status);
    statuses.push(
      configured || {
        id: createId("status"),
        label: invoice.status,
        tone: "blue",
        showInFilter: true,
        showInApWorkQueue: false,
        showInDepartmentWork: false,
        showInCompleted: false,
      },
    );
  }

  return statuses;
}

function hasDatabase() {
  return Boolean(getDatabaseConfig().value);
}

function getDb() {
  const database = getDatabaseConfig();
  if (!database.value) {
    throw new Error("No Postgres connection string is configured.");
  }
  if (!db) {
    db = neon(database.value);
  }
  return db;
}

async function ensureDatabaseSchema() {
  if (schemaReady) return;
  const sql = getDb();
  await sql`
    create table if not exists app_state (
      id text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    )
  `;
  schemaReady = true;
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function ensureRuntimeDirs() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(UPLOAD_DIR, { recursive: true });
}

export function getUploadPath(storedName: string) {
  return path.join(UPLOAD_DIR, storedName);
}

function seedData(): AppData {
  const departments: Department[] = [
    { id: "dept-facilities", name: "Facilities", email: "facilities@example.com" },
    { id: "dept-operations", name: "Operations", email: "operations@example.com" },
    { id: "dept-it", name: "Information Technology", email: "it@example.com" },
    { id: "dept-finance", name: "Finance", email: "finance@example.com" },
  ];

  const users: User[] = [
    {
      id: "user-ap-admin",
      name: "AP Specialist",
      email: "ap@example.com",
      role: "AP",
    },
    {
      id: "user-facilities",
      name: "Facilities Reviewer",
      email: "facilities.reviewer@example.com",
      role: "DEPARTMENT",
      departmentId: "dept-facilities",
    },
    {
      id: "user-operations",
      name: "Operations Reviewer",
      email: "operations.reviewer@example.com",
      role: "DEPARTMENT",
      departmentId: "dept-operations",
    },
  ];

  const purchaseOrders: PurchaseOrder[] = [
    {
      id: "po-10045",
      poNumber: "PO-10045",
      normalizedPoNumber: normalizePoNumber("PO-10045"),
      vendorName: "Northstar Supply",
      departmentId: "dept-facilities",
      uploadedAt: new Date().toISOString(),
    },
    {
      id: "po-20810",
      poNumber: "PO-20810",
      normalizedPoNumber: normalizePoNumber("PO-20810"),
      vendorName: "Brightline Services",
      departmentId: "dept-operations",
      uploadedAt: new Date().toISOString(),
    },
  ];

  return {
    departments,
    users,
    purchaseOrders,
    invoices: [],
    invoiceFiles: [],
    auditEvents: [
      {
        id: createId("audit"),
        actor: "System",
        type: "seeded",
        message: "Seeded departments, users, and starter PO records.",
        createdAt: new Date().toISOString(),
      },
    ],
    notificationTemplate: defaultNotificationTemplate(),
    branding: defaultBranding(),
    statuses: defaultStatuses(),
    escalationContacts: defaultEscalationContacts(),
  };
}

export async function readData(): Promise<AppData> {
  if (hasDatabase()) {
    try {
      const data = await readDatabaseData();
      clearDatabaseIssue();
      return data;
    } catch (error) {
      reportDatabaseIssue(error);
      console.error("[storage:database] read failed", error);
      return readLocalData();
    }
  }

  return readLocalData();
}

async function readLocalData(): Promise<AppData> {
  await ensureRuntimeDirs();
    try {
      const raw = await readFile(DATA_FILE, "utf8");
      return normalizeData(JSON.parse(raw) as AppData);
    } catch {
      const data = seedData();
      await writeData(data);
      return data;
  }
}

export async function writeData(data: AppData) {
  if (hasDatabase()) {
    try {
      await writeDatabaseData(data);
      clearDatabaseIssue();
      return;
    } catch (error) {
      reportDatabaseIssue(error);
      console.error("[storage:database] write failed", error);
    }
  }

  await ensureRuntimeDirs();
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

export async function mutateData<T>(mutator: (data: AppData) => T | Promise<T>) {
  const data = await readData();
  const result = await mutator(data);
  await writeData(data);
  return result;
}

export function addAudit(
  data: AppData,
  input: Omit<AuditEvent, "id" | "createdAt">,
) {
  data.auditEvents.unshift({
    ...input,
    id: createId("audit"),
    createdAt: new Date().toISOString(),
  });
}

export function findDepartmentByName(data: AppData, name: string) {
  return data.departments.find(
    (department) => department.name.toLowerCase() === name.trim().toLowerCase(),
  );
}

export function upsertDepartment(data: AppData, name: string, email = "") {
  const existing = findDepartmentByName(data, name);
  if (existing && email) {
    existing.email = email.trim().toLowerCase();
  }
  if (existing) return existing;

  const department: Department = {
    id: `dept-${slugify(name) || createId("department")}`,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    departmentHeadName: "",
    departmentHeadEmail: "",
    escalationName: "",
    escalationEmail: "",
  };
  data.departments.push(department);
  return department;
}

export function upsertPurchaseOrder(
  data: AppData,
  poNumber: string,
  vendorName: string,
  departmentName: string,
) {
  const department = upsertDepartment(data, departmentName);
  const normalizedPoNumber = normalizePoNumber(poNumber);
  const existing = data.purchaseOrders.find(
    (po) => po.normalizedPoNumber === normalizedPoNumber,
  );

  if (existing) {
    existing.vendorName = vendorName.trim();
    existing.departmentId = department.id;
    existing.uploadedAt = new Date().toISOString();
    return existing;
  }

  const purchaseOrder: PurchaseOrder = {
    id: createId("po"),
    poNumber: poNumber.trim(),
    normalizedPoNumber,
    vendorName: vendorName.trim(),
    departmentId: department.id,
    uploadedAt: new Date().toISOString(),
  };
  data.purchaseOrders.push(purchaseOrder);
  return purchaseOrder;
}

export function findPurchaseOrder(data: AppData, poNumber: string) {
  const normalized = normalizePoNumber(poNumber);
  if (!normalized) return undefined;
  return data.purchaseOrders.find((po) => po.normalizedPoNumber === normalized);
}

export function getInvoiceFile(data: AppData, fileId: string) {
  return data.invoiceFiles.find((file) => file.id === fileId);
}

export function getInvoice(data: AppData, invoiceId: string) {
  return data.invoices.find((invoice) => invoice.id === invoiceId);
}

export function addInvoiceFile(data: AppData, file: InvoiceFile) {
  data.invoiceFiles.push(file);
}

export function addInvoice(data: AppData, invoice: Invoice) {
  data.invoices.unshift(invoice);
}

async function readDatabaseData(): Promise<AppData> {
  await ensureDatabaseSchema();
  const sql = getDb();
  const rows = (await sql`
    select data
    from app_state
    where id = ${APP_STATE_ID}
    limit 1
  `) as AppStateRow[];

  if (rows[0]?.data) {
    return normalizeData(rows[0].data);
  }

  const data = seedData();
  await writeDatabaseData(data);
  return data;
}

async function writeDatabaseData(data: AppData) {
  await ensureDatabaseSchema();
  const sql = getDb();
  await sql`
    insert into app_state (id, data, updated_at)
    values (${APP_STATE_ID}, ${JSON.stringify(data)}::jsonb, now())
    on conflict (id)
    do update set data = excluded.data, updated_at = now()
  `;
}
