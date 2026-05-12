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

function reportDate(value: string) {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(Number(year), Number(month) - 1, Number(day)));
  }
  return formatDate(value);
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
  const accentStrong = hexToRgb(data.branding.accentStrongColor);
  const line = hexToRgb(data.branding.lineColor);
  const textColor = hexToRgb(data.branding.textColor);
  const muted = hexToRgb(data.branding.mutedColor);
  const white = { r: 1, g: 1, b: 1 };
  const alternate = { r: 0.975, g: 0.98, b: 0.985 };
  const objects: string[] = [];
  const pages: number[] = [];
  let content = "";
  let y = 680;

  const PAGE_WIDTH = 612;
  const PAGE_HEIGHT = 792;
  const MARGIN_X = 40;
  const CONTENT_WIDTH = 532;
  const BOTTOM_MARGIN = 52;
  const HEADER_TOP = 760;
  const HEADER_BOTTOM = 692;
  const FOOTER_Y = 28;

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

  function color(rgb: { r: number; g: number; b: number }) {
    return `${rgb.r.toFixed(3)} ${rgb.g.toFixed(3)} ${rgb.b.toFixed(3)}`;
  }

  function drawText(
    value: string,
    x: number,
    baseline: number,
    {
      size = 10,
      bold = false,
      rgb = textColor,
    }: { size?: number; bold?: boolean; rgb?: { r: number; g: number; b: number } } = {},
  ) {
    content += `${color(rgb)} rg BT /F${bold ? "B" : "R"} ${size} Tf ${x} ${baseline} Td (${escapePdfText(value)}) Tj ET\n`;
  }

  function drawRect(
    x: number,
    top: number,
    width: number,
    height: number,
    {
      fill,
      stroke,
    }: {
      fill?: { r: number; g: number; b: number };
      stroke?: { r: number; g: number; b: number };
    } = {},
  ) {
    const bottom = top - height;
    if (fill) {
      content += `${color(fill)} rg ${x} ${bottom} ${width} ${height} re f\n`;
    }
    if (stroke) {
      content += `${color(stroke)} RG ${x} ${bottom} ${width} ${height} re S\n`;
    }
  }

  function drawLine(x1: number, lineY: number, x2: number, rgb = line, width = 1) {
    content += `${color(rgb)} RG ${width} w ${x1} ${lineY} m ${x2} ${lineY} l S\n`;
  }

  function truncate(value: string, maxLength: number) {
    return value.length > maxLength ? `${value.slice(0, Math.max(0, maxLength - 1))}...` : value;
  }

  function rightText(
    value: string,
    rightX: number,
    baseline: number,
    options: { size?: number; bold?: boolean; rgb?: { r: number; g: number; b: number } } = {},
  ) {
    const size = options.size || 10;
    drawText(value, rightX - value.length * size * 0.48, baseline, options);
  }

  function dateRangeLabel() {
    if (filters.fromDate && filters.toDate) {
      return `${reportDate(filters.fromDate)} to ${reportDate(filters.toDate)}`;
    }
    if (filters.fromDate) return `From ${reportDate(filters.fromDate)}`;
    if (filters.toDate) return `Through ${reportDate(filters.toDate)}`;
    return "Any";
  }

  function drawFooter(pageNumber: number) {
    drawLine(MARGIN_X, 42, MARGIN_X + CONTENT_WIDTH, line, 0.5);
    drawText(`Generated ${reportDate(generatedAt.toISOString())}`, MARGIN_X, FOOTER_Y, {
      size: 8,
      rgb: muted,
    });
    rightText(`Page ${pageNumber}`, MARGIN_X + CONTENT_WIDTH, FOOTER_Y, {
      size: 8,
      rgb: muted,
    });
  }

  function startPage(compact = false) {
    content = "";
    y = compact ? 688 : 672;

    drawRect(0, PAGE_HEIGHT, PAGE_WIDTH, PAGE_HEIGHT, { fill: white });
    if (imageObject) {
      const logoWidth = Math.min(90, logo!.width);
      const logoHeight = Math.min(45, (logo!.height / logo!.width) * logoWidth);
      content += `q ${logoWidth} 0 0 ${logoHeight} ${MARGIN_X} ${HEADER_TOP - logoHeight} cm /Logo Do Q\n`;
      drawText(data.branding.appTitle, MARGIN_X + 110, HEADER_TOP - 7, {
        size: compact ? 14 : 16,
        bold: true,
      });
      drawText(reportTitle(filters.reportType), MARGIN_X + 110, HEADER_TOP - 26, {
        size: compact ? 10 : 12,
        rgb: muted,
      });
    } else {
      drawText(data.branding.appTitle, MARGIN_X, HEADER_TOP - 7, {
        size: compact ? 14 : 17,
        bold: true,
      });
      drawText(reportTitle(filters.reportType), MARGIN_X, HEADER_TOP - 27, {
        size: compact ? 10 : 12,
        rgb: muted,
      });
    }
    rightText(reportDate(generatedAt.toISOString()), MARGIN_X + CONTENT_WIDTH, HEADER_TOP - 7, {
      size: 9,
      bold: true,
      rgb: muted,
    });
    drawText("Generated", MARGIN_X + CONTENT_WIDTH - 70, HEADER_TOP - 24, {
      size: 8,
      rgb: muted,
    });
    drawLine(MARGIN_X, HEADER_BOTTOM, MARGIN_X + CONTENT_WIDTH, accent, 3);
    drawLine(MARGIN_X, HEADER_BOTTOM - 5, MARGIN_X + CONTENT_WIDTH, line, 0.5);
  }

  function endPage() {
    drawFooter(pages.length + 1);
    const contentObject = addObject(`<< /Length ${Buffer.byteLength(content, "binary")} >>\nstream\n${content}endstream`);
    const resources = imageObject
      ? `<< /Font << /FR ${fontRegular} 0 R /FB ${fontBold} 0 R >> /XObject << /Logo ${imageObject} 0 R >> >>`
      : `<< /Font << /FR ${fontRegular} 0 R /FB ${fontBold} 0 R >> >>`;
    const pageObject = addObject(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 612 792] /Resources ${resources} /Contents ${contentObject} 0 R >>`,
    );
    pages.push(pageObject);
  }

  function ensureSpace(requiredHeight: number) {
    if (y - requiredHeight >= BOTTOM_MARGIN) return;
    endPage();
    startPage(true);
  }

  startPage();

  function sectionTitle(title: string) {
    ensureSpace(30);
    drawText(title, MARGIN_X, y, { size: 14, bold: true });
    drawLine(MARGIN_X, y - 8, MARGIN_X + CONTENT_WIDTH, accent, 1.5);
    y -= 26;
  }

  function keyValueCard(label: string, value: string, x: number, top: number, width: number) {
    drawRect(x, top, width, 44, { fill: white, stroke: line });
    drawText(label.toUpperCase(), x + 10, top - 15, { size: 7.5, bold: true, rgb: muted });
    drawText(truncate(value, Math.floor(width / 5.5)), x + 10, top - 31, {
      size: 10,
      bold: true,
    });
  }

  sectionTitle("Report Filters");
  const filterCardWidth = (CONTENT_WIDTH - 24) / 4;
  const filterTop = y;
  const filterValues = [
    ["Date Field", dateFieldLabel(filters.dateField)],
    ["Date Range", dateRangeLabel()],
    ["Vendor", filters.vendor || "All vendors"],
    [
      "Department",
      filters.departmentId ? departmentName(data, filters.departmentId) : "All departments",
    ],
  ];
  filterValues.forEach(([label, value], index) => {
    keyValueCard(label, value, MARGIN_X + index * (filterCardWidth + 8), filterTop, filterCardWidth);
  });
  y -= 64;

  function metricCard(label: string, value: string, x: number, top: number, width: number) {
    drawRect(x, top, width, 58, { fill: white, stroke: line });
    drawRect(x, top, width, 4, { fill: accent });
    drawText(label.toUpperCase(), x + 10, top - 19, { size: 7.5, bold: true, rgb: muted });
    drawText(truncate(value, Math.floor(width / 7)), x + 10, top - 40, {
      size: value.length > 14 ? 12 : 15,
      bold: true,
    });
  }

  sectionTitle("Summary");
  for (const metric of metrics) {
    ensureSpace(110);
    if (metrics.length > 1 || metric.label !== "All selected invoices") {
      drawText(metric.label, MARGIN_X, y, { size: 11, bold: true });
      y -= 16;
    }
    const cards = [
      ["Total Invoices", String(metric.totalInvoices)],
      ["Total Dollars", money(metric.totalDollars)],
      ["Approved", String(metric.approvedInvoices)],
      ["Avg Approval", days(metric.averageApprovalDays)],
      ["Median Approval", days(metric.medianApprovalDays)],
    ];
    const cardGap = 8;
    const cardWidth = (CONTENT_WIDTH - cardGap * 4) / 5;
    const top = y;
    cards.forEach(([label, value], index) => {
      metricCard(label, value, MARGIN_X + index * (cardWidth + cardGap), top, cardWidth);
    });
    y -= 78;
  }

  function drawTableHeader() {
    drawRect(MARGIN_X, y, CONTENT_WIDTH, 24, { fill: accentStrong });
    drawText("Vendor", 48, y - 16, { size: 8, bold: true, rgb: white });
    drawText("Invoice #", 218, y - 16, { size: 8, bold: true, rgb: white });
    drawText("Department", 308, y - 16, { size: 8, bold: true, rgb: white });
    rightText("Amount", 478, y - 16, { size: 8, bold: true, rgb: white });
    drawText("Uploaded", 492, y - 16, { size: 8, bold: true, rgb: white });
    y -= 24;
  }

  sectionTitle("Invoice Detail");
  if (invoices.length === 0) {
    drawRect(MARGIN_X, y, CONTENT_WIDTH, 48, { fill: white, stroke: line });
    drawText("No invoices match the selected report filters.", MARGIN_X + 142, y - 28, {
      size: 10,
      rgb: muted,
    });
    y -= 60;
  } else {
    drawTableHeader();
    const detailInvoices = invoices.slice(0, 150);
    detailInvoices.forEach((invoice, index) => {
      if (y - 22 < BOTTOM_MARGIN) {
        endPage();
        startPage(true);
        drawTableHeader();
      }
      if (index % 2 === 1) {
        drawRect(MARGIN_X, y, CONTENT_WIDTH, 22, { fill: alternate });
      }
      drawLine(MARGIN_X, y - 22, MARGIN_X + CONTENT_WIDTH, line, 0.4);
      drawText(truncate(invoice.vendorName || "Unknown", 32), 48, y - 15, { size: 8.5 });
      drawText(truncate(invoice.invoiceNumber || "Not set", 18), 218, y - 15, { size: 8.5 });
      drawText(truncate(departmentName(data, invoice.departmentId), 24), 308, y - 15, { size: 8.5 });
      rightText(currencyDisplay(invoice.amount), 478, y - 15, { size: 8.5, bold: true });
      drawText(reportDate(invoice.dateUploaded), 492, y - 15, { size: 8.5 });
      y -= 22;
    });
    if (invoices.length > 150) {
      ensureSpace(28);
      drawText(`Detail limited to first 150 invoices of ${invoices.length}.`, MARGIN_X, y - 10, {
        size: 9,
        bold: true,
        rgb: muted,
      });
      y -= 24;
    }
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
