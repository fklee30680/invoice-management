"use server";

import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  recordRunSummary,
  renderEscalationTemplate,
  runEscalationCheck,
} from "./escalations";
import { sendDepartmentNotification, sendEscalationNotification } from "./email";
import {
  deleteStoredBrandingLogo,
  deleteStoredInvoiceFile,
  saveBrandingLogo,
  saveInvoiceFile,
  stageFileForProcessing,
} from "./file-storage";
import { extractInvoiceMetadata } from "./ocr";
import { isPaymentFileFieldSource, sourceLabel } from "./payment-file";
import {
  DEFAULT_INVOICE_FIELDS,
  invoiceFieldEnabled,
  normalizeInvoiceFields,
} from "./invoice-fields";
import { parsePoUpload } from "./po-parser";
import { canAccessInvoice, requireApUser, requireUser } from "./session";
import { parseVendorUpload } from "./vendor-parser";
import {
  addAudit,
  addInvoice,
  addInvoiceFile,
  createId,
  findPurchaseOrder,
  findVendorByName,
  getInvoice,
  getInvoiceFile,
  mutateData,
  normalizeOrganizationDepartmentScope,
  readData,
  upsertDepartment,
  upsertPurchaseOrder,
  upsertVendor,
} from "./store";
import {
  STATUS_TONES,
  statusLabelForRole,
  statusRoles,
  statusesForCompleted,
} from "./status-config";
import type {
  BrandingLogo,
  DecisionWorkflowAction,
  Invoice,
  StatusTone,
} from "./types";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function colorValue(formData: FormData, key: string, fallback: string) {
  const candidate = value(formData, key);
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : fallback;
}

function fontValue(formData: FormData) {
  const allowed = new Set([
    "Arial, Helvetica, ui-sans-serif, system-ui, sans-serif",
    "'Segoe UI', Arial, ui-sans-serif, system-ui, sans-serif",
    "Verdana, Geneva, ui-sans-serif, system-ui, sans-serif",
    "Tahoma, Geneva, ui-sans-serif, system-ui, sans-serif",
    "Georgia, 'Times New Roman', serif",
  ]);
  const selected = value(formData, "fontFamily");
  return allowed.has(selected)
    ? selected
    : "Arial, Helvetica, ui-sans-serif, system-ui, sans-serif";
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function numberValue(formData: FormData, key: string, fallback = 0) {
  const parsed = Number(value(formData, key));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toneValue(formData: FormData) {
  const selected = value(formData, "tone") as StatusTone;
  return STATUS_TONES.includes(selected) ? selected : "slate";
}

function decisionWorkflowActionValue(formData: FormData) {
  const selected = value(formData, "workflowAction") as DecisionWorkflowAction;
  return ["complete", "reject", "hold", "apRework"].includes(selected)
    ? selected
    : "complete";
}

function baseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, key: string) => {
    return values[key] || "";
  });
}

function idList(formData: FormData, key: string) {
  return formData.getAll(key).map(String).filter(Boolean);
}

function escalationRecipientConfig(formData: FormData) {
  return {
    includeDepartmentEmail: checkbox(formData, "includeDepartmentEmail"),
    includeDepartmentHeadEmail: checkbox(formData, "includeDepartmentHeadEmail"),
    includeDepartmentEscalationEmail: checkbox(formData, "includeDepartmentEscalationEmail"),
    includeOrganizationContactsForTriggeredSchedule: checkbox(
      formData,
      "includeOrganizationContactsForTriggeredSchedule",
    ),
    specificOrganizationContactIds: idList(formData, "specificOrganizationContactIds"),
  };
}

function departmentScopeFromForm(formData: FormData) {
  return normalizeOrganizationDepartmentScope(idList(formData, "departmentScope"));
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function setInvoiceStatus(invoice: Invoice, status: string, now = new Date()) {
  if (invoice.status !== status) {
    invoice.status = status;
    invoice.statusDate = now.toISOString().slice(0, 10);
  }
}

async function notifyDepartment(invoice: Invoice) {
  await mutateData(async (data) => {
    const storedInvoice = getInvoice(data, invoice.id);
    if (!storedInvoice) return;
    const department = data.departments.find(
      (item) => item.id === storedInvoice.departmentId,
    );
    if (!department) return;
    const templateValues = {
      vendor_name: storedInvoice.vendorName || "Unknown Vendor",
      invoice_number: storedInvoice.invoiceNumber || "Not set",
      po_number: storedInvoice.poNumber || "Not set",
      amount: storedInvoice.amount || "Not set",
      department_name: department.name,
      review_link: `${baseUrl()}/review/${storedInvoice.id}`,
    };
    const subject = fillTemplate(
      data.notificationTemplate.departmentSubject,
      templateValues,
    ).trim();
    const body = fillTemplate(
      data.notificationTemplate.departmentBody,
      templateValues,
    ).trim();
    try {
      await sendDepartmentNotification({
        invoiceId: storedInvoice.id,
        departmentName: department.name,
        departmentEmail: department.email,
        subject: subject || `Invoice review needed: ${templateValues.vendor_name}`,
        body,
        link: templateValues.review_link,
      });
      storedInvoice.notificationSentAt = new Date().toISOString();
      if (!storedInvoice.routedAt) {
        storedInvoice.routedAt = storedInvoice.notificationSentAt;
        storedInvoice.dateSubmittedToDepartment =
          storedInvoice.notificationSentAt.slice(0, 10);
      }
      addAudit(data, {
        invoiceId: storedInvoice.id,
        actor: "AP",
        type: "notification_sent",
        message: `Department notification sent to ${department.name}.`,
      });
    } catch (error) {
      addAudit(data, {
        invoiceId: storedInvoice.id,
        actor: "System",
        type: "notification_failed",
        message: error instanceof Error ? error.message : "Department notification failed.",
      });
    }
  });
}

export async function uploadPoList(formData: FormData) {
  const file = formData.get("poFile");
  if (!(file instanceof File) || file.size === 0) {
    return;
  }

  const rows = await parsePoUpload(file);
  await mutateData((data) => {
    for (const row of rows) {
      upsertPurchaseOrder(data, row.poNumber, row.vendorName, row.departmentName);
    }
    addAudit(data, {
      actor: "AP",
      type: "po_upload",
      message: `Imported ${rows.length} purchase order rows from ${file.name}.`,
    });
  });

  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath("/uploads/po-list");
}

export async function uploadVendorList(formData: FormData) {
  const file = formData.get("vendorFile");
  if (!(file instanceof File) || file.size === 0) {
    return;
  }

  const rows = await parseVendorUpload(file, {
    headerRow: Math.max(Number(value(formData, "headerRow")) || 1, 1),
    vendorName: value(formData, "vendorNameColumn") || "Vendor Name",
    vendorNumber: value(formData, "vendorNumberColumn"),
    email: value(formData, "vendorEmailColumn"),
    active: value(formData, "activeColumn"),
  });

  await mutateData((data) => {
    for (const row of rows) {
      upsertVendor(
        data,
        row.vendorName,
        row.vendorNumber,
        row.email,
        row.active,
      );
    }
    addAudit(data, {
      actor: "AP",
      type: "vendor_upload",
      message: `Imported ${rows.length} vendor rows from ${file.name}.`,
    });
  });

  revalidatePath("/");
  revalidatePath("/uploads/vendors");
}

export async function updatePaymentFileSettings(formData: FormData) {
  await requireApUser();
  const columnIds = formData.getAll("columnId").map((item) => String(item));

  await mutateData((data) => {
    data.paymentFile.columns = columnIds
      .map((columnId, index) => {
        const source = value(formData, `source-${columnId}`);
        if (!isPaymentFileFieldSource(source)) return null;
        const submittedOrder = Number(value(formData, `order-${columnId}`));
        return {
          column: {
            id: columnId,
            header: value(formData, `header-${columnId}`) || sourceLabel(source),
            source,
            included: checkbox(formData, `included-${columnId}`),
          },
          index,
          order:
            Number.isInteger(submittedOrder) && submittedOrder >= 1
              ? submittedOrder
              : index + 1,
        };
      })
      .filter((item) => item !== null)
      .sort((a, b) => a.order - b.order || a.index - b.index)
      .map((item) => item.column);

    addAudit(data, {
      actor: "AP",
      type: "payment_file_updated",
      message: "Updated payment file column setup.",
    });
  });

  revalidatePath("/files/payment-file");
}

export async function addPaymentFileColumn(formData: FormData) {
  await requireApUser();
  const source = value(formData, "source");
  if (!isPaymentFileFieldSource(source)) return;

  await mutateData((data) => {
    data.paymentFile.columns.push({
      id: createId("payment-column"),
      header: value(formData, "header") || sourceLabel(source),
      source,
      included: true,
    });
    addAudit(data, {
      actor: "AP",
      type: "payment_file_column_added",
      message: "Added payment file column.",
    });
  });

  revalidatePath("/files/payment-file");
}

export async function deletePaymentFileColumn(formData: FormData) {
  await requireApUser();
  const columnId = value(formData, "columnId");
  if (!columnId) return;

  await mutateData((data) => {
    data.paymentFile.columns = data.paymentFile.columns.filter(
      (column) => column.id !== columnId,
    );
    addAudit(data, {
      actor: "AP",
      type: "payment_file_column_deleted",
      message: "Deleted payment file column.",
    });
  });

  revalidatePath("/files/payment-file");
}

export async function markManualPaymentInvoicesPaid(formData: FormData) {
  await requireApUser();
  const invoiceIds = new Set(
    formData.getAll("invoiceId").map((item) => String(item)).filter(Boolean),
  );
  if (invoiceIds.size === 0) return;

  await mutateData((data) => {
    let count = 0;
    const completedStatuses = statusesForCompleted(data);
    for (const invoice of data.invoices) {
      if (!invoiceIds.has(invoice.id)) continue;
      if (!completedStatuses.includes(invoice.status) || invoice.paymentProcessed) {
        continue;
      }
      invoice.paymentProcessed = true;
      invoice.updatedAt = new Date().toISOString();
      count += 1;
      addAudit(data, {
        invoiceId: invoice.id,
        actor: "AP",
        type: "payment_processed_updated",
        message: "AP marked invoice paid from manual payment list.",
      });
    }
    addAudit(data, {
      actor: "AP",
      type: "manual_payment_batch_paid",
      message: `Marked ${count} manual payment invoices as paid.`,
    });
  });

  revalidatePath("/");
  revalidatePath("/invoices", "layout");
}

export async function uploadInvoices(formData: FormData) {
  const files = formData
    .getAll("invoiceFiles")
    .filter((file): file is File => file instanceof File && file.size > 0);

  try {
    for (const file of files) {
      const invoiceId = createId("invoice");
      const fileId = createId("file");
      const extension = path.extname(file.name) || ".bin";
      const storedName = `${invoiceId}${extension}`;
      const bytes = Buffer.from(await file.arrayBuffer());
      const filePath = await stageFileForProcessing(bytes, storedName);

      const extracted = await extractInvoiceMetadata(filePath, file.name, file.type);
      const now = new Date().toISOString();
      const invoiceFile = await saveInvoiceFile({
        id: fileId,
        invoiceId,
        originalName: file.name,
        storedName,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        uploadedAt: now,
        bytes,
      });

      await mutateData((data) => {
        const purchaseOrder = findPurchaseOrder(data, extracted.poNumber);
        const vendorName = extracted.vendorName || purchaseOrder?.vendorName || "";
        const vendorRecord = purchaseOrder ? undefined : findVendorByName(data, vendorName);
        const vendorValidationStatus = purchaseOrder
          ? "Not Checked"
          : vendorRecord
            ? "Matched"
            : "Not Found";
        const departmentId = purchaseOrder?.departmentId || "";
        const department = data.departments.find((item) => item.id === departmentId);
        const canNotify = Boolean(purchaseOrder && department?.email);
        const status = canNotify
          ? statusLabelForRole(data, "routed")
          : statusLabelForRole(data, "apReview");

        addInvoiceFile(data, invoiceFile);

        const invoice: Invoice = {
          id: invoiceId,
          vendorName,
          vendorRecordId: vendorRecord?.id,
          vendorValidationStatus,
          invoiceNumber: extracted.invoiceNumber,
          invoiceDate: extracted.invoiceDate,
          amount: extracted.amount,
          poNumber: extracted.poNumber,
          dateReceived: now.slice(0, 10),
          dateApproved: "",
          dateUploaded: now.slice(0, 10),
          dateSubmittedToDepartment: canNotify ? now.slice(0, 10) : "",
          statusDate: now.slice(0, 10),
          routedAt: canNotify ? now : "",
          status,
          departmentId,
          departmentDecision: "",
          paymentProcessed: false,
          escalations: [],
          comments: [],
          fileId,
          notificationSentAt: "",
          ocrSummary: purchaseOrder
            ? extracted.summary
            : `${extracted.summary} Vendor record: ${vendorValidationStatus}.`.trim(),
          createdAt: now,
          updatedAt: now,
        };

        addInvoice(data, invoice);
        addAudit(data, {
          invoiceId,
          actor: "AP",
          type: "invoice_uploaded",
          message: `Uploaded ${file.name}.`,
        });
        addAudit(data, {
          invoiceId,
          actor: "System",
          type: purchaseOrder ? "po_matched" : "po_missing",
          message: purchaseOrder && department?.email
            ? `Matched ${purchaseOrder.poNumber}; routed to department.`
            : purchaseOrder
              ? `Matched ${purchaseOrder.poNumber}, but ${department?.name || "the department"} has no email configured. AP review required.`
              : "No matching PO found; AP review required.",
        });
        if (!purchaseOrder) {
          addAudit(data, {
            invoiceId,
            actor: "System",
            type: vendorRecord ? "vendor_matched" : "vendor_missing",
            message: vendorRecord
              ? `Vendor matched vendor record: ${vendorRecord.vendorName}.`
              : "Vendor was not found in the vendor list.",
          });
        }
      });

      const data = await mutateData((current) => current);
      const invoice = getInvoice(data, invoiceId);
      if (invoice?.status === statusLabelForRole(data, "routed")) {
        await notifyDepartment(invoice);
      }
    }
  } catch {
    redirect("/?error=file-storage");
  }

  revalidatePath("/");
}

function applyApInvoiceMetadataUpdate(
  data: Awaited<ReturnType<typeof readData>>,
  invoice: Invoice,
  formData: FormData,
) {
  const previousDepartmentId = invoice.departmentId;
  const previousDepartment = data.departments.find(
    (department) => department.id === previousDepartmentId,
  );
  const previousStatus = invoice.status;
  const previousRoutedAt = invoice.routedAt;
  const now = new Date();
  const nowIso = now.toISOString();

  if (invoiceFieldEnabled(data, "vendorName") && formData.has("vendorName")) {
    invoice.vendorName = value(formData, "vendorName");
  }
  if (invoiceFieldEnabled(data, "invoiceNumber") && formData.has("invoiceNumber")) {
    invoice.invoiceNumber = value(formData, "invoiceNumber");
  }
  if (invoiceFieldEnabled(data, "invoiceDate") && formData.has("invoiceDate")) {
    invoice.invoiceDate = value(formData, "invoiceDate");
  }
  if (invoiceFieldEnabled(data, "amount") && formData.has("amount")) {
    invoice.amount = value(formData, "amount");
  }
  if (invoiceFieldEnabled(data, "poNumber") && formData.has("poNumber")) {
    invoice.poNumber = value(formData, "poNumber");
  }
  if (invoiceFieldEnabled(data, "dateReceived") && formData.has("dateReceived")) {
    invoice.dateReceived = value(formData, "dateReceived");
  }
  if (invoiceFieldEnabled(data, "dateUploaded") && formData.has("dateUploaded")) {
    invoice.dateUploaded = value(formData, "dateUploaded");
  }
  if (invoiceFieldEnabled(data, "departmentId") && formData.has("departmentId")) {
    invoice.departmentId = value(formData, "departmentId");
  }

  const purchaseOrder = findPurchaseOrder(data, invoice.poNumber);
  const vendorRecord = purchaseOrder
    ? undefined
    : findVendorByName(data, invoice.vendorName);
  invoice.vendorRecordId = vendorRecord?.id;
  invoice.vendorValidationStatus = purchaseOrder
    ? "Not Checked"
    : vendorRecord
      ? "Matched"
      : "Not Found";

  const routedStatus = statusLabelForRole(data, "routed");
  const nextStatus = invoice.departmentId
    ? routedStatus
    : statusLabelForRole(data, "apReview");
  const departmentChanged = previousDepartmentId !== invoice.departmentId;
  const firstRoute =
    Boolean(invoice.departmentId) &&
    (!previousDepartmentId || !previousRoutedAt || previousStatus !== routedStatus);

  setInvoiceStatus(invoice, nextStatus, now);

  if (invoice.departmentId && (departmentChanged || firstRoute)) {
    invoice.routedAt = nowIso;
    invoice.dateSubmittedToDepartment = nowIso.slice(0, 10);
    invoice.departmentDecision = "";
    invoice.notificationSentAt = "";
  }

  if (!invoice.departmentId) {
    invoice.routedAt = "";
    invoice.dateSubmittedToDepartment = "";
    invoice.departmentDecision = "";
    invoice.notificationSentAt = "";
  }

  if (!statusesForCompleted(data).includes(invoice.status)) {
    invoice.dateApproved = "";
  }

  invoice.updatedAt = nowIso;

  const nextDepartment = data.departments.find(
    (department) => department.id === invoice.departmentId,
  );
  const shouldNotify =
    invoice.status === routedStatus &&
    Boolean(invoice.departmentId) &&
    (departmentChanged || firstRoute);

  addAudit(data, {
    invoiceId: invoice.id,
    actor: "AP",
    type: departmentChanged ? "rerouted" : "ap_invoice_information_updated",
    message: departmentChanged
      ? `AP changed department from ${previousDepartment?.name || "Unassigned"} to ${nextDepartment?.name || "Unassigned"}${invoice.departmentId ? " and rerouted the invoice. Routed date was reset." : " and returned the invoice to AP review."}`
      : "AP updated invoice information.",
  });

  return { shouldNotify };
}

export async function updateAndRouteInvoice(formData: FormData) {
  await requireApUser();
  const invoiceId = value(formData, "invoiceId");
  let updatedInvoice: Invoice | undefined;
  let shouldNotify = false;

  await mutateData((data) => {
    const invoice = getInvoice(data, invoiceId);
    if (!invoice) return;

    const result = applyApInvoiceMetadataUpdate(data, invoice, formData);
    shouldNotify = result.shouldNotify;
    updatedInvoice = invoice;
  });

  const current = await mutateData((data) => data);
  if (updatedInvoice?.status === statusLabelForRole(current, "routed") && shouldNotify) {
    await notifyDepartment(updatedInvoice);
  }

  revalidatePath("/");
  revalidatePath("/department");
  revalidatePath("/reports");
  revalidatePath("/invoices/total");
  revalidatePath("/invoices/needs-ap-work");
  revalidatePath("/invoices/with-departments");
  revalidatePath("/invoices/completed");
  revalidatePath("/invoices/manual-payment");
  revalidatePath(`/review/${invoiceId}`);
}

export async function addDepartment(formData: FormData) {
  const name = value(formData, "name");
  const email = value(formData, "email").toLowerCase();
  if (!name || !email) return;

  await mutateData((data) => {
    const department = upsertDepartment(data, name, email);
    department.departmentHeadName = value(formData, "departmentHeadName");
    department.departmentHeadEmail = value(formData, "departmentHeadEmail").toLowerCase();
    department.escalationName = value(formData, "escalationName");
    department.escalationEmail = value(formData, "escalationEmail").toLowerCase();
    addAudit(data, {
      actor: "AP",
      type: "department_saved",
      message: `Saved department email for ${department.name}.`,
    });
  });

  revalidatePath("/");
  revalidatePath("/settings");
}

export async function updateDepartment(formData: FormData) {
  const departmentId = value(formData, "departmentId");
  const name = value(formData, "name");
  const email = value(formData, "email").toLowerCase();
  if (!departmentId || !name || !email) return;

  await mutateData((data) => {
    const department = data.departments.find((item) => item.id === departmentId);
    if (!department) return;
    department.name = name;
    department.email = email;
    department.departmentHeadName = value(formData, "departmentHeadName");
    department.departmentHeadEmail = value(formData, "departmentHeadEmail").toLowerCase();
    department.escalationName = value(formData, "escalationName");
    department.escalationEmail = value(formData, "escalationEmail").toLowerCase();
    addAudit(data, {
      actor: "AP",
      type: "department_updated",
      message: `Updated department setup for ${department.name}.`,
    });
  });

  revalidatePath("/");
  revalidatePath("/settings");
}

export async function addEscalationContact(formData: FormData) {
  await requireApUser();
  const name = value(formData, "name");
  const email = value(formData, "email").toLowerCase();
  if (!name || !email) return;

  await mutateData((data) => {
    const selectedDepartments = formData.getAll("departmentIds").map(String);
    const allDepartments = selectedDepartments.includes("all");
    data.escalationContacts.push({
      id: createId("escalation"),
      name,
      email,
      allDepartments,
      departmentIds: allDepartments ? [] : selectedDepartments.filter(Boolean),
      daysToNotify: Math.max(Number(value(formData, "daysToNotify")) || 1, 1),
    });
    addAudit(data, {
      actor: "AP",
      type: "escalation_contact_added",
      message: `Added escalation contact ${name}.`,
    });
  });

  revalidatePath("/settings/escalation");
}

export async function updateEscalationContact(formData: FormData) {
  await requireApUser();
  const contactId = value(formData, "contactId");
  const name = value(formData, "name");
  const email = value(formData, "email").toLowerCase();
  if (!contactId || !name || !email) return;

  await mutateData((data) => {
    const contact = data.escalationContacts.find((item) => item.id === contactId);
    if (!contact) return;
    const selectedDepartments = formData.getAll("departmentIds").map(String);
    const allDepartments = selectedDepartments.includes("all");
    contact.name = name;
    contact.email = email;
    contact.allDepartments = allDepartments;
    contact.departmentIds = allDepartments
      ? []
      : selectedDepartments.filter(Boolean);
    contact.daysToNotify = Math.max(Number(value(formData, "daysToNotify")) || 1, 1);
    addAudit(data, {
      actor: "AP",
      type: "escalation_contact_updated",
      message: `Updated escalation contact ${contact.name}.`,
    });
  });

  revalidatePath("/settings/escalation");
}

export async function deleteEscalationContact(formData: FormData) {
  await requireApUser();
  const contactId = value(formData, "contactId");
  if (!contactId) return;

  await mutateData((data) => {
    data.escalationContacts = data.escalationContacts.filter(
      (contact) => contact.id !== contactId,
    );
    addAudit(data, {
      actor: "AP",
      type: "escalation_contact_deleted",
      message: "Deleted escalation contact.",
    });
  });

  revalidatePath("/settings/escalation");
}

export async function updateNotificationTemplate(formData: FormData) {
  const departmentSubject = value(formData, "departmentSubject");
  const departmentBody = value(formData, "departmentBody");
  if (!departmentSubject || !departmentBody) {
    return;
  }

  await mutateData((data) => {
    data.notificationTemplate.departmentSubject = departmentSubject;
    data.notificationTemplate.departmentBody = departmentBody;
    addAudit(data, {
      actor: "AP",
      type: "notification_template_updated",
      message: "Updated department notification email template.",
    });
  });

  revalidatePath("/");
  revalidatePath("/settings/email");
}

export async function addEscalationTemplate(formData: FormData) {
  await requireApUser();
  const name = value(formData, "name");
  const subject = value(formData, "subject");
  const body = value(formData, "body");
  const enabled = checkbox(formData, "enabled");
  const scheduleIds = idList(formData, "scheduleIds");
  if (!name || !subject || !body) return;
  if (enabled && scheduleIds.length === 0) return;

  await mutateData((data) => {
    data.escalationTemplates.push({
      id: createId("escalation-template"),
      name,
      enabled,
      scheduleIds,
      recipientConfig: escalationRecipientConfig(formData),
      sortOrder: numberValue(formData, "sortOrder", data.escalationTemplates.length + 1),
      subject,
      body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    addAudit(data, {
      actor: "AP",
      type: "escalation_template_added",
      message: `Added escalation template ${name}.`,
    });
  });

  revalidatePath("/settings/holidays-business-days");
  revalidatePath("/settings/scheduler");
  revalidatePath("/settings/holidays-business-days");
  revalidatePath("/settings/email");
}

export async function updateEscalationTemplate(formData: FormData) {
  await requireApUser();
  const templateId = value(formData, "templateId");
  const name = value(formData, "name");
  const subject = value(formData, "subject");
  const body = value(formData, "body");
  const enabled = checkbox(formData, "enabled");
  const scheduleIds = idList(formData, "scheduleIds");
  if (!templateId || !name || !subject || !body) return;
  if (enabled && scheduleIds.length === 0) return;

  await mutateData((data) => {
    const template = data.escalationTemplates.find((item) => item.id === templateId);
    if (!template) return;
    template.name = name;
    template.enabled = enabled;
    template.scheduleIds = scheduleIds;
    template.recipientConfig = escalationRecipientConfig(formData);
    template.sortOrder = numberValue(formData, "sortOrder", template.sortOrder);
    template.subject = subject;
    template.body = body;
    template.updatedAt = new Date().toISOString();
    addAudit(data, {
      actor: "AP",
      type: "escalation_template_updated",
      message: `Updated escalation template ${name}.`,
    });
  });

  revalidatePath("/settings/holidays-business-days");
  revalidatePath("/settings/holidays-business-days");
  revalidatePath("/settings/email");
}

export async function deleteEscalationTemplate(formData: FormData) {
  await requireApUser();
  const templateId = value(formData, "templateId");
  if (!templateId) return;

  await mutateData((data) => {
    const template = data.escalationTemplates.find((item) => item.id === templateId);
    data.escalationTemplates = data.escalationTemplates.filter(
      (item) => item.id !== templateId,
    );
    addAudit(data, {
      actor: "AP",
      type: "escalation_template_deleted",
      message: `Deleted escalation template ${template?.name || templateId}.`,
    });
  });

  revalidatePath("/settings/holidays-business-days");
  revalidatePath("/settings/holidays-business-days");
  revalidatePath("/settings/email");
}

export async function addEscalationSchedule(formData: FormData) {
  await requireApUser();
  const name = value(formData, "name");
  if (!name) return;

  await mutateData((data) => {
    data.escalationSchedules.push({
      id: createId("schedule"),
      name,
      description: value(formData, "description"),
      enabled: checkbox(formData, "enabled"),
      daysToNotify: Math.max(numberValue(formData, "daysToNotify", 0), 0),
      businessDayRuleId: value(formData, "businessDayRuleId"),
      sortOrder: numberValue(formData, "sortOrder", data.escalationSchedules.length + 1),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    addAudit(data, {
      actor: "AP",
      type: "escalation_schedule_added",
      message: `Added escalation schedule ${name}.`,
    });
  });

  revalidatePath("/settings/escalation-schedules");
  revalidatePath("/settings/holidays-business-days");
  revalidatePath("/settings/email");
}

export async function updateEscalationSchedule(formData: FormData) {
  await requireApUser();
  const scheduleId = value(formData, "scheduleId");
  const name = value(formData, "name");
  if (!scheduleId || !name) return;

  await mutateData((data) => {
    const schedule = data.escalationSchedules.find((item) => item.id === scheduleId);
    if (!schedule) return;
    schedule.name = name;
    schedule.description = value(formData, "description");
    schedule.enabled = checkbox(formData, "enabled");
    schedule.daysToNotify = Math.max(numberValue(formData, "daysToNotify", 0), 0);
    schedule.businessDayRuleId = value(formData, "businessDayRuleId");
    schedule.sortOrder = numberValue(formData, "sortOrder", schedule.sortOrder);
    schedule.updatedAt = new Date().toISOString();
    addAudit(data, {
      actor: "AP",
      type: "escalation_schedule_updated",
      message: `Updated escalation schedule ${name}.`,
    });
  });

  revalidatePath("/settings/escalation-schedules");
  revalidatePath("/settings/email");
}

export async function deleteEscalationSchedule(formData: FormData) {
  await requireApUser();
  const scheduleId = value(formData, "scheduleId");
  if (!scheduleId) return;

  await mutateData((data) => {
    const schedule = data.escalationSchedules.find((item) => item.id === scheduleId);
    const hasHistory = data.invoices.some((invoice) =>
      invoice.escalations.some((event) => event.scheduleId === scheduleId),
    );
    if (hasHistory && schedule) {
      schedule.enabled = false;
      schedule.updatedAt = new Date().toISOString();
      addAudit(data, {
        actor: "AP",
        type: "escalation_schedule_disabled",
        message: `Disabled escalation schedule ${schedule.name}; historical events exist.`,
      });
      return;
    }
    data.escalationSchedules = data.escalationSchedules.filter(
      (item) => item.id !== scheduleId,
    );
    for (const template of data.escalationTemplates) {
      template.scheduleIds = template.scheduleIds.filter((id) => id !== scheduleId);
    }
    for (const contact of data.organizationEscalationContacts) {
      contact.assignedScheduleIds = contact.assignedScheduleIds.filter(
        (id) => id !== scheduleId,
      );
    }
    addAudit(data, {
      actor: "AP",
      type: "escalation_schedule_deleted",
      message: `Deleted escalation schedule ${schedule?.name || scheduleId}.`,
    });
  });

  revalidatePath("/settings/escalation-schedules");
  revalidatePath("/settings/organization-escalation-contacts");
  revalidatePath("/settings/email");
}

export async function addOrganizationEscalationContact(formData: FormData) {
  await requireApUser();
  const title = value(formData, "title");
  const name = value(formData, "name");
  const email = value(formData, "email").toLowerCase();
  const enabled = checkbox(formData, "enabled");
  const assignedScheduleIds = idList(formData, "assignedScheduleIds");
  const departmentScope = departmentScopeFromForm(formData);
  if (!title || !name || !email || !validEmail(email)) return;
  if (enabled && assignedScheduleIds.length === 0) return;
  if (
    enabled &&
    !departmentScope.appliesToAllDepartments &&
    departmentScope.departmentIds.length === 0
  ) {
    return;
  }

  await mutateData((data) => {
    data.organizationEscalationContacts.push({
      id: createId("org-contact"),
      title,
      name,
      email,
      enabled,
      assignedScheduleIds,
      departmentScope,
      notes: value(formData, "notes"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    addAudit(data, {
      actor: "AP",
      type: "organization_escalation_contact_added",
      message: `Added organization escalation contact ${title}.`,
    });
  });

  revalidatePath("/settings/organization-escalation-contacts");
  revalidatePath("/settings/email");
}

export async function updateOrganizationEscalationContact(formData: FormData) {
  await requireApUser();
  const contactId = value(formData, "contactId");
  const title = value(formData, "title");
  const name = value(formData, "name");
  const email = value(formData, "email").toLowerCase();
  const enabled = checkbox(formData, "enabled");
  const assignedScheduleIds = idList(formData, "assignedScheduleIds");
  const departmentScope = departmentScopeFromForm(formData);
  if (!contactId || !title || !name || !email || !validEmail(email)) return;
  if (enabled && assignedScheduleIds.length === 0) return;
  if (
    enabled &&
    !departmentScope.appliesToAllDepartments &&
    departmentScope.departmentIds.length === 0
  ) {
    return;
  }

  await mutateData((data) => {
    const contact = data.organizationEscalationContacts.find(
      (item) => item.id === contactId,
    );
    if (!contact) return;
    contact.title = title;
    contact.name = name;
    contact.email = email;
    contact.enabled = enabled;
    contact.assignedScheduleIds = assignedScheduleIds;
    contact.departmentScope = departmentScope;
    contact.notes = value(formData, "notes");
    contact.updatedAt = new Date().toISOString();
    addAudit(data, {
      actor: "AP",
      type: "organization_escalation_contact_updated",
      message: `Updated organization escalation contact ${title}.`,
    });
  });

  revalidatePath("/settings/organization-escalation-contacts");
  revalidatePath("/settings/email");
}

export async function deleteOrganizationEscalationContact(formData: FormData) {
  await requireApUser();
  const contactId = value(formData, "contactId");
  if (!contactId) return;

  await mutateData((data) => {
    const contact = data.organizationEscalationContacts.find(
      (item) => item.id === contactId,
    );
    const hasHistory = data.invoices.some((invoice) =>
      invoice.escalations.some((event) =>
        event.recipients.includes(contact?.email || ""),
      ),
    );
    if (hasHistory && contact) {
      contact.enabled = false;
      contact.updatedAt = new Date().toISOString();
      addAudit(data, {
        actor: "AP",
        type: "organization_escalation_contact_disabled",
        message: `Disabled organization escalation contact ${contact.title}; historical events exist.`,
      });
      return;
    }
    data.organizationEscalationContacts = data.organizationEscalationContacts.filter(
      (item) => item.id !== contactId,
    );
    for (const template of data.escalationTemplates) {
      template.recipientConfig.specificOrganizationContactIds =
        template.recipientConfig.specificOrganizationContactIds.filter(
          (id) => id !== contactId,
        );
    }
    addAudit(data, {
      actor: "AP",
      type: "organization_escalation_contact_deleted",
      message: `Deleted organization escalation contact ${contact?.title || contactId}.`,
    });
  });

  revalidatePath("/settings/organization-escalation-contacts");
  revalidatePath("/settings/email");
}

export async function updateEscalationSchedulerSettings(formData: FormData) {
  await requireApUser();
  await mutateData((data) => {
    data.escalationScheduler = {
      enabled: checkbox(formData, "enabled"),
      timeOfDay: value(formData, "timeOfDay") || "08:00",
      timezone: value(formData, "timezone") || "America/New_York",
      daysOfWeek: formData.getAll("daysOfWeek").map(Number),
      excludedWeekdays: formData.getAll("excludedWeekdays").map(Number),
      excludeHolidays: checkbox(formData, "excludeHolidays"),
      countRoutedDateAsDayOne: checkbox(formData, "countRoutedDateAsDayOne"),
    };
    addAudit(data, {
      actor: "AP",
      type: "escalation_scheduler_updated",
      message: "Updated escalation scheduler runtime settings.",
    });
  });

  revalidatePath("/settings/email");
}

export async function addHoliday(formData: FormData) {
  await requireApUser();
  const date = value(formData, "date");
  const name = value(formData, "name");
  if (!date || !name) return;

  await mutateData((data) => {
    data.holidays.push({
      id: createId("holiday"),
      date,
      name,
      enabled: checkbox(formData, "enabled"),
      notes: value(formData, "notes"),
    });
    addAudit(data, {
      actor: "AP",
      type: "holiday_added",
      message: `Added holiday ${name}.`,
    });
  });

  revalidatePath("/settings/email");
}

export async function updateHoliday(formData: FormData) {
  await requireApUser();
  const holidayId = value(formData, "holidayId");
  if (!holidayId) return;

  await mutateData((data) => {
    const holiday = data.holidays.find((item) => item.id === holidayId);
    if (!holiday) return;
    holiday.date = value(formData, "date");
    holiday.name = value(formData, "name");
    holiday.enabled = checkbox(formData, "enabled");
    holiday.notes = value(formData, "notes");
    addAudit(data, {
      actor: "AP",
      type: "holiday_updated",
      message: `Updated holiday ${holiday.name}.`,
    });
  });

  revalidatePath("/settings/email");
}

export async function deleteHoliday(formData: FormData) {
  await requireApUser();
  const holidayId = value(formData, "holidayId");
  if (!holidayId) return;

  await mutateData((data) => {
    const holiday = data.holidays.find((item) => item.id === holidayId);
    data.holidays = data.holidays.filter((item) => item.id !== holidayId);
    addAudit(data, {
      actor: "AP",
      type: "holiday_deleted",
      message: `Deleted holiday ${holiday?.name || holidayId}.`,
    });
  });

  revalidatePath("/settings/email");
}

export async function runEscalationsNow() {
  await requireApUser();
  await runEscalationCheck({ dryRun: false, ignoreSchedule: true });
  revalidatePath("/settings/email");
  revalidatePath("/settings/scheduler");
}

export async function sendTestEscalationEmail(formData: FormData) {
  await requireApUser();
  const templateId = value(formData, "templateId");
  const testEmail = value(formData, "testEmail").toLowerCase();
  if (!templateId || !testEmail) return;

  const data = await readData();
  const template = data.escalationTemplates.find((item) => item.id === templateId);
  if (!template) return;
  const rendered = renderEscalationTemplate(template, {
    vendor_name: "Sample Vendor",
    invoice_number: "INV-1001",
    po_number: "PO-1001",
    amount: "$1,250.00",
    department_name: "Sample Department",
    review_link: `${baseUrl()}/review/sample`,
    escalation_schedule_name: "Sample Schedule",
    escalation_schedule_days: "3",
    escalation_template_name: template.name,
    business_days_waiting: "3",
    routed_at: new Date().toISOString().slice(0, 10),
    notification_sent_at: new Date().toISOString().slice(0, 10),
    organization_contact_titles: data.organizationEscalationContacts
      .map((contact) => contact.title)
      .join(", "),
    organization_contact_names: data.organizationEscalationContacts
      .map((contact) => contact.name)
      .join(", "),
  });

  await sendEscalationNotification({
    invoiceId: "sample",
    subject: rendered.subject,
    body: rendered.body,
    link: `${baseUrl()}/review/sample`,
    to: [testEmail],
    escalationLevel: template.name,
    templateId: template.id,
  });

  const result = {
    runAt: new Date().toISOString(),
    mode: "live" as const,
    candidates: [],
    skippedNoRecipientCount: 0,
    sentCount: 1,
    wouldSendCount: 0,
    failedCount: 0,
    errors: [],
  };
  await recordRunSummary(result);
  revalidatePath("/settings/email");
}

export async function addInvoiceStatus(formData: FormData) {
  const label = value(formData, "label");
  if (!label) return;

  await mutateData((data) => {
    const exists = data.statuses.some(
      (status) => status.label.toLowerCase() === label.toLowerCase(),
    );
    if (exists) return;

    data.statuses.push({
      id: createId("status"),
      label,
      tone: toneValue(formData),
      showInFilter: checkbox(formData, "showInFilter"),
      showInApWorkQueue: checkbox(formData, "showInApWorkQueue"),
      showInDepartmentWork: checkbox(formData, "showInDepartmentWork"),
      showInCompleted: checkbox(formData, "showInCompleted"),
      includeInEscalation: checkbox(formData, "includeInEscalation"),
    });
    addAudit(data, {
      actor: "AP",
      type: "status_added",
      message: `Added invoice status ${label}.`,
    });
  });

  revalidatePath("/");
  revalidatePath("/invoices", "layout");
  revalidatePath("/settings/statuses");
}

export async function updateInvoiceStatus(formData: FormData) {
  const statusId = value(formData, "statusId");
  const label = value(formData, "label");
  if (!statusId || !label) return;

  await mutateData((data) => {
    const status = data.statuses.find((item) => item.id === statusId);
    if (!status) return;
    const duplicate = data.statuses.some(
      (item) =>
        item.id !== statusId && item.label.toLowerCase() === label.toLowerCase(),
    );
    if (duplicate) return;

    const oldLabel = status.label;
    status.label = label;
    status.tone = toneValue(formData);
    status.showInFilter = checkbox(formData, "showInFilter");
    status.showInApWorkQueue = checkbox(formData, "showInApWorkQueue");
    status.showInDepartmentWork = checkbox(formData, "showInDepartmentWork");
    status.showInCompleted = checkbox(formData, "showInCompleted");
    status.includeInEscalation = checkbox(formData, "includeInEscalation");

    if (oldLabel !== label) {
      for (const invoice of data.invoices) {
        if (invoice.status === oldLabel) {
          invoice.status = label;
          invoice.statusDate = new Date().toISOString().slice(0, 10);
          invoice.updatedAt = new Date().toISOString();
        }
      }
    }

    addAudit(data, {
      actor: "AP",
      type: "status_updated",
      message: `Updated invoice status ${oldLabel} to ${label}.`,
    });
  });

  revalidatePath("/");
  revalidatePath("/department");
  revalidatePath("/invoices", "layout");
  revalidatePath("/settings/statuses");
}

export async function deleteInvoiceStatus(formData: FormData) {
  const statusId = value(formData, "statusId");
  const replacementStatusId = value(formData, "replacementStatusId");
  if (!statusId) return;

  await mutateData((data) => {
    const status = data.statuses.find((item) => item.id === statusId);
    if (!status) return;
    const replacement = data.statuses.find(
      (item) => item.id === replacementStatusId && item.id !== statusId,
    );
    const inUseCount = data.invoices.filter(
      (invoice) => invoice.status === status.label,
    ).length;
    const rolesToMove = statusRoles(status);
    const needsReplacement = Boolean(rolesToMove.length > 0 || inUseCount > 0);

    if (needsReplacement && !replacement) {
      addAudit(data, {
        actor: "AP",
        type: "status_delete_blocked",
        message: `Could not delete ${status.label}; choose a replacement status first.`,
      });
      return;
    }

    if (replacement) {
      for (const invoice of data.invoices) {
        if (invoice.status === status.label) {
          invoice.status = replacement.label;
          invoice.statusDate = new Date().toISOString().slice(0, 10);
          invoice.updatedAt = new Date().toISOString();
        }
      }

      if (rolesToMove.length > 0) {
        replacement.systemRoles = Array.from(
          new Set([...statusRoles(replacement), ...rolesToMove]),
        );
        replacement.systemRole = replacement.systemRoles[0];
      }
    }

    data.statuses = data.statuses.filter((item) => item.id !== statusId);
    addAudit(data, {
      actor: "AP",
      type: "status_deleted",
      message: replacement
        ? `Deleted invoice status ${status.label}; moved ${inUseCount} invoices and workflow role to ${replacement.label}.`
        : `Deleted invoice status ${status.label}.`,
    });
  });

  revalidatePath("/");
  revalidatePath("/invoices", "layout");
  revalidatePath("/settings/statuses");
}

export async function addDepartmentDecision(formData: FormData) {
  await requireApUser();
  const label = value(formData, "label");
  if (!label) return;

  await mutateData((data) => {
    const exists = data.departmentDecisions.some(
      (decision) => decision.label.toLowerCase() === label.toLowerCase(),
    );
    if (exists) return;

    data.departmentDecisions.push({
      id: createId("decision"),
      label,
      workflowAction: decisionWorkflowActionValue(formData),
      requireComment: checkbox(formData, "requireComment"),
      requirePoNumber:
        invoiceFieldEnabled(data, "poNumber") && checkbox(formData, "requirePoNumber"),
      active: checkbox(formData, "active"),
    });
    addAudit(data, {
      actor: "AP",
      type: "decision_added",
      message: `Added department decision ${label}.`,
    });
  });

  revalidatePath("/review", "layout");
  revalidatePath("/settings/decisions");
}

export async function updateDepartmentDecision(formData: FormData) {
  await requireApUser();
  const decisionId = value(formData, "decisionId");
  const label = value(formData, "label");
  if (!decisionId || !label) return;

  await mutateData((data) => {
    const decision = data.departmentDecisions.find((item) => item.id === decisionId);
    if (!decision) return;
    const duplicate = data.departmentDecisions.some(
      (item) =>
        item.id !== decisionId && item.label.toLowerCase() === label.toLowerCase(),
    );
    if (duplicate) return;

    const oldLabel = decision.label;
    decision.label = label;
    decision.workflowAction = decisionWorkflowActionValue(formData);
    decision.requireComment = checkbox(formData, "requireComment");
    decision.requirePoNumber =
      invoiceFieldEnabled(data, "poNumber") && checkbox(formData, "requirePoNumber");
    decision.active = checkbox(formData, "active");

    if (oldLabel !== label) {
      for (const invoice of data.invoices) {
        if (invoice.departmentDecision === oldLabel) {
          invoice.departmentDecision = label;
          invoice.updatedAt = new Date().toISOString();
        }
      }
    }

    addAudit(data, {
      actor: "AP",
      type: "decision_updated",
      message: `Updated department decision ${oldLabel} to ${label}.`,
    });
  });

  revalidatePath("/");
  revalidatePath("/department");
  revalidatePath("/invoices", "layout");
  revalidatePath("/review", "layout");
  revalidatePath("/settings/decisions");
}

export async function deleteDepartmentDecision(formData: FormData) {
  await requireApUser();
  const decisionId = value(formData, "decisionId");
  const replacementDecisionId = value(formData, "replacementDecisionId");
  if (!decisionId) return;

  await mutateData((data) => {
    const decision = data.departmentDecisions.find((item) => item.id === decisionId);
    if (!decision) return;
    const replacement = data.departmentDecisions.find(
      (item) => item.id === replacementDecisionId && item.id !== decisionId,
    );
    const inUseCount = data.invoices.filter(
      (invoice) => invoice.departmentDecision === decision.label,
    ).length;

    if (inUseCount > 0 && !replacement) {
      addAudit(data, {
        actor: "AP",
        type: "decision_delete_blocked",
        message: `Could not delete ${decision.label}; choose a replacement decision first.`,
      });
      return;
    }

    if (replacement) {
      for (const invoice of data.invoices) {
        if (invoice.departmentDecision === decision.label) {
          invoice.departmentDecision = replacement.label;
          invoice.updatedAt = new Date().toISOString();
        }
      }
    }

    data.departmentDecisions = data.departmentDecisions.filter(
      (item) => item.id !== decisionId,
    );
    addAudit(data, {
      actor: "AP",
      type: "decision_deleted",
      message: replacement
        ? `Deleted department decision ${decision.label}; moved ${inUseCount} invoices to ${replacement.label}.`
        : `Deleted department decision ${decision.label}.`,
    });
  });

  revalidatePath("/");
  revalidatePath("/department");
  revalidatePath("/invoices", "layout");
  revalidatePath("/review", "layout");
  revalidatePath("/settings/decisions");
}

export async function updateBrandingSettings(formData: FormData) {
  await mutateData((data) => {
    data.branding.appTitle = value(formData, "appTitle") || "Invoice Management";
    data.branding.divisionLabel = value(formData, "divisionLabel") || "AP Division";
    data.branding.fontFamily = fontValue(formData);
    data.branding.accentColor = colorValue(
      formData,
      "accentColor",
      data.branding.accentColor,
    );
    data.branding.accentStrongColor = colorValue(
      formData,
      "accentStrongColor",
      data.branding.accentStrongColor,
    );
    data.branding.backgroundColor = colorValue(
      formData,
      "backgroundColor",
      data.branding.backgroundColor,
    );
    data.branding.panelColor = colorValue(
      formData,
      "panelColor",
      data.branding.panelColor,
    );
    data.branding.panelStrongColor = colorValue(
      formData,
      "panelStrongColor",
      data.branding.panelStrongColor,
    );
    data.branding.textColor = colorValue(formData, "textColor", data.branding.textColor);
    data.branding.mutedColor = colorValue(
      formData,
      "mutedColor",
      data.branding.mutedColor,
    );
    data.branding.lineColor = colorValue(formData, "lineColor", data.branding.lineColor);
    addAudit(data, {
      actor: "AP",
      type: "branding_updated",
      message: "Updated app branding, colors, and font.",
    });
  });

  revalidatePath("/");
  revalidatePath("/department");
  revalidatePath("/login");
  revalidatePath("/review", "layout");
  revalidatePath("/settings", "layout");
}

export async function updateInvoiceFields(formData: FormData) {
  await requireApUser();

  await mutateData((data) => {
    const poRequiredInUse = data.departmentDecisions.some(
      (decision) => decision.requirePoNumber,
    );
    data.invoiceFields = normalizeInvoiceFields(data.invoiceFields).map((field) => {
      const defaultField = DEFAULT_INVOICE_FIELDS.find((item) => item.key === field.key);
      const locked = defaultField?.locked === true;
      const requestedEnabled = formData.get(`enabled:${field.key}`) === "on";
      const enabled =
        locked || (field.key === "poNumber" && poRequiredInUse)
          ? true
          : requestedEnabled;
      return {
        ...field,
        enabled,
        requiredForAp:
          field.locked || formData.get(`requiredForAp:${field.key}`) === "on",
      };
    });

    addAudit(data, {
      actor: "AP",
      type: "invoice_fields_updated",
      message: "Updated invoice field settings.",
    });
  });

  revalidatePath("/");
  revalidatePath("/department");
  revalidatePath("/invoices", "layout");
  revalidatePath("/review", "layout");
  revalidatePath("/settings/invoice-fields");
  revalidatePath("/settings/decisions");
}

export async function uploadBrandingLogo(formData: FormData) {
  const file = formData.get("logoFile");
  if (!(file instanceof File) || file.size === 0) return;
  if (!file.type.startsWith("image/")) return;

  const extension = path.extname(file.name) || ".bin";
  const storedName = `brand-logo-${Date.now()}${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const logo = await saveBrandingLogo({
    originalName: file.name,
    storedName,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    uploadedAt: new Date().toISOString(),
    bytes,
  });

  let oldLogo: BrandingLogo | null = null;
  await mutateData((data) => {
    oldLogo = data.branding.logo;
    data.branding.logo = logo;
    addAudit(data, {
      actor: "AP",
      type: "branding_logo_uploaded",
      message: `Uploaded branding logo ${file.name}.`,
    });
  });

  if (oldLogo) {
    await deleteStoredBrandingLogo(oldLogo);
  }

  revalidatePath("/");
  revalidatePath("/department");
  revalidatePath("/login");
  revalidatePath("/review", "layout");
  revalidatePath("/settings", "layout");
}

export async function removeBrandingLogo() {
  let oldLogo: BrandingLogo | null = null;
  await mutateData((data) => {
    oldLogo = data.branding.logo;
    data.branding.logo = null;
    addAudit(data, {
      actor: "AP",
      type: "branding_logo_removed",
      message: "Removed branding logo.",
    });
  });

  if (oldLogo) {
    await deleteStoredBrandingLogo(oldLogo);
  }

  revalidatePath("/");
  revalidatePath("/department");
  revalidatePath("/login");
  revalidatePath("/review", "layout");
  revalidatePath("/settings", "layout");
}

export async function deleteDepartment(formData: FormData) {
  const departmentId = value(formData, "departmentId");
  if (!departmentId) return;

  await mutateData((data) => {
    const inUse =
      data.invoices.some((invoice) => invoice.departmentId === departmentId) ||
      data.purchaseOrders.some((po) => po.departmentId === departmentId) ||
      data.users.some((user) => user.departmentId === departmentId);
    const department = data.departments.find((item) => item.id === departmentId);
    if (!department) return;
    if (inUse) {
      addAudit(data, {
        actor: "AP",
        type: "department_delete_blocked",
        message: `Could not delete ${department.name}; it is used by invoices, POs, or users.`,
      });
      return;
    }
    data.departments = data.departments.filter((item) => item.id !== departmentId);
    addAudit(data, {
      actor: "AP",
      type: "department_deleted",
      message: `Deleted department setup for ${department.name}.`,
    });
  });

  revalidatePath("/");
  revalidatePath("/settings");
}

export async function completeInvoice(formData: FormData) {
  const invoiceId = value(formData, "invoiceId");
  await mutateData((data) => {
    const invoice = getInvoice(data, invoiceId);
    if (!invoice) return;
    setInvoiceStatus(invoice, statusLabelForRole(data, "completed"));
    invoice.dateApproved = invoice.dateApproved || new Date().toISOString().slice(0, 10);
    invoice.paymentProcessed = false;
    invoice.updatedAt = new Date().toISOString();
    addAudit(data, {
      invoiceId,
      actor: "AP",
      type: "completed",
      message: "AP marked the invoice approved/completed.",
    });
  });

  revalidatePath("/");
  revalidatePath("/department");
  revalidatePath("/invoices", "layout");
  revalidatePath("/reports");
  revalidatePath("/files/payment-file");
  revalidatePath(`/review/${invoiceId}`);
}

export async function updateInvoicePaymentProcessed(formData: FormData) {
  await requireApUser();
  const invoiceId = value(formData, "invoiceId");
  const paymentProcessed = checkbox(formData, "paymentProcessed");
  if (!invoiceId) return;

  await mutateData((data) => {
    const invoice = getInvoice(data, invoiceId);
    if (!invoice) return;
    invoice.paymentProcessed = paymentProcessed;
    invoice.updatedAt = new Date().toISOString();
    addAudit(data, {
      invoiceId,
      actor: "AP",
      type: "payment_processed_updated",
      message: paymentProcessed
        ? "AP marked payment processed."
        : "AP marked payment not processed.",
    });
  });

  revalidatePath("/");
  revalidatePath("/invoices", "layout");
  revalidatePath(`/review/${invoiceId}`);
}

export async function deleteInvoice(formData: FormData) {
  await requireApUser();
  const invoiceId = value(formData, "invoiceId");
  const confirmed = value(formData, "confirmDelete") === "yes";
  if (!invoiceId || !confirmed) return;

  let fileToDelete = null as ReturnType<typeof getInvoiceFile> | null;

  await mutateData((data) => {
    const invoice = getInvoice(data, invoiceId);
    if (!invoice) return;
    fileToDelete = getInvoiceFile(data, invoice.fileId) || null;

    data.invoices = data.invoices.filter((item) => item.id !== invoiceId);
    data.invoiceFiles = data.invoiceFiles.filter(
      (file) => file.invoiceId !== invoiceId && file.id !== invoice.fileId,
    );
    data.auditEvents = data.auditEvents.filter(
      (event) => event.invoiceId !== invoiceId,
    );

    addAudit(data, {
      actor: "AP",
      type: "invoice_deleted",
      message: `Deleted invoice ${invoice.invoiceNumber || invoice.id} and related database records.`,
    });
  });

  if (fileToDelete) {
    await deleteStoredInvoiceFile(fileToDelete);
  }

  revalidatePath("/");
  revalidatePath("/department");
  revalidatePath("/invoices", "layout");
  revalidatePath("/reports");
  revalidatePath("/files/payment-file");
  revalidatePath(`/review/${invoiceId}`);
}

export async function submitDepartmentDecision(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "DEPARTMENT") redirect("/");
  const invoiceId = value(formData, "invoiceId");
  const decision = value(formData, "decision");
  const comment = value(formData, "comment");
  const submittedPoNumber = value(formData, "poNumber");
  const currentData = await readData();
  const currentInvoice = getInvoice(currentData, invoiceId);
  if (!currentInvoice || !canAccessInvoice(user, currentInvoice)) {
    redirect("/login");
  }
  const decisionDefinition = currentData.departmentDecisions.find(
    (item) => item.active && item.label === decision,
  );

  if (!decisionDefinition) {
    return;
  }

  if (decisionDefinition.requireComment && !comment) {
    redirect(`/review/${invoiceId}?error=comment-required&decision=${encodeURIComponent(decision)}`);
  }

  const currentPoNumber = currentInvoice.poNumber.trim();
  const poEnabled = invoiceFieldEnabled(currentData, "poNumber");
  const poNumberForDecision = currentPoNumber || submittedPoNumber;
  if (poEnabled && decisionDefinition.requirePoNumber && !poNumberForDecision) {
    redirect(`/review/${invoiceId}?error=po-required&decision=${encodeURIComponent(decision)}`);
  }

  await mutateData((data) => {
    const invoice = getInvoice(data, invoiceId);
    if (!invoice) return;

    const now = new Date().toISOString();
    const existingPoNumber = invoice.poNumber.trim();
    if (
      invoiceFieldEnabled(data, "poNumber") &&
      decisionDefinition.requirePoNumber &&
      !existingPoNumber &&
      submittedPoNumber
    ) {
      invoice.poNumber = submittedPoNumber;
      addAudit(data, {
        invoiceId,
        actor: "Department Reviewer",
        type: "po_number_added",
        message: `Department reviewer added PO number ${submittedPoNumber} for PO-required decision ${decision}.`,
      });
    }
    invoice.departmentDecision = decision;
    invoice.updatedAt = now;

    if (comment) {
      invoice.comments.unshift({
        id: createId("comment"),
        author: "Department Reviewer",
        body: comment,
        createdAt: now,
      });
      addAudit(data, {
        invoiceId,
        actor: "Department Reviewer",
        type: "comment_added",
        message: comment,
      });
    }

    if (decisionDefinition.workflowAction === "apRework") {
      setInvoiceStatus(invoice, statusLabelForRole(data, "apRework"), new Date(now));
      invoice.dateApproved = "";
      addAudit(data, {
        invoiceId,
        actor: "Department Reviewer",
        type: "rework_returned",
        message: `Department returned the invoice to AP rework: ${decision}.`,
      });
      return;
    }

    if (decisionDefinition.workflowAction === "reject") {
      setInvoiceStatus(invoice, statusLabelForRole(data, "rejected"), new Date(now));
    } else if (decisionDefinition.workflowAction === "hold") {
      setInvoiceStatus(invoice, statusLabelForRole(data, "hold"), new Date(now));
    } else {
      setInvoiceStatus(invoice, statusLabelForRole(data, "completed"), new Date(now));
      invoice.paymentProcessed = false;
      invoice.dateApproved = now.slice(0, 10);
    }

    addAudit(data, {
      invoiceId,
      actor: "Department Reviewer",
      type: "department_decision",
      message: `Department submitted decision: ${decision}.`,
    });
  });

  revalidatePath("/");
  revalidatePath("/department");
  revalidatePath("/invoices", "layout");
  revalidatePath("/reports");
  revalidatePath("/files/payment-file");
  revalidatePath(`/review/${invoiceId}`);
}
