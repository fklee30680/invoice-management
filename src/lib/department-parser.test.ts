import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import {
  defaultDepartmentImportSettings,
  extractDepartmentImportHeaders,
  normalizeDepartmentImportSettings,
  parseDepartmentUpload,
} from "./department-parser";

async function workbookFile(
  rows: Array<Array<string | number>>,
  fileName = "departments.xlsx",
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Departments");
  rows.forEach((row) => worksheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return new File([buffer], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("parseDepartmentUpload", () => {
  it("maps CSV columns by header name", async () => {
    const file = new File(
      [
        "Department,Department Email,Department Head Name,Department Head Email,Department Escalation Name,Department Escalation Email\n",
        "Finance,finance@example.com,Jane Lee,jane@example.com,John King,john@example.com\n",
      ],
      "departments.csv",
      { type: "text/csv" },
    );

    const result = await parseDepartmentUpload(file, defaultDepartmentImportSettings());

    assert.deepEqual(result.errors, []);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].departmentName, "Finance");
    assert.equal(result.rows[0].departmentEmail, "finance@example.com");
    assert.equal(result.rows[0].departmentHeadName, "Jane Lee");
    assert.equal(result.rows[0].departmentHeadEmail, "jane@example.com");
    assert.equal(result.rows[0].escalationName, "John King");
    assert.equal(result.rows[0].escalationEmail, "john@example.com");
  });

  it("maps XLSX columns by header name", async () => {
    const file = await workbookFile([
      ["Department", "Department Email"],
      ["Public Works", "pw@example.com"],
    ]);

    const result = await parseDepartmentUpload(file, {
      ...defaultDepartmentImportSettings(),
      departmentHeadNameColumn: "",
      departmentHeadEmailColumn: "",
      escalationNameColumn: "",
      escalationEmailColumn: "",
    });

    assert.deepEqual(result.errors, []);
    assert.equal(result.rows[0].departmentName, "Public Works");
    assert.equal(result.rows[0].departmentEmail, "pw@example.com");
  });

  it("supports header rows, column letters, and column numbers", async () => {
    const file = new File(
      [
        "Generated report\n",
        "Dept,Email,Head\n",
        "Planning,planning@example.com,Ada Smith\n",
      ],
      "departments.csv",
      { type: "text/csv" },
    );

    const result = await parseDepartmentUpload(file, {
      ...defaultDepartmentImportSettings(),
      headerRow: 2,
      departmentNameColumn: "A",
      departmentEmailColumn: "2",
      departmentHeadNameColumn: "C",
      departmentHeadEmailColumn: "",
      escalationNameColumn: "",
      escalationEmailColumn: "",
    });

    assert.deepEqual(result.errors, []);
    assert.equal(result.rows[0].departmentName, "Planning");
    assert.equal(result.rows[0].departmentEmail, "planning@example.com");
    assert.equal(result.rows[0].departmentHeadName, "Ada Smith");
  });

  it("returns a fatal error when department mapping is missing", async () => {
    const file = new File(["Email\nfinance@example.com\n"], "departments.csv", {
      type: "text/csv",
    });

    const result = await parseDepartmentUpload(file, defaultDepartmentImportSettings());

    assert.equal(result.rows.length, 0);
    assert.ok(
      result.errors.includes(
        "Department Column could not be found. Select a column from the header row or enter a valid column letter.",
      ),
    );
  });

  it("skips blank department rows and warns for blank or invalid emails", async () => {
    const file = new File(
      [
        "Department,Department Email,Department Head Email,Department Escalation Email\n",
        ",blank@example.com,,\n",
        "Finance,,bad-head,bad-escalation\n",
        "Planning,not-an-email,,\n",
      ],
      "departments.csv",
      { type: "text/csv" },
    );

    const result = await parseDepartmentUpload(file, {
      ...defaultDepartmentImportSettings(),
      departmentHeadNameColumn: "",
      escalationNameColumn: "",
    });

    assert.equal(result.rows.length, 2);
    assert.ok(result.warnings.includes("Row 2 skipped: Department is blank."));
    assert.ok(result.warnings.includes("Row 3: Department Email is blank."));
    assert.ok(
      result.warnings.includes(
        "Row 3: Department Head Email 'bad-head' is not a valid email address.",
      ),
    );
    assert.ok(
      result.warnings.includes(
        "Row 3: Department Escalation Email 'bad-escalation' is not a valid email address.",
      ),
    );
    assert.ok(
      result.warnings.includes(
        "Row 4: Department Email 'not-an-email' is not a valid email address.",
      ),
    );
  });

  it("extracts preview headers from CSV and XLSX files", async () => {
    const csv = new File(["Department,Department Email\nFinance,finance@example.com\n"], "departments.csv", {
      type: "text/csv",
    });
    const xlsx = await workbookFile([
      ["Report"],
      ["Department", "Department Email"],
      ["Finance", "finance@example.com"],
    ]);

    const csvPreview = await extractDepartmentImportHeaders(csv, 1);
    const xlsxPreview = await extractDepartmentImportHeaders(xlsx, 2);

    assert.deepEqual(csvPreview.headers.slice(0, 2), [
      { index: 0, letter: "A", label: "Department" },
      { index: 1, letter: "B", label: "Department Email" },
    ]);
    assert.deepEqual(xlsxPreview.headers.slice(0, 2), [
      { index: 0, letter: "A", label: "Department" },
      { index: 1, letter: "B", label: "Department Email" },
    ]);
  });

  it("normalizes import settings", () => {
    const settings = normalizeDepartmentImportSettings({
      headerRow: 0,
      updateExisting: false,
      fillMissingData: false,
    });

    assert.equal(settings.headerRow, 1);
    assert.equal(settings.departmentNameColumn, "Department");
    assert.equal(settings.departmentEmailColumn, "Department Email");
    assert.equal(settings.updateExisting, false);
    assert.equal(settings.fillMissingData, false);
  });
});
