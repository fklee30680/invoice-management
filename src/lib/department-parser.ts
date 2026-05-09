import ExcelJS from "exceljs";
import type { DepartmentImportSettings } from "./types";
import { resolveColumnIndex } from "./vendor-parser";

export type DepartmentImportHeader = {
  index: number;
  letter: string;
  label: string;
};

export type ParsedDepartmentImportRow = {
  departmentName: string;
  departmentEmail: string;
  departmentHeadName: string;
  departmentHeadEmail: string;
  escalationName: string;
  escalationEmail: string;
  rowNumber: number;
  warnings: string[];
};

export type DepartmentImportResult = {
  rows: ParsedDepartmentImportRow[];
  errors: string[];
  warnings: string[];
};

export function defaultDepartmentImportSettings(): DepartmentImportSettings {
  return {
    headerRow: 1,
    departmentNameColumn: "Department",
    departmentEmailColumn: "Department Email",
    departmentHeadNameColumn: "Department Head Name",
    departmentHeadEmailColumn: "Department Head Email",
    escalationNameColumn: "Department Escalation Name",
    escalationEmailColumn: "Department Escalation Email",
    updateExisting: true,
    fillMissingData: true,
  };
}

export function normalizeDepartmentImportSettings(
  settings: Partial<DepartmentImportSettings> | undefined,
): DepartmentImportSettings {
  const defaults = defaultDepartmentImportSettings();
  return {
    headerRow: Math.max(Number(settings?.headerRow) || defaults.headerRow, 1),
    departmentNameColumn:
      settings?.departmentNameColumn || defaults.departmentNameColumn,
    departmentEmailColumn:
      settings?.departmentEmailColumn ?? defaults.departmentEmailColumn,
    departmentHeadNameColumn:
      settings?.departmentHeadNameColumn ?? defaults.departmentHeadNameColumn,
    departmentHeadEmailColumn:
      settings?.departmentHeadEmailColumn ?? defaults.departmentHeadEmailColumn,
    escalationNameColumn:
      settings?.escalationNameColumn ?? defaults.escalationNameColumn,
    escalationEmailColumn:
      settings?.escalationEmailColumn ?? defaults.escalationEmailColumn,
    updateExisting: settings?.updateExisting !== false,
    fillMissingData: settings?.fillMissingData !== false,
  };
}

function columnLetter(index: number) {
  let value = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    current = Math.floor((current - 1) / 26);
  }
  return value;
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

function rowIsBlank(row: string[]) {
  return row.every((value) => !value.trim());
}

function validEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function extractDepartmentImportHeaders(file: File, headerRow: number) {
  const normalizedHeaderRow = Math.max(Number(headerRow) || 1, 1);
  const rows = await readDepartmentImportRows(file, normalizedHeaderRow);
  if (rows.errors.length > 0) return { headers: [], errors: rows.errors };
  const headers = rows.rows[normalizedHeaderRow - 1];
  if (!headers) {
    return {
      headers: [],
      errors: [`Header row ${normalizedHeaderRow} was not found in the file.`],
    };
  }
  return {
    headers: headers.map((label, index) => ({
      index,
      letter: columnLetter(index),
      label,
    })),
    errors: [],
  };
}

async function readDepartmentImportRows(file: File, headerRow: number) {
  if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
    return {
      rows: [],
      errors: ["Department file must be a CSV or Excel file."],
    };
  }

  if (file.name.toLowerCase().endsWith(".csv")) {
    const text = await file.text();
    return {
      rows: text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map(parseCsvLine),
      errors: [],
    };
  }

  const workbook = new ExcelJS.Workbook();
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    await workbook.xlsx.load(
      buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
    );
  } catch {
    return {
      rows: [],
      errors: ["The Excel file could not be read. Upload a valid .xlsx file or use CSV."],
    };
  }
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return { rows: [], errors: ["The workbook does not contain a worksheet."] };
  }

  const normalizedHeaderRow = Math.max(headerRow, 1);
  const header = worksheet.getRow(normalizedHeaderRow);
  const maxColumnCount = Math.max(
    worksheet.columnCount,
    Array.isArray(header.values) ? header.values.length - 1 : 0,
  );
  const rows: string[][] = [];
  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values: string[] = [];
    for (let columnNumber = 1; columnNumber <= maxColumnCount; columnNumber += 1) {
      values[columnNumber - 1] = row.getCell(columnNumber).text.trim();
    }
    rows[rowNumber - 1] = values;
  }

  return { rows, errors: [] };
}

function rowsToDepartments(
  rows: string[][],
  settings: DepartmentImportSettings,
): DepartmentImportResult {
  const headerIndex = Math.max(settings.headerRow - 1, 0);
  const headerRow = rows[headerIndex];
  if (!headerRow) {
    return {
      rows: [],
      errors: [`Header row ${settings.headerRow} was not found in the file.`],
      warnings: [],
    };
  }

  const departmentNameColumn = resolveColumnIndex(
    headerRow,
    settings.departmentNameColumn,
  );
  const departmentEmailColumn = resolveColumnIndex(
    headerRow,
    settings.departmentEmailColumn,
  );
  const departmentHeadNameColumn = resolveColumnIndex(
    headerRow,
    settings.departmentHeadNameColumn,
  );
  const departmentHeadEmailColumn = resolveColumnIndex(
    headerRow,
    settings.departmentHeadEmailColumn,
  );
  const escalationNameColumn = resolveColumnIndex(
    headerRow,
    settings.escalationNameColumn,
  );
  const escalationEmailColumn = resolveColumnIndex(
    headerRow,
    settings.escalationEmailColumn,
  );

  const errors = [
    departmentNameColumn.index === null
      ? "Department Column could not be found. Select a column from the header row or enter a valid column letter."
      : "",
  ].filter(Boolean);
  const warnings = [
    departmentNameColumn.message || "",
    departmentEmailColumn.message || "",
    departmentHeadNameColumn.message || "",
    departmentHeadEmailColumn.message || "",
    escalationNameColumn.message || "",
    escalationEmailColumn.message || "",
    settings.departmentEmailColumn && departmentEmailColumn.index === null
      ? "Department Email Column could not be found. Rows were imported without department email addresses."
      : "",
    settings.departmentHeadNameColumn && departmentHeadNameColumn.index === null
      ? "Department Head Name Column could not be found. Rows were imported without department head names."
      : "",
    settings.departmentHeadEmailColumn && departmentHeadEmailColumn.index === null
      ? "Department Head Email Column could not be found. Rows were imported without department head emails."
      : "",
    settings.escalationNameColumn && escalationNameColumn.index === null
      ? "Department Escalation Name Column could not be found. Rows were imported without escalation names."
      : "",
    settings.escalationEmailColumn && escalationEmailColumn.index === null
      ? "Department Escalation Email Column could not be found. Rows were imported without escalation emails."
      : "",
  ].filter(Boolean);

  if (errors.length > 0) {
    return { rows: [], errors, warnings };
  }

  const parsedRows: ParsedDepartmentImportRow[] = [];
  rows.slice(headerIndex + 1).forEach((row, index) => {
    const rowNumber = headerIndex + index + 2;
    if (rowIsBlank(row)) return;
    const departmentName = cell(row, departmentNameColumn.index);
    const departmentEmail = cell(row, departmentEmailColumn.index).toLowerCase();
    const departmentHeadName = cell(row, departmentHeadNameColumn.index);
    const departmentHeadEmail = cell(row, departmentHeadEmailColumn.index).toLowerCase();
    const escalationName = cell(row, escalationNameColumn.index);
    const escalationEmail = cell(row, escalationEmailColumn.index).toLowerCase();
    const rowWarnings: string[] = [];

    if (!departmentName) {
      warnings.push(`Row ${rowNumber} skipped: Department is blank.`);
      return;
    }
    if (!departmentEmail) {
      rowWarnings.push(`Row ${rowNumber}: Department Email is blank.`);
    } else if (!validEmail(departmentEmail)) {
      rowWarnings.push(`Row ${rowNumber}: Department Email '${departmentEmail}' is not a valid email address.`);
    }
    if (departmentHeadEmail && !validEmail(departmentHeadEmail)) {
      rowWarnings.push(`Row ${rowNumber}: Department Head Email '${departmentHeadEmail}' is not a valid email address.`);
    }
    if (escalationEmail && !validEmail(escalationEmail)) {
      rowWarnings.push(`Row ${rowNumber}: Department Escalation Email '${escalationEmail}' is not a valid email address.`);
    }

    parsedRows.push({
      departmentName,
      departmentEmail,
      departmentHeadName,
      departmentHeadEmail,
      escalationName,
      escalationEmail,
      rowNumber,
      warnings: rowWarnings,
    });
    warnings.push(...rowWarnings);
  });

  return { rows: parsedRows, errors: [], warnings };
}

export async function parseDepartmentUpload(
  file: File,
  settings: DepartmentImportSettings,
): Promise<DepartmentImportResult> {
  const rows = await readDepartmentImportRows(file, settings.headerRow);
  if (rows.errors.length > 0) {
    return { rows: [], errors: rows.errors, warnings: [] };
  }
  return rowsToDepartments(rows.rows, settings);
}
