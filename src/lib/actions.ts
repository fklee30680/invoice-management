"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AP_USER_ID, DEPARTMENT_DECISIONS } from "./constants";
import { sendDepartmentNotification } from "./email";
import {
  deleteStoredBrandingLogo,
  deleteStoredInvoiceFile,
  saveBrandingLogo,
  saveInvoiceFile,
  stageFileForProcessing,
} from "./file-storage";
import { extractInvoiceMetadata } from "./ocr";
import { parsePoUpload } from "./po-parser";
import {
  addAudit,
  addInvoice,
  addInvoiceFile,
  createId,
  findPurchaseOrder,
  getInvoice,
  getInvoiceFile,
  mutateData,
  upsertDepartment,
  upsertPurchaseOrder,
} from "./store";
import type { BrandingLogo, DepartmentDecision, Invoice } from "./types";

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

function baseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function fillTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, key: string) => {
    return values[key] || "";
  });
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
        const departmentId = purchaseOrder?.departmentId || "";
        const department = data.departments.find((item) => item.id === departmentId);
        const canNotify = Boolean(purchaseOrder && department?.email);
        const status = canNotify ? "Routed" : "Needs AP Review";

        addInvoiceFile(data, invoiceFile);

        const invoice: Invoice = {
          id: invoiceId,
          vendorName: extracted.vendorName || purchaseOrder?.vendorName || "",
          invoiceNumber: extracted.invoiceNumber,
          invoiceDate: extracted.invoiceDate,
          amount: extracted.amount,
          poNumber: extracted.poNumber,
          dateReceived: now.slice(0, 10),
          dateApproved: "",
          status,
          departmentId,
          departmentDecision: "",
          comments: [],
          fileId,
          notificationSentAt: "",
          ocrSummary: extracted.summary,
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
      });

      const data = await mutateData((current) => current);
      const invoice = getInvoice(data, invoiceId);
      if (invoice?.status === "Routed") {
        await notifyDepartment(invoice);
      }
    }
  } catch {
    redirect("/?error=file-storage");
  }

  revalidatePath("/");
}

export async function updateAndRouteInvoice(formData: FormData) {
  const invoiceId = value(formData, "invoiceId");
  let updatedInvoice: Invoice | undefined;

  await mutateData((data) => {
    const invoice = getInvoice(data, invoiceId);
    if (!invoice) return;

    invoice.vendorName = value(formData, "vendorName");
    invoice.invoiceNumber = value(formData, "invoiceNumber");
    invoice.invoiceDate = value(formData, "invoiceDate");
    invoice.amount = value(formData, "amount");
    invoice.poNumber = value(formData, "poNumber");
    invoice.dateReceived = value(formData, "dateReceived");
    invoice.departmentId = value(formData, "departmentId");
    invoice.status = invoice.departmentId ? "Routed" : "Needs AP Review";
    invoice.updatedAt = new Date().toISOString();
    updatedInvoice = invoice;

    addAudit(data, {
      invoiceId,
      actor: "AP",
      type: invoice.status === "Routed" ? "rerouted" : "ap_edit",
      message:
        invoice.status === "Routed"
          ? "AP updated metadata and routed the invoice."
          : "AP updated metadata; department still required.",
    });
  });

  if (updatedInvoice?.status === "Routed") {
    await notifyDepartment(updatedInvoice);
  }

  revalidatePath("/");
  revalidatePath(`/review/${invoiceId}`);
}

export async function addDepartment(formData: FormData) {
  const name = value(formData, "name");
  const email = value(formData, "email").toLowerCase();
  if (!name || !email) return;

  await mutateData((data) => {
    const department = upsertDepartment(data, name, email);
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
    addAudit(data, {
      actor: "AP",
      type: "department_updated",
      message: `Updated department setup for ${department.name}.`,
    });
  });

  revalidatePath("/");
  revalidatePath("/settings");
}

export async function updateNotificationTemplate(formData: FormData) {
  const departmentSubject = value(formData, "departmentSubject");
  const departmentBody = value(formData, "departmentBody");
  if (!departmentSubject || !departmentBody) return;

  await mutateData((data) => {
    data.notificationTemplate.departmentSubject = departmentSubject;
    data.notificationTemplate.departmentBody = departmentBody;
    addAudit(data, {
      actor: "AP",
      type: "notification_template_updated",
      message: "Updated department notification subject and body template.",
    });
  });

  revalidatePath("/");
  revalidatePath("/settings");
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
    invoice.status = "Approved/Completed";
    invoice.dateApproved = invoice.dateApproved || new Date().toISOString().slice(0, 10);
    invoice.updatedAt = new Date().toISOString();
    addAudit(data, {
      invoiceId,
      actor: "AP",
      type: "completed",
      message: "AP marked the invoice approved/completed.",
    });
  });

  revalidatePath("/");
  revalidatePath(`/review/${invoiceId}`);
}

export async function deleteInvoice(formData: FormData) {
  const invoiceId = value(formData, "invoiceId");
  if (!invoiceId) return;

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
  revalidatePath(`/review/${invoiceId}`);
}

export async function submitDepartmentDecision(formData: FormData) {
  const invoiceId = value(formData, "invoiceId");
  const decision = value(formData, "decision") as DepartmentDecision;
  const comment = value(formData, "comment");

  if (!DEPARTMENT_DECISIONS.includes(decision)) {
    return;
  }

  if (decision === "Not our Department Invoice" && !comment) {
    redirect(`/review/${invoiceId}?error=comment-required`);
  }

  await mutateData((data) => {
    const invoice = getInvoice(data, invoiceId);
    if (!invoice) return;

    const now = new Date().toISOString();
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

    if (decision === "Not our Department Invoice") {
      invoice.status = "Needs AP Rework";
      invoice.dateApproved = "";
      addAudit(data, {
        invoiceId,
        actor: "Department Reviewer",
        type: "rework_returned",
        message: "Department returned the invoice to AP rework as not their department.",
      });
      return;
    }

    if (decision === "Reject") {
      invoice.status = "Rejected";
    } else if (decision === "Hold") {
      invoice.status = "Hold";
    } else {
      invoice.status = "Approved/Completed";
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
  revalidatePath(`/review/${invoiceId}`);
}

export async function cloneSampleInvoice() {
  const source = path.join(process.cwd(), "public", "file.svg");
  const invoiceId = createId("invoice");
  const fileId = createId("file");
  const storedName = `${invoiceId}.svg`;
  const bytes = await readFile(source);
  const now = new Date().toISOString();
  const invoiceFile = await saveInvoiceFile({
    id: fileId,
    invoiceId,
    originalName: "Northstar-Invoice-PO-10045.svg",
    storedName,
    mimeType: "image/svg+xml",
    size: bytes.length,
    uploadedAt: now,
    bytes,
  });

  await mutateData((data) => {
    const po = data.purchaseOrders[0];
    addInvoiceFile(data, invoiceFile);
    addInvoice(data, {
      id: invoiceId,
      vendorName: po?.vendorName || "Northstar Supply",
      invoiceNumber: "INV-10045",
      invoiceDate: now.slice(0, 10),
      amount: "1280.00",
      poNumber: po?.poNumber || "PO-10045",
      dateReceived: now.slice(0, 10),
      dateApproved: "",
      status: "Routed",
      departmentId: po?.departmentId || "",
      departmentDecision: "",
      comments: [],
      fileId,
      notificationSentAt: now,
      ocrSummary: "Sample invoice created for workflow testing.",
      createdAt: now,
      updatedAt: now,
    });
    addAudit(data, {
      invoiceId,
      actor: AP_USER_ID,
      type: "sample_created",
      message: "Created a sample routed invoice for testing.",
    });
  });

  revalidatePath("/");
}
