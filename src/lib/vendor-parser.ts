import ExcelJS from "exceljs";

export type VendorImportMapping = {
  headerRow: number;
  vendorName: string;
  vendorNumber: string;
  email: string;
  active: string;
};

export type VendorImportRow = {
  vendorName: string;
  vendorNumber: string;
  email: string;
  active: boolean;
};

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

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (const character of line) {
    if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }

  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, "").replace(/""/g, '"'));
}

function cell(row: string[], headers: string[], mappingValue: string) {
  const mapped = mappingValue.trim();
  if (!mapped) return "";

  const letterIndex = columnLetterToIndex(mapped);
  if (letterIndex >= 0) {
    return (row[letterIndex] || "").trim();
  }

  const headerIndex = headers.findIndex(
    (header) => header === normalizeHeader(mapped),
  );
  return headerIndex >= 0 ? (row[headerIndex] || "").trim() : "";
}

function activeValue(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return !["n", "no", "false", "inactive", "disabled", "0"].includes(normalized);
}

function rowsToVendors(rows: string[][], mapping: VendorImportMapping) {
  const headerIndex = Math.max(mapping.headerRow - 1, 0);
  const headers = (rows[headerIndex] || []).map(normalizeHeader);
  const body = rows.slice(headerIndex + 1);

  return body
    .map((row) => ({
      vendorName: cell(row, headers, mapping.vendorName),
      vendorNumber: cell(row, headers, mapping.vendorNumber),
      email: cell(row, headers, mapping.email).toLowerCase(),
      active: activeValue(cell(row, headers, mapping.active)),
    }))
    .filter((row) => row.vendorName);
}

async function parseCsv(file: File, mapping: VendorImportMapping) {
  const text = await file.text();
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine);
  return rowsToVendors(rows, mapping);
}

async function parseWorkbook(file: File, mapping: VendorImportMapping) {
  const workbook = new ExcelJS.Workbook();
  const buffer = Buffer.from(await file.arrayBuffer());
  await workbook.xlsx.load(
    buffer as unknown as Parameters<typeof workbook.xlsx.load>[0],
  );
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows: string[][] = [];
  worksheet.eachRow((row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cellValue, columnNumber) => {
      values[columnNumber - 1] = cellValue.text.trim();
    });
    rows.push(values);
  });

  return rowsToVendors(rows, mapping);
}

export async function parseVendorUpload(
  file: File,
  mapping: VendorImportMapping,
): Promise<VendorImportRow[]> {
  if (file.name.toLowerCase().endsWith(".csv")) {
    return parseCsv(file, mapping);
  }

  return parseWorkbook(file, mapping);
}
