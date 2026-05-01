import ExcelJS from "exceljs";
import type { PoImportSettings } from "./types";
import { normalizePoNumber } from "./utils";

export type ParsedPurchaseOrder = {
  poNumber: string;
  normalizedPoNumber: string;
  vendorName: string;
  vendorNumber: string;
  departmentName: string;
  rowNumber: number;
  warnings: string[];
};

export type PoImportResult = {
  rows: ParsedPurchaseOrder[];
  errors: string[];
  warnings: string[];
};

export function defaultPoImportSettings(): PoImportSettings {
  return {
    headerRow: 1,
    poNumberColumn: "PO Number",
    vendorNameColumn: "Vendor Name",
    vendorNumberColumn: "Vendor Number",
    departmentColumn: "Department",
    updateExisting: true,
    fillMissingData: true,
  };
}

export function normalizePoImportSettings(
  settings: Partial<PoImportSettings> | undefined,
): PoImportSettings {
  const defaults = defaultPoImportSettings();
  return {
    headerRow: Math.max(Number(settings?.headerRow) || defaults.headerRow, 1),
    poNumberColumn: settings?.poNumberColumn || defaults.poNumberColumn,
    vendorNameColumn: settings?.vendorNameColumn || defaults.vendorNameColumn,
    vendorNumberColumn: settings?.vendorNumberColumn || defaults.vendorNumberColumn,
    departmentColumn: settings?.departmentColumn || defaults.departmentColumn,
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

export function resolveColumnIndex(headers: string[], mappingValue: string) {
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
  return cells;
}

function cell(row: string[], index: number | null) {
  return index === null ? "" : (row[index] || "").trim();
}

function rowsToPurchaseOrders(
  rows: string[][],
  settings: PoImportSettings,
): PoImportResult {
  const headerIndex = Math.max(settings.headerRow - 1, 0);
  const headerRow = rows[headerIndex];
  if (!headerRow) {
    return {
      rows: [],
      errors: [`Header row ${settings.headerRow} was not found in the file.`],
      warnings: [],
    };
  }

  const poNumberIndex = resolveColumnIndex(headerRow, settings.poNumberColumn);
  const vendorNameIndex = resolveColumnIndex(headerRow, settings.vendorNameColumn);
  const vendorNumberIndex = resolveColumnIndex(headerRow, settings.vendorNumberColumn);
  const departmentIndex = resolveColumnIndex(headerRow, settings.departmentColumn);
  const errors = [
    poNumberIndex === null ? "PO Number column could not be found." : "",
    vendorNameIndex === null ? "Vendor Name column could not be found." : "",
    departmentIndex === null ? "Department column could not be found." : "",
  ].filter(Boolean);
  const warnings =
    settings.vendorNumberColumn && vendorNumberIndex === null
      ? ["Vendor Number column was not found. Rows were imported without vendor numbers."]
      : [];
  if (errors.length > 0) {
    return { rows: [], errors, warnings };
  }

  const parsedRows: ParsedPurchaseOrder[] = [];
  rows.slice(headerIndex + 1).forEach((row, index) => {
    const rowNumber = headerIndex + index + 2;
    const poNumber = cell(row, poNumberIndex);
    const vendorName = cell(row, vendorNameIndex);
    const vendorNumber = cell(row, vendorNumberIndex);
    const departmentName = cell(row, departmentIndex);
    const rowWarnings: string[] = [];

    if (!poNumber) {
      warnings.push(`Row ${rowNumber}: PO Number is blank.`);
      return;
    }
    if (!vendorName) {
      warnings.push(`Row ${rowNumber}: Vendor Name is blank.`);
      return;
    }
    if (!departmentName) {
      warnings.push(`Row ${rowNumber}: Department is blank.`);
      return;
    }
    if (!vendorNumber) {
      rowWarnings.push(`Row ${rowNumber}: Vendor Number is blank.`);
    }

    parsedRows.push({
      poNumber,
      normalizedPoNumber: normalizePoNumber(poNumber),
      vendorName,
      vendorNumber,
      departmentName,
      rowNumber,
      warnings: rowWarnings,
    });
    warnings.push(...rowWarnings);
  });

  return { rows: parsedRows, errors: [], warnings };
}

async function parseCsv(file: File, settings: PoImportSettings) {
  const text = await file.text();
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine);
  return rowsToPurchaseOrders(rows, settings);
}

async function parseWorkbook(file: File, settings: PoImportSettings) {
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

  return rowsToPurchaseOrders(rows, settings);
}

export async function parsePoUpload(
  file: File,
  settings: PoImportSettings,
): Promise<PoImportResult> {
  if (file.name.toLowerCase().endsWith(".csv")) {
    return parseCsv(file, settings);
  }

  return parseWorkbook(file, settings);
}
