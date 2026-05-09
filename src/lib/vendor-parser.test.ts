import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";
import {
  defaultVendorImportSettings,
  extractVendorImportHeaders,
  normalizeVendorImportSettings,
  parseVendorActiveValue,
  parseVendorUpload,
  resolveColumnIndex,
  resolveVendorColumnIndex,
} from "./vendor-parser";

async function workbookFile(
  rows: Array<Array<string | number>>,
  fileName = "vendors.xlsx",
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Vendors");
  rows.forEach((row) => worksheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return new File([buffer], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("resolveVendorColumnIndex", () => {
  const headers = ["Vendor Number", "Vendor Name", "Email", "Active"];

  it("resolves header names case-insensitively", () => {
    assert.equal(resolveVendorColumnIndex(headers, "vendor name"), 1);
  });

  it("resolves column letters, multi-letter columns, and numbers", () => {
    assert.equal(resolveVendorColumnIndex(headers, "A"), 0);
    assert.equal(resolveVendorColumnIndex(headers, "AA"), 26);
    assert.equal(resolveVendorColumnIndex(headers, "3"), 2);
  });

  it("reports duplicate header matches", () => {
    const result = resolveColumnIndex(["Vendor Name", "Vendor-Name"], "vendor name");
    assert.equal(result.index, 0);
    assert.equal(result.source, "header");
    assert.equal(result.message, "Multiple headers matched vendor name. Using the first match.");
  });
});

describe("parseVendorUpload", () => {
  it("supports configurable header rows and column letters", async () => {
    const file = new File(
      [
        "Generated report\n",
        "Vendor No,Vendor,Contact Email,Enabled\n",
        "00123,ABC Supply,ap@example.com,yes\n",
      ],
      "vendors.csv",
      { type: "text/csv" },
    );

    const result = await parseVendorUpload(file, {
      ...defaultVendorImportSettings(),
      headerRow: 2,
      vendorNumberColumn: "A",
      vendorNameColumn: "B",
      vendorEmailColumn: "C",
      activeColumn: "D",
    });

    assert.deepEqual(result.errors, []);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].vendorNumber, "00123");
    assert.equal(result.rows[0].vendorName, "ABC Supply");
    assert.equal(result.rows[0].email, "ap@example.com");
    assert.equal(result.rows[0].active, true);
  });

  it("maps CSV columns by header name", async () => {
    const file = new File(
      ["Vendor Number,Vendor Name,Email,Active\n00123,ABC Supply,ap@example.com,true\n"],
      "vendors.csv",
      { type: "text/csv" },
    );

    const result = await parseVendorUpload(file, defaultVendorImportSettings());

    assert.deepEqual(result.errors, []);
    assert.equal(result.rows[0].vendorNumber, "00123");
    assert.equal(result.rows[0].vendorName, "ABC Supply");
  });

  it("maps XLSX columns by header name", async () => {
    const file = await workbookFile([
      ["Vendor Number", "Vendor Name", "Email", "Active"],
      ["00123", "ABC Supply", "ap@example.com", "true"],
    ]);

    const result = await parseVendorUpload(file, defaultVendorImportSettings());

    assert.deepEqual(result.errors, []);
    assert.equal(result.rows[0].vendorNumber, "00123");
    assert.equal(result.rows[0].vendorName, "ABC Supply");
  });

  it("maps XLSX columns by letter and preserves leading zeros stored as text", async () => {
    const file = await workbookFile([
      ["Vendor Number", "Vendor Name", "Email", "Active"],
      ["00123", "ABC Supply", "", "false"],
    ]);

    const result = await parseVendorUpload(file, {
      ...defaultVendorImportSettings(),
      vendorNumberColumn: "A",
      vendorNameColumn: "B",
      vendorEmailColumn: "C",
      activeColumn: "D",
    });

    assert.deepEqual(result.errors, []);
    assert.equal(result.rows[0].vendorNumber, "00123");
    assert.equal(result.rows[0].active, false);
  });

  it("keeps Excel indexes stable when leading header cells are blank", async () => {
    const file = await workbookFile([
      ["", "Vendor Number", "Vendor Name"],
      ["", "00123", "ABC Supply"],
    ]);

    const result = await parseVendorUpload(file, {
      ...defaultVendorImportSettings(),
      vendorNumberColumn: "B",
      vendorNameColumn: "C",
      vendorEmailColumn: "",
      activeColumn: "",
    });

    assert.deepEqual(result.errors, []);
    assert.equal(result.rows[0].vendorNumber, "00123");
    assert.equal(result.rows[0].vendorName, "ABC Supply");
  });

  it("returns errors for required missing mappings", async () => {
    const file = new File(["Email\nap@example.com\n"], "vendors.csv", {
      type: "text/csv",
    });

    const result = await parseVendorUpload(file, defaultVendorImportSettings());

    assert.equal(result.rows.length, 0);
    assert.ok(
      result.errors.includes(
        "Vendor Number Column could not be found. Select a column from the header row or enter a valid column letter.",
      ),
    );
    assert.ok(
      result.errors.includes(
        "Vendor Name Column could not be found. Select a column from the header row or enter a valid column letter.",
      ),
    );
  });

  it("skips blank vendor number and blank vendor name rows with warnings", async () => {
    const file = new File(
      [
        "Vendor Number,Vendor Name,Email\n",
        ",ABC Supply,ap@example.com\n",
        "V200,,ap2@example.com\n",
      ],
      "vendors.csv",
      { type: "text/csv" },
    );

    const result = await parseVendorUpload(file, defaultVendorImportSettings());

    assert.equal(result.rows.length, 0);
    assert.ok(result.warnings.includes("Row 2 skipped: Vendor Number is blank."));
    assert.ok(result.warnings.includes("Row 3 skipped: Vendor Name is blank."));
  });

  it("extracts preview headers from CSV and XLSX files", async () => {
    const csv = new File(["Vendor Number,Vendor Name\nV100,ABC\n"], "vendors.csv", {
      type: "text/csv",
    });
    const xlsx = await workbookFile([
      ["Report"],
      ["Vendor Number", "Vendor Name"],
      ["V100", "ABC"],
    ]);

    const csvPreview = await extractVendorImportHeaders(csv, 1);
    const xlsxPreview = await extractVendorImportHeaders(xlsx, 2);

    assert.deepEqual(csvPreview.headers.slice(0, 2), [
      { index: 0, letter: "A", label: "Vendor Number" },
      { index: 1, letter: "B", label: "Vendor Name" },
    ]);
    assert.deepEqual(xlsxPreview.headers.slice(0, 2), [
      { index: 0, letter: "A", label: "Vendor Number" },
      { index: 1, letter: "B", label: "Vendor Name" },
    ]);
  });

  it("imports blank email and defaults blank active to true", async () => {
    const file = new File(
      ["Vendor Number,Vendor Name,Email,Active\nV100,ABC Supply,,\n"],
      "vendors.csv",
      { type: "text/csv" },
    );

    const result = await parseVendorUpload(file, defaultVendorImportSettings());

    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].email, "");
    assert.equal(result.rows[0].active, true);
    assert.equal(result.rows[0].activeProvided, false);
  });

  it("normalizes import settings", () => {
    const settings = normalizeVendorImportSettings({
      headerRow: 0,
      updateExisting: false,
      fillMissingData: false,
    });

    assert.equal(settings.headerRow, 1);
    assert.equal(settings.vendorNameColumn, "Vendor Name");
    assert.equal(settings.vendorNumberColumn, "Vendor Number");
    assert.equal(settings.updateExisting, false);
    assert.equal(settings.fillMissingData, false);
  });
});

describe("parseVendorActiveValue", () => {
  it("parses common active and inactive values", () => {
    assert.equal(parseVendorActiveValue("yes"), true);
    assert.equal(parseVendorActiveValue("true"), true);
    assert.equal(parseVendorActiveValue(""), true);
    assert.equal(parseVendorActiveValue("no"), false);
    assert.equal(parseVendorActiveValue("inactive"), false);
    assert.equal(parseVendorActiveValue("disabled"), false);
    assert.equal(parseVendorActiveValue("0"), false);
  });
});
