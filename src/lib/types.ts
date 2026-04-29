export type Role = "AP" | "DEPARTMENT";

export type WorkflowStatus = string;

export type StatusTone =
  | "slate"
  | "amber"
  | "orange"
  | "teal"
  | "emerald"
  | "red"
  | "purple"
  | "blue";

export type StatusSystemRole =
  | "uploaded"
  | "apReview"
  | "apRework"
  | "routed"
  | "completed"
  | "rejected"
  | "hold";

export type InvoiceStatusDefinition = {
  id: string;
  label: string;
  tone: StatusTone;
  showInFilter: boolean;
  showInApWorkQueue: boolean;
  showInDepartmentWork: boolean;
  showInCompleted: boolean;
  systemRole?: StatusSystemRole;
  systemRoles?: StatusSystemRole[];
};

export type DecisionWorkflowAction = "complete" | "reject" | "hold" | "apRework";

export type DepartmentDecisionDefinition = {
  id: string;
  label: string;
  workflowAction: DecisionWorkflowAction;
  requireComment: boolean;
  active: boolean;
};

export type Department = {
  id: string;
  name: string;
  email: string;
};

export type EscalationContact = {
  id: string;
  name: string;
  email: string;
  allDepartments: boolean;
  departmentIds: string[];
  daysToNotify: number;
};

export type NotificationTemplate = {
  departmentSubject: string;
  departmentBody: string;
  escalationSubject: string;
  escalationBody: string;
};

export type PaymentFileFieldSource =
  | "vendorName"
  | "invoiceNumber"
  | "invoiceDate"
  | "amount"
  | "poNumber"
  | "department"
  | "departmentDecision"
  | "dateReceived"
  | "dateApproved"
  | "dateUploaded"
  | "dateSubmittedToDepartment"
  | "statusDate"
  | "paymentProcessed";

export type PaymentFileColumn = {
  id: string;
  header: string;
  source: PaymentFileFieldSource;
  included: boolean;
};

export type PaymentFileSettings = {
  columns: PaymentFileColumn[];
};

export type BrandingLogo = {
  originalName: string;
  storedName: string;
  storageProvider?: "local" | "blob";
  blobUrl?: string;
  blobPathname?: string;
  blobAccess?: "private" | "public";
  mimeType: string;
  size: number;
  uploadedAt: string;
};

export type BrandingSettings = {
  appTitle: string;
  divisionLabel: string;
  fontFamily: string;
  accentColor: string;
  accentStrongColor: string;
  backgroundColor: string;
  panelColor: string;
  panelStrongColor: string;
  textColor: string;
  mutedColor: string;
  lineColor: string;
  logo: BrandingLogo | null;
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

export type Vendor = {
  id: string;
  vendorName: string;
  normalizedVendorName: string;
  vendorNumber: string;
  email: string;
  active: boolean;
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
  storageProvider?: "local" | "blob";
  blobUrl?: string;
  blobPathname?: string;
  blobAccess?: "private" | "public";
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
  vendorRecordId?: string;
  vendorValidationStatus?: "Matched" | "Not Found" | "Not Checked";
  invoiceNumber: string;
  invoiceDate: string;
  amount: string;
  poNumber: string;
  dateReceived: string;
  dateApproved: string;
  dateUploaded: string;
  dateSubmittedToDepartment: string;
  statusDate: string;
  status: WorkflowStatus;
  departmentId: string;
  departmentDecision: string;
  paymentProcessed: boolean;
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
  vendors: Vendor[];
  invoices: Invoice[];
  invoiceFiles: InvoiceFile[];
  auditEvents: AuditEvent[];
  notificationTemplate: NotificationTemplate;
  paymentFile: PaymentFileSettings;
  branding: BrandingSettings;
  statuses: InvoiceStatusDefinition[];
  departmentDecisions: DepartmentDecisionDefinition[];
  escalationContacts: EscalationContact[];
};

export type InvoiceFilter = {
  status?: string;
  department?: string;
  search?: string;
};
