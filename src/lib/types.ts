export type Role = "AP" | "DEPARTMENT";

export type WorkflowStatus = string;

export type DocumentProcessingStatus =
  | "uploaded"
  | "stored"
  | "staged_for_processing"
  | "classified"
  | "ocr_completed"
  | "extraction_completed"
  | "normalization_completed"
  | "validation_completed"
  | "ready_for_ap_review"
  | "routed"
  | "failed";

export type ExtractionSource =
  | "azure_document_intelligence"
  | "embedded_pdf_text"
  | "filename_fallback";

export type ValidationStatus = "passed" | "warning" | "failed" | "not_checked";

export type ValidationSeverity = "info" | "warning" | "blocking";

export type MenuItemType = "link" | "group";

export type MenuRole = Role;

export type MenuLinkTarget = {
  id: string;
  label: string;
  href: string;
  roles: MenuRole[];
  locked?: boolean;
  category?: string;
  description?: string;
};

export type MenuConfigItem = {
  id: string;
  type: MenuItemType;
  label: string;
  href?: string;
  enabled: boolean;
  order: number;
  roles: MenuRole[];
  locked?: boolean;
  children?: MenuConfigItem[];
};

export type MenuSettings = {
  items: MenuConfigItem[];
};

export type PoValidationSettings = {
  enabled: boolean;
  requirePoToExistInPoList: boolean;
  blockSaveOnVendorMismatch: boolean;
  allowVendorUpdateFromPo: boolean;
  fuzzyVendorMatch: boolean;
  vendorMatchThreshold: number;
};

export type PoImportSettings = {
  headerRow: number;
  poNumberColumn: string;
  vendorNameColumn: string;
  vendorNumberColumn: string;
  departmentColumn: string;
  updateExisting: boolean;
  fillMissingData: boolean;
};

export type VendorImportSettings = {
  headerRow: number;
  vendorNameColumn: string;
  vendorNumberColumn: string;
  vendorEmailColumn: string;
  activeColumn: string;
  updateExisting: boolean;
  fillMissingData: boolean;
};

export type DashboardBoxMetricType = "count" | "dollars" | "countAndDollars";

export type DashboardBoxLinkedView =
  | "total"
  | "needs-ap-work"
  | "with-departments"
  | "completed";

export type DashboardBoxDepartmentScope = {
  appliesToAllDepartments: boolean;
  departmentIds: string[];
};

export type DashboardBox = {
  id: string;
  name: string;
  enabled: boolean;
  order: number;
  linkedViewId: DashboardBoxLinkedView;
  departmentScope: DashboardBoxDepartmentScope;
  statusIds: string[];
  metricType: DashboardBoxMetricType;
  createdAt: string;
  updatedAt: string;
};

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
  | "processedForPayment"
  | "rejected"
  | "hold";

export type InvoiceStatusDefinition = {
  id: string;
  label: string;
  active: boolean;
  tone: StatusTone;
  showInFilter: boolean;
  showInApWorkQueue: boolean;
  showInDepartmentWork: boolean;
  showInCompleted: boolean;
  includeInEscalation: boolean;
  includeInPaymentFile: boolean;
  systemRole?: StatusSystemRole;
  systemRoles?: StatusSystemRole[];
};

export type EscalationRecipientConfig = {
  includeDepartmentEmail: boolean;
  includeDepartmentHeadEmail: boolean;
  includeDepartmentEscalationEmail: boolean;
  includeOrganizationContactsForTriggeredSchedule: boolean;
  specificOrganizationContactIds: string[];
};

export type EscalationSchedule = {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  daysToNotify: number;
  statusIds: string[];
  businessDayRuleId?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationEscalationContact = {
  id: string;
  title: string;
  name: string;
  email: string;
  enabled: boolean;
  assignedScheduleIds: string[];
  departmentScope: {
    appliesToAllDepartments: boolean;
    departmentIds: string[];
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type EscalationTemplate = {
  id: string;
  name: string;
  enabled: boolean;
  scheduleIds: string[];
  recipientConfig: EscalationRecipientConfig;
  sortOrder: number;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type Holiday = {
  id: string;
  date: string;
  name: string;
  enabled: boolean;
  notes?: string;
};

export type EscalationSchedulerSettings = {
  enabled: boolean;
  timeOfDay: string;
  timezone: string;
  daysOfWeek: number[];
  excludedWeekdays: number[];
  excludeHolidays: boolean;
  countRoutedDateAsDayOne: boolean;
};

export type EscalationRunSummary = {
  id: string;
  runAt: string;
  mode: "live" | "dry-run";
  sentCount: number;
  wouldSendCount: number;
  failedCount: number;
  skippedCount?: number;
  errors: string[];
};

export type InvoiceEscalationEvent = {
  id: string;
  invoiceId?: string;
  scheduleId: string;
  scheduleName: string;
  templateId: string;
  templateName: string;
  sentAt: string;
  routedAt: string;
  daysToNotify: number;
  businessDaysWaiting: number;
  departmentId?: string;
  departmentName?: string;
  vendorName?: string;
  invoiceNumber?: string;
  recipients: string[];
  statusAtSend?: string;
};

export type DecisionWorkflowAction = "complete" | "reject" | "hold" | "apRework";

export type DepartmentDecisionDefinition = {
  id: string;
  label: string;
  workflowAction: DecisionWorkflowAction;
  requireComment: boolean;
  requirePoNumber: boolean;
  includeInPaymentFile: boolean;
  active: boolean;
};

export type Department = {
  id: string;
  name: string;
  email: string;
  departmentHeadName?: string;
  departmentHeadEmail?: string;
  escalationName?: string;
  escalationEmail?: string;
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
  | "vendorNumber"
  | "vendorValidationStatus"
  | "vendorValidationMessage"
  | "invoiceNumber"
  | "invoiceDate"
  | "amount"
  | "poNumber"
  | "poValidationStatus"
  | "poValidationMessage"
  | "poVendorName"
  | "department"
  | "departmentDecision"
  | "status"
  | "dateReceived"
  | "dateApproved"
  | "dateUploaded"
  | "dateSubmittedToDepartment"
  | "routedAt"
  | "notificationSentAt"
  | "statusDate"
  | "dateProcessedForPayment"
  | "paymentProcessed"
  | "requiresApAttention"
  | "apAttentionReason"
  | "duplicateCheckStatus"
  | "duplicateCheckMessage"
  | "duplicateCheckCheckedAt"
  | "ocrSummary"
  | "validationSummary"
  | "apReviewReasonCodes"
  | "processingStatus"
  | "extractionConfidence"
  | "fileOriginalName"
  | "fileHash";

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
  vendorNumber: string;
  departmentId: string;
  departmentName?: string;
  uploadedAt: string;
  updatedAt?: string;
};

export type Vendor = {
  id: string;
  vendorName: string;
  normalizedVendorName: string;
  vendorNumber: string;
  email: string;
  active: boolean;
  uploadedAt: string;
  updatedAt?: string;
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
  fileHash?: string;
  processingStatus?: DocumentProcessingStatus;
  uploadedAt: string;
};

export type InvoiceDocument = {
  id: string;
  invoiceId?: string;
  fileId?: string;
  originalFilename: string;
  fileHash: string;
  mimeType: string;
  sizeBytes: number;
  storageProvider: "local" | "blob";
  blobUrl?: string;
  blobPathname?: string;
  uploadedBy: string;
  uploadedAt: string;
  processingStatus: DocumentProcessingStatus;
  failureReason?: string;
};

export type InvoiceExtraction = {
  id: string;
  invoiceId?: string;
  documentId: string;
  provider: ExtractionSource;
  providerModel: string;
  rawText: string;
  rawJson?: unknown;
  documentType: "invoice" | "non_invoice" | "unknown";
  documentConfidence: number;
  ocrConfidence: number;
  extractionSummary: string;
  invoiceConfidence: number;
  createdAt: string;
};

export type InvoiceFieldCandidate = {
  id: string;
  invoiceId?: string;
  documentId: string;
  extractionId: string;
  fieldName: string;
  rawValue: string;
  normalizedValue: string;
  pageNumber?: number;
  boundingBox?: number[];
  nearbyLabel?: string;
  extractionSource: ExtractionSource;
  confidence: number;
  selected: boolean;
  validationStatus: ValidationStatus;
  validationMessage?: string;
  scoringReasons?: string[];
};

export type InvoiceValidationResult = {
  id: string;
  invoiceId?: string;
  documentId: string;
  fieldName?: string;
  status: ValidationStatus;
  code: string;
  message: string;
  severity: ValidationSeverity;
  createdAt: string;
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
  documentId?: string;
  extractionId?: string;
  vendorName: string;
  vendorRecordId?: string;
  vendorId?: string;
  vendorNumber?: string;
  vendorValidationStatus?: "Not Checked" | "Validated" | "Warning" | "Blocked";
  vendorValidationMessage?: string;
  vendorValidationCheckedAt?: string;
  vendorMatchConfidence?: number;
  vendorMatchSource?: "OCR" | "Manual Selection" | "PO Validation" | "Import" | "Unknown";
  invoiceNumber: string;
  invoiceDate: string;
  amount: string;
  poNumber: string;
  dateReceived: string;
  dateApproved: string;
  dateUploaded: string;
  dateSubmittedToDepartment: string;
  statusDate: string;
  routedAt: string;
  status: WorkflowStatus;
  departmentId: string;
  departmentDecision: string;
  paymentProcessed: boolean;
  dateProcessedForPayment: string;
  escalations: InvoiceEscalationEvent[];
  comments: InvoiceComment[];
  fileId: string;
  notificationSentAt: string;
  ocrSummary: string;
  extractionConfidence?: number;
  validationSummary?: string;
  apReviewReasonCodes?: string[];
  processingStatus?: DocumentProcessingStatus;
  poValidationStatus?:
    | "Not Checked"
    | "Matched"
    | "PO Not Found"
    | "Vendor Mismatch"
    | "Vendor Updated From PO";
  poValidationMessage?: string;
  poValidationCheckedAt?: string;
  poValidationPurchaseOrderId?: string;
  poVendorName?: string;
  duplicateCheckStatus?:
    | "Not Checked"
    | "No Duplicate"
    | "Potential Duplicate"
    | "Reviewed Not Duplicate";
  duplicateCheckMessage?: string;
  duplicateCheckCheckedAt?: string;
  duplicateMatchedInvoiceIds?: string[];
  duplicateReviewedAt?: string;
  duplicateReviewedBy?: string;
  duplicateReviewNote?: string;
  requiresApAttention?: boolean;
  apAttentionReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceFieldKey =
  | "vendorName"
  | "vendorNumber"
  | "invoiceNumber"
  | "invoiceDate"
  | "amount"
  | "poNumber"
  | "dateReceived"
  | "dateUploaded"
  | "departmentId"
  | "status"
  | "dateApproved"
  | "dateProcessedForPayment"
  | "routedAt"
  | "notificationSentAt"
  | "ocrSummary";

export type InvoiceFieldConfig = {
  key: InvoiceFieldKey;
  label: string;
  enabled: boolean;
  requiredForAp?: boolean;
  readOnly?: boolean;
  systemControlled?: boolean;
  locked?: boolean;
  sortOrder: number;
};

export type AppData = {
  departments: Department[];
  users: User[];
  purchaseOrders: PurchaseOrder[];
  vendors: Vendor[];
  invoices: Invoice[];
  invoiceFiles: InvoiceFile[];
  invoiceDocuments: InvoiceDocument[];
  invoiceExtractions: InvoiceExtraction[];
  invoiceFieldCandidates: InvoiceFieldCandidate[];
  invoiceValidationResults: InvoiceValidationResult[];
  auditEvents: AuditEvent[];
  notificationTemplate: NotificationTemplate;
  escalationSchedules: EscalationSchedule[];
  escalationTemplates: EscalationTemplate[];
  escalationScheduler: EscalationSchedulerSettings;
  holidays: Holiday[];
  organizationEscalationContacts: OrganizationEscalationContact[];
  escalationRunSummaries: EscalationRunSummary[];
  paymentFile: PaymentFileSettings;
  branding: BrandingSettings;
  statuses: InvoiceStatusDefinition[];
  invoiceFields: InvoiceFieldConfig[];
  dashboardBoxes: DashboardBox[];
  menuSettings: MenuSettings;
  poValidationSettings: PoValidationSettings;
  poImportSettings: PoImportSettings;
  vendorImportSettings: VendorImportSettings;
  departmentDecisions: DepartmentDecisionDefinition[];
  escalationContacts: EscalationContact[];
};

export type InvoiceFilter = {
  status?: string;
  department?: string;
  decisionType?: string;
  search?: string;
};
