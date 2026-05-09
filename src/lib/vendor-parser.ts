import ExcelJS from "exceljs";
import type { VendorImportSettings } from "./types";

export type ParsedVendor = {
  vendorName: string;
  vendorNumber: string;
  email: string;
  active: boolean;
  activeProvided: boolean;
  rowNumber: number;
  warnings: string[];
};

export type VendorImportResult = {
  rows: ParsedVendor[];
  errors: string[];
  warnings: string[];
};

export function defaultVendorImportSettings(): VendorImportSettings {
  return {
    headerRow: 1,
    vendorNameColumn: "Vendor Name",
    vendorNumberColumn: "Vendor Number",
    vendorEmailColumn: "Email",
    activeColumn: "Active",
    updateExisting: true,
    fillMissingData: true,
  };
}

export function normalizeVendorImportSettings(
  settings: Partial<VendorImportSettings> | undefined,
): VendorImportSettings {
  const defaults = defaultVendorImportSettings();
  return {
    headerRow: Math.max(Number(settings?.headerRow) || defaults.headerRow, 1),
    vendorNameColumn: settings?.vendorNameColumn || defaults.vendorNameColumn,
    vendorNumberColumn: settings?.vendorNumberColumn || defaults.vendorNumberColumn,
    vendorEmailColumn: settings?.vendorEmailColumn || defaults.vendorEmailColumn,
    activeColumn: settings?.activeColumn || defaults.activeColumn,
    updateExisting: settings?.updateExisting !== false,
    fillMissingData: settings?.fillMissingData !== false,
  };
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function columnLetterToIndex(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) return -1;

  let index = 0;
  for (const character of normalized) {
    index = index * 26 + character.charCodeAt(0) - 64;
  }
  return index - 1;
}

export function resolveVendorColumnIndex(headers: string[], mappingValue: string) {
  const mapped = mappingValue.trim();
  if (!mapped) return null;

  const letterIndex = columnLetterToIndex(mapped);
  if (letterIndex >= 0) return letterIndex;

  if (/^\d+$/.test(mapped)) {
    const numberIndex = Number(mapped) - 1;
    return numberIndex >= 0 ? numberIndex : null;
  }

  const normalized = normalizeHeader(mapped);
  const headerIndex = headers
    .map(normalizeHeader)
    .findIndex((header) => header === normalized);
  return headerIndex >= 0 ? headerIndex : null;
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];
    if (character === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, ""));
}

function cell(row: string[], index: number | null) {
  return index === null ? "" : (row[index] || "").trim();
}

export function parseVendorActiveValue(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  if (["n", "no", "false", "inactive", "disabled", "0"].includes(normalized)) {
    return false;
  }
  return true;
}

function rowsToVendors(
  rows: string[][],
  settings: VendorImportSettings,
): VendorImportResult {
  const headerIndex = Math.max(settings.headerRow - 1, 0);
  const headerRow = rows[headerIndex];
  if (!headerRow) {
    return {
      rows: [],
      errors: [`Header row ${settings.headerRow} was not found in the file.`],
      warnings: [],
    };
  }

  const vendorNumberIndex = resolveVendorColumnIndex(headerRow, settings.vendorNumberColumn);
  const vendorNameIndex = resolveVendorColumnIndex(headerRow, settings.vendorNameColumn);
  const emailIndex = resolveVendorColumnIndex(headerRow, settings.vendorEmailColumn);
  const activeIndex = resolveVendorColumnIndex(headerRow, settings.activeColumn);
  const errors = [
    vendorNumberIndex === null ? "Vendor Number column could not be found." : "",
    vendorNameIndex === null ? "Vendor Name column could not be found." : "",
  ].filter(Boolean);
  const warnings = [
    settings.vendorEmailColumn && emailIndex === null
      ? "Vendor Email column was not found. Rows were imported without email addresses."
      : "",
    settings.activeColumn && activeIndex === null
      ? "Active column was not found. Rows defaulted to active."
      : "",
  ].filter(Boolean);

  if (errors.length > 0) {
    return { rows: [], errors, warnings };
  }

  const parsedRows: ParsedVendor[] = [];
  rows.slice(headerIndex + 1).forEach((row, index) => {
    const rowNumber = headerIndex + index + 2;
    const vendorNumber = cell(row, vendorNumberIndex);
    const vendorName = cell(row, vendorNameIndex);
    const email = cell(row, emailIndex).toLowerCase();
    const activeRaw = cell(row, activeIndex);
    const rowWarnings: string[] = [];

    if (!vendorNumber) {
      warnings.push(`Row ${rowNumber}: Vendor Number is blank.`);
      return;
    }
    if (!vendorName) {
      warnings.push(`Row ${rowNumber}: Vendor Name is blank.`);
      return;
    }

    parsedRows.push({
      vendorName,
      vendorNumber,
      email,
      active: parseVendorActiveValue(activeRaw),
      activeProvided: activeIndex !== null && Boolean(activeRaw),
      rowNumber,
      warnings: rowWarnings,
    });
    warnings.push(...rowWarnings);
  });

  return { rows: parsedRows, errors: [], warnings };
}

async function parseCsv(file: File, settings: VendorImportSettings) {
  const text = await file.text();
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine);
  return rowsToVendors(rows, settings);
}

async function parseWorkbook(file: File, settings: VendorImportSettings) {
  const workbook = new ExcelJS.Workbook();
  const buffer = Buffer.from(await file.arrayBuffer());
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return { rows: [], errors: ["The workbook does not contain a worksheet."], warnings: [] };
  }

  const rows: string[][] = [];
  worksheet.eachRow((row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cellValue, columnNumber) => {
      values[columnNumber - 1] = cellValue.text.trim();
    });
    rows.push(values);
  });

  return rowsToVendors(rows, settings);
}

export async function parseVendorUpload(
  file: File,
  settings: VendorImportSettings,
): Promise<VendorImportResult> {
  if (file.name.toLowerCase().endsWith(".csv")) {
    return parseCsv(file, settings);
  }

  return parseWorkbook(file, settings);
}
