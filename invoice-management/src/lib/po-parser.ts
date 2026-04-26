import ExcelJS from "exceljs";

type PoRow = {
  poNumber: string;
  vendorName: string;
  departmentName: string;
};

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
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

function rowsToPurchaseOrders(rows: string[][]) {
  const [headers = [], ...body] = rows;
  const normalizedHeaders = headers.map(normalizeHeader);

  function cell(row: string[], candidates: string[]) {
    const index = normalizedHeaders.findIndex((header) => candidates.includes(header));
    return index >= 0 ? (row[index] || "").trim() : "";
  }

  return body
    .map((row) => ({
      poNumber: cell(row, ["ponumber", "po", "purchaseorder", "purchaseordernumber"]),
      vendorName: cell(row, ["vendor", "vendorname", "supplier", "suppliername"]),
      departmentName: cell(row, ["department", "dept", "departmentname"]),
    }))
    .filter((row) => row.poNumber && row.vendorName && row.departmentName);
}

async function parseCsv(file: File) {
  const text = await file.text();
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine);
  return rowsToPurchaseOrders(rows);
}

async function parseWorkbook(file: File) {
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
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      values[columnNumber - 1] = cell.text.trim();
    });
    rows.push(values);
  });

  return rowsToPurchaseOrders(rows);
}

export async function parsePoUpload(file: File): Promise<PoRow[]> {
  if (file.name.toLowerCase().endsWith(".csv")) {
    return parseCsv(file);
  }

  return parseWorkbook(file);
}
