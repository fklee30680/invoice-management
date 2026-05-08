import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractInvoiceMetadataFromText } from "./ocr";

describe("extractInvoiceMetadataFromText", () => {
  it("extracts and normalizes the sample invoice fields", () => {
    const result = extractInvoiceMetadataFromText(`
      IMPACT 46
      INVOICE # 100
      PO 260773
      DATE 01/31/2026
      PURCHASED BY Keith Lee
      SHIP TO City of Lawrenceville
      QTY DESCRIPTION UNIT PRICE LINE TOTAL
      1 TB Cloud service 99.99 99.99
      SUBTOTAL 99.99
      SALES TAX 4.99
      SHIPPING AND HANDLING 0.00
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
  });
});
