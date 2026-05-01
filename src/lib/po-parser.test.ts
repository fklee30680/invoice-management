import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultPoImportSettings,
  normalizePoImportSettings,
  parsePoUpload,
  resolveColumnIndex,
} from "./po-parser";

describe("resolveColumnIndex", () => {
  const headers = ["PO Number", "Vendor Name", "Vendor Number", "Department"];

  it("resolves header names case-insensitively", () => {
    assert.equal(resolveColumnIndex(headers, "vendor name"), 1);
  });

  it("resolves column letters, multi-letter columns, and numbers", () => {
    assert.equal(resolveColumnIndex(headers, "A"), 0);
    assert.equal(resolveColumnIndex(headers, "AA"), 26);
    assert.equal(resolveColumnIndex(headers, "3"), 2);
  });
});

describe("parsePoUpload", () => {
  it("supports configurable header rows and column letters", async () => {
    const file = new File(
      [
        "Generated report\n",
        "PO,Dept,Vendor,Vendor No\n",
        "PO-1,Finance,ABC Supply,V100\n",
      ],
      "po-list.csv",
      { type: "text/csv" },
    );

    const result = await parsePoUpload(file, {
      ...defaultPoImportSettings(),
      headerRow: 2,
      poNumberColumn: "A",
      departmentColumn: "B",
      vendorNameColumn: "C",
      vendorNumberColumn: "D",
    });

    assert.deepEqual(result.errors, []);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].poNumber, "PO-1");
    assert.equal(result.rows[0].vendorNumber, "V100");
    assert.equal(result.rows[0].departmentName, "Finance");
  });

  it("returns errors for required missing mappings", async () => {
    const file = new File(["Vendor\nABC Supply\n"], "po-list.csv", {
      type: "text/csv",
    });

    const result = await parsePoUpload(file, defaultPoImportSettings());

    assert.equal(result.rows.length, 0);
    assert.ok(result.errors.includes("PO Number column could not be found."));
    assert.ok(result.errors.includes("Department column could not be found."));
  });

  it("imports rows with blank vendor number warning", async () => {
    const file = new File(
      ["PO Number,Vendor Name,Department\nPO-1,ABC Supply,Finance\n"],
      "po-list.csv",
      { type: "text/csv" },
    );

    const result = await parsePoUpload(file, {
      ...defaultPoImportSettings(),
      vendorNumberColumn: "",
    });

    assert.equal(result.rows.length, 1);
    assert.ok(result.warnings.includes("Row 2: Vendor Number is blank."));
  });

  it("normalizes import settings", () => {
    assert.deepEqual(normalizePoImportSettings({ headerRow: 0 }), {
      ...defaultPoImportSettings(),
      headerRow: 1,
    });
    assert.equal(normalizePoImportSettings({}).fillMissingData, true);
  });
});
