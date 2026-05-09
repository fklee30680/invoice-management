import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultVendorImportSettings,
  normalizeVendorImportSettings,
  parseVendorActiveValue,
  parseVendorUpload,
  resolveVendorColumnIndex,
} from "./vendor-parser";

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

  it("returns errors for required missing mappings", async () => {
    const file = new File(["Email\nap@example.com\n"], "vendors.csv", {
      type: "text/csv",
    });

    const result = await parseVendorUpload(file, defaultVendorImportSettings());

    assert.equal(result.rows.length, 0);
    assert.ok(result.errors.includes("Vendor Number column could not be found."));
    assert.ok(result.errors.includes("Vendor Name column could not be found."));
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
    assert.ok(result.warnings.includes("Row 2: Vendor Number is blank."));
    assert.ok(result.warnings.includes("Row 3: Vendor Name is blank."));
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
