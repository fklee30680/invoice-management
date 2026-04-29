import { readStoredBrandingLogo } from "./file-storage";
import { statusesForCompleted } from "./status-config";
import type { AppData, BrandingLogo, Invoice } from "./types";
import { currencyDisplay, formatDate } from "./utils";

export type ReportType = "total-activity" | "department";
export type ReportDateField = "dateUploaded" | "invoiceDate" | "dateApproved";

export type ReportFilters = {
  reportType: ReportType;
  dateField: ReportDateField;
  fromDate: string;
  toDate: string;
  vendor: string;
  departmentId: string;
};

export type ReportMetrics = {
  label: string;
  totalInvoices: number;
  totalDollars: number;
  approvedInvoices: number;
  averageApprovalDays: number | null;
  medianApprovalDays: number | null;
};

const reportTypes: ReportType[] = ["total-activity", "department"];
const dateFields: ReportDateField[] = ["dateUploaded", "invoiceDate", "dateApproved"];

export function parseReportFilters(
  query: Record<string, string | string[] | undefined>,
): ReportFilters {
  const reportType = one(query.reportType);
  const dateField = one(query.dateField);
  return {
    reportType: reportTypes.includes(reportType as ReportType)
      ? (reportType as ReportType)
      : "total-activity",
    dateField: dateFields.includes(dateField as ReportDateField)
      ? (dateField as ReportDateField)
      : "dateUploaded",
    fromDate: one(query.fromDate),
    toDate: one(query.toDate),
    vendor: one(query.vendor),
    departmentId: one(query.departmentId),
  };
}

export function reportTitle(type: ReportType) {
  return type === "department" ? "Department Report" : "Total Activity Report";
}

export function dateFieldLabel(field: ReportDateField) {
  if (field === "invoiceDate") return "Invoice Date";
  if (field === "dateApproved") return "Date Approved";
  return "Upload Date";
}

export function reportFileName(filters: ReportFilters) {
  const base =
    filters.reportType === "department" ? "department-report" : "total-activity-report";
  return `${base}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || "";
}

function amountValue(value: string) {
  const amount = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

function dateValue(invoice: Invoice, field: ReportDateField) {
  return invoice[field] || "";
}

function approvalDays(invoice: Invoice) {
  if (!invoice.dateUploaded || !invoice.dateApproved) return null;
  const start = new Date(invoice.dateUploaded);
  const end = new Date(invoice.dateApproved);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function filteredReportInvoices(data: AppData, filters: ReportFilters) {
  const from = filters.fromDate;
  const to = filters.toDate;
  const vendor = filters.vendor.trim().toLowerCase();

  return data.invoices.filter((invoice) => {
    const selectedDate = dateValue(invoice, filters.dateField);
    const matchesFrom = !from || (selectedDate && selectedDate >= from);
    const matchesTo = !to || (selectedDate && selectedDate <= to);
    const matchesVendor =
      !vendor || invoice.vendorName.toLowerCase().includes(vendor);
    const matchesDepartment =
      !filters.departmentId || invoice.departmentId === filters.departmentId;

    return matchesFrom && matchesTo && matchesVendor && matchesDepartment;
  });
}

export function buildReportMetrics(
  data: AppData,
  invoices: Invoice[],
  filters: ReportFilters,
): ReportMetrics[] {
  if (filters.reportType === "department") {
    const departmentIds = Array.from(
      new Set(invoices.map((invoice) => invoice.departmentId || "")),
    ).sort((left, right) =>
      departmentName(data, left).localeCompare(departmentName(data, right)),
    );

    return departmentIds.map((departmentId) =>
      metricForInvoices(
        departmentName(data, departmentId),
        invoices.filter((invoice) => (invoice.departmentId || "") === departmentId),
        data,
      ),
    );
  }

  return [metricForInvoices("All selected invoices", invoices, data)];
}

function metricForInvoices(label: string, invoices: Invoice[], data: AppData) {
  const completedStatuses = statusesForCompleted(data);
  const approved = invoices.filter((invoice) =>
    completedStatuses.includes(invoice.status),
  );
  const approvalDurations = approved
    .map(approvalDays)
    .filter((value): value is number => value !== null);

  return {
    label,
    totalInvoices: invoices.length,
    totalDollars: invoices.reduce(
      (sum, invoice) => sum + amountValue(invoice.amount || ""),
      0,
    ),
    approvedInvoices: approved.length,
    averageApprovalDays: average(approvalDurations),
    medianApprovalDays: median(approvalDurations),
  };
}

function departmentName(data: AppData, departmentId: string) {
  if (!departmentId) return "Unassigned";
  return data.departments.find((department) => department.id === departmentId)?.name || "Unassigned";
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function hexToRgb(hex: string) {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "0f766e";
  return {
    r: parseInt(normalized.slice(0, 2), 16) / 255,
    g: parseInt(normalized.slice(2, 4), 16) / 255,
    b: parseInt(normalized.slice(4, 6), 16) / 255,
  };
}

function money(value: number) {
  return currencyDisplay(String(value));
}

function days(value: number | null) {
  return value === null ? "N/A" : `${value.toFixed(value % 1 ? 1 : 0)} days`;
}

function parseJpegSize(bytes: Buffer) {
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: bytes.readUInt16BE(offset + 5),
        width: bytes.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}

async function logoImage(
  logo: BrandingLogo | null,
): Promise<{ bytes: Buffer; width: number; height: number } | null> {
  if (!logo || !/jpe?g/i.test(logo.mimeType)) return null;
  const stored = await readStoredBrandingLogo(logo);
  if (!stored || !("body" in stored) || !stored.body) return null;
  const body = Buffer.from(stored.body);
  const size = parseJpegSize(body);
  if (!size) return null;
  return { bytes: body, ...size };
}

export async function buildReportPdf({
  data,
  filters,
  generatedAt,
  invoices,
  metrics,
}: {
  data: AppData;
  filters: ReportFilters;
  generatedAt: Date;
  invoices: Invoice[];
  metrics: ReportMetrics[];
}) {
  const logo = await logoImage(data.branding.logo);
  const accent = hexToRgb(data.branding.accentColor);
  const line = hexToRgb(data.branding.lineColor);
  const objects: string[] = [];
  const pages: number[] = [];
  let content = "";
  let y = 760;

  function addObject(value: string | Buffer) {
    objects.push(value.toString("binary"));
    return objects.length;
  }

  const fontRegular = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBold = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const imageObject = logo
    ? addObject(
        [
          `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height}`,
          "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode",
          `/Length ${logo.bytes.length} >>`,
          "stream",
          logo.bytes.toString("binary"),
          "endstream",
        ].join("\n"),
      )
    : null;

  function text(value: string, x: number, size = 10, bold = false) {
    content += `BT /F${bold ? "B" : "R"} ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET\n`;
  }

  function lineText(label: string, value: string, x: number) {
    text(label, x, 9, true);
    y -= 13;
    text(value, x, 11);
  }

  function rect(x: number, top: number, width: number, height: number, rgb = line) {
    content += `${rgb.r.toFixed(3)} ${rgb.g.toFixed(3)} ${rgb.b.toFixed(3)} rg ${x} ${top - height} ${width} ${height} re f\n`;
  }

  function startPage() {
    content = "";
    y = 760;
    rect(40, 792, 532, 56, accent);
    content += "1 1 1 rg\n";
    if (imageObject) {
      const width = 72;
      const height = Math.min(36, (logo!.height / logo!.width) * width);
      content += `q ${width} 0 0 ${height} 48 ${748} cm /Logo Do Q\n`;
      text(data.branding.appTitle, 130, 18, true);
    } else {
      text(data.branding.appTitle, 52, 18, true);
    }
    y -= 24;
    text(reportTitle(filters.reportType), imageObject ? 130 : 52, 12);
    content += "0 0 0 rg\n";
    y = 704;
  }

  function endPage() {
    const contentObject = addObject(`<< /Length ${Buffer.byteLength(content, "binary")} >>\nstream\n${content}endstream`);
    const resources = imageObject
      ? `<< /Font << /FR ${fontRegular} 0 R /FB ${fontBold} 0 R >> /XObject << /Logo ${imageObject} 0 R >> >>`
      : `<< /Font << /FR ${fontRegular} 0 R /FB ${fontBold} 0 R >> >>`;
    const pageObject = addObject(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 612 792] /Resources ${resources} /Contents ${contentObject} 0 R >>`,
    );
    pages.push(pageObject);
  }

  function ensureSpace(required: number) {
    if (y >= required) return;
    endPage();
    startPage();
  }

  startPage();
  text(`Generated: ${formatDate(generatedAt.toISOString())}`, 40, 10);
  y -= 26;
  lineText("Date Field", dateFieldLabel(filters.dateField), 40);
  y += 13;
  lineText("Date Range", `${filters.fromDate || "Any"} to ${filters.toDate || "Any"}`, 180);
  y += 13;
  lineText("Vendor Filter", filters.vendor || "All vendors", 340);
  y -= 28;
  lineText(
    "Department Filter",
    filters.departmentId ? departmentName(data, filters.departmentId) : "All departments",
    40,
  );
  y -= 34;

  text("Summary", 40, 14, true);
  y -= 14;
  rect(40, y + 8, 532, 1);
  y -= 18;

  for (const metric of metrics) {
    ensureSpace(130);
    text(metric.label, 40, 12, true);
    y -= 20;
    const rows = [
      ["Total invoices received", String(metric.totalInvoices)],
      ["Total invoice dollars", money(metric.totalDollars)],
      ["Invoices approved/completed", String(metric.approvedInvoices)],
      ["Average time to approval", days(metric.averageApprovalDays)],
      ["Median approval time", days(metric.medianApprovalDays)],
    ];
    for (const [label, value] of rows) {
      text(label, 56, 10);
      text(value, 360, 10, true);
      y -= 16;
    }
    y -= 12;
  }

  ensureSpace(180);
  text("Invoice Detail", 40, 14, true);
  y -= 18;
  rect(40, y + 8, 532, 20, accent);
  content += "1 1 1 rg\n";
  text("Vendor", 48, 9, true);
  text("Invoice", 190, 9, true);
  text("Dept", 275, 9, true);
  text("Amount", 382, 9, true);
  text("Uploaded", 462, 9, true);
  content += "0 0 0 rg\n";
  y -= 18;

  for (const invoice of invoices.slice(0, 150)) {
    ensureSpace(70);
    text((invoice.vendorName || "Unknown").slice(0, 26), 48, 8);
    text((invoice.invoiceNumber || "Not set").slice(0, 16), 190, 8);
    text(departmentName(data, invoice.departmentId).slice(0, 18), 275, 8);
    text(currencyDisplay(invoice.amount), 382, 8);
    text(formatDate(invoice.dateUploaded), 462, 8);
    y -= 14;
  }
  if (invoices.length > 150) {
    y -= 8;
    text(`Detail limited to first 150 invoices of ${invoices.length}.`, 40, 9, true);
  }
  endPage();

  const pagesObject = objects.length + 1;
  for (const pageObject of pages) {
    objects[pageObject - 1] = objects[pageObject - 1].replace(
      "/Parent 0 0 R",
      `/Parent ${pagesObject} 0 R`,
    );
  }
  addObject(
    `<< /Type /Pages /Kids [${pages.map((page) => `${page} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );
  const catalogObject = addObject(`<< /Type /Catalog /Pages ${pagesObject} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObject} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "binary");
}
