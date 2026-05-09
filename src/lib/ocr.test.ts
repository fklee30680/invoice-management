import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractInvoiceMetadata, extractInvoiceMetadataFromText } from "./ocr";

describe("extractInvoiceMetadataFromText", () => {
  it("extracts and normalizes the sample invoice fields", () => {
    const result = extractInvoiceMetadataFromText(`
      IMPACT 46
      333 3rd Ave
      Seattle, WA 12345
      Phone: 123-456-7890
      INVOICE # 100
      PO 260773
      DATE: 01/31/2026
      PURCHASED BY:
      Keith Lee
      CFO
      70 S Clayton St
      Lawrenceville GA 30046
      Phone: 111-222-3333
      SHIP TO:
      City of Lawrenceville
      70 S Clayton St
      Lawrenceville GA 30046
      COMMENTS OR SPECIAL INSTRUCTIONS:
      Due upon receipt
      QUANTITY DESCRIPTION UNIT PRICE TOTAL
      1 TB Cloud service 99.99 99.99
      Subtotal 99.99
      Sales tax 4.99
      Shipping and handling 0.00
      TOTAL DUE 104.98
    `);

    assert.ok(result);
    assert.equal(result.vendorName, "IMPACT 46");
    assert.equal(result.invoiceNumber, "100");
    assert.equal(result.poNumber, "260773");
    assert.equal(result.invoiceDate, "2026-01-31");
    assert.equal(result.buyerName, "Keith Lee");
    assert.equal(result.shipToName, "City of Lawrenceville");
    assert.equal(result.subtotal, "99.99");
    assert.equal(result.tax, "4.99");
    assert.equal(result.shipping, "0.00");
    assert.equal(result.totalDue, "104.98");
    assert.equal(result.lineItems[0].description, "Cloud service");
    assert.equal(result.lineItems[0].quantity, "1 TB");
    assert.equal(result.lineItems[0].unitPrice, "99.99");
    assert.equal(result.lineItems[0].lineTotal, "99.99");
    assert.equal(result.documentType, "invoice");
    assert.ok(result.candidates.some((candidate) => candidate.fieldName === "vendor_name" && candidate.selected));
    assert.ok(result.candidates.some((candidate) => candidate.fieldName === "total_due" && candidate.selected));
    assert.ok(
      result.candidates.some((candidate) =>
        (candidate.scoringReasons || []).some((reason) => reason.includes("header/vendor")),
      ),
    );
  });

  it("does not select buyer or ship-to names as the vendor", () => {
    const result = extractInvoiceMetadataFromText(`
      INVOICE # 987
      DATE 02/01/2026
      PO 260773
      BILL TO City of Lawrenceville
      SHIP TO Public Works Department
      Widget Supply LLC
      QTY DESCRIPTION UNIT PRICE LINE TOTAL
      1 EA Replacement part 10.00 10.00
      SUBTOTAL 10.00
      SALES TAX 0.00
      SHIPPING 0.00
      TOTAL DUE 10.00
    `);

    assert.ok(result);
    assert.notEqual(result.vendorName, "City of Lawrenceville");
    assert.notEqual(result.vendorName, "Public Works Department");
    assert.ok(
      result.candidates.some(
        (candidate) =>
          candidate.fieldName === "vendor_name" &&
          candidate.rawValue === "City of Lawrenceville" &&
          !candidate.selected,
      ),
    );
  });

  it("keeps invoice and PO labels from selecting each other's values", () => {
    const result = extractInvoiceMetadataFromText(`
      ACME SERVICES
      INVOICE # INV-4455
      PO 260773
      DATE 02/01/2026
      SUBTOTAL 25.00
      SALES TAX 0.00
      SHIPPING 0.00
      TOTAL DUE 25.00
    `);

    assert.ok(result);
    assert.equal(result.invoiceNumber, "INV-4455");
    assert.equal(result.poNumber, "260773");
  });

  it("does not select subtotal or unit price as total due when total due exists", () => {
    const result = extractInvoiceMetadataFromText(`
      ACME SERVICES
      INVOICE # INV-4455
      PO 260773
      DATE 02/01/2026
      QTY DESCRIPTION UNIT PRICE LINE TOTAL
      1 EA Replacement part 25.00 25.00
      SUBTOTAL 25.00
      SALES TAX 2.00
      SHIPPING 1.00
      TOTAL DUE 28.00
    `);

    assert.ok(result);
    assert.equal(result.totalDue, "28.00");
    assert.notEqual(result.totalDue, "25.00");
  });

  it("keeps filename fallback candidates low confidence and unselected", async () => {
    const result = await extractInvoiceMetadata(
      "unused.txt",
      "IMPACT_46_INV-100_PO-260773_104.98.txt",
      "text/plain",
    );

    assert.equal(result.provider, "filename_fallback");
    assert.ok(result.extractionConfidence < 0.5);
    assert.ok(result.candidates.every((candidate) => candidate.confidence < 0.5));
    assert.ok(result.candidates.every((candidate) => !candidate.selected));
  });
});
