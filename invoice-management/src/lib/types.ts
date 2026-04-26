export type Role = "AP" | "DEPARTMENT";

export type WorkflowStatus =
  | "Uploaded"
  | "OCR Processing"
  | "Needs AP Review"
  | "Routed"
  | "Decision Received"
  | "Needs AP Rework"
  | "Approved/Completed"
  | "Rejected"
  | "Hold";

export type DepartmentDecision =
  | "Receiving Record"
  | "P-Card"
  | "Request for Check"
  | "Reject"
  | "Hold"
  | "Not our Department Invoice";

export type Department = {
  id: string;
  name: string;
  email: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId?: string;
};

export type PurchaseOrder = {
  id: string;
  poNumber: string;
  normalizedPoNumber: string;
  vendorName: string;
  departmentId: string;
  uploadedAt: string;
};

export type InvoiceComment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

export type InvoiceFile = {
  id: string;
  invoiceId: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

export type AuditEvent = {
  id: string;
  invoiceId?: string;
  actor: string;
  type: string;
  message: string;
  createdAt: string;
};

export type Invoice = {
  id: string;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  amount: string;
  poNumber: string;
  dateReceived: string;
  dateApproved: string;
  status: WorkflowStatus;
  departmentId: string;
  departmentDecision: DepartmentDecision | "";
  comments: InvoiceComment[];
  fileId: string;
  notificationSentAt: string;
  ocrSummary: string;
  createdAt: string;
  updatedAt: string;
};

export type AppData = {
  departments: Department[];
  users: User[];
  purchaseOrders: PurchaseOrder[];
  invoices: Invoice[];
  invoiceFiles: InvoiceFile[];
  auditEvents: AuditEvent[];
};

export type InvoiceFilter = {
  status?: string;
  department?: string;
  search?: string;
};

