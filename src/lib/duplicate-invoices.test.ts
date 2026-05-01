import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findDuplicateInvoices } from "./duplicate-invoices";
import type { Invoice } from "./types";

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1",
    vendorName: "ABC Supply LLC",
    vendorNumber: "V-100",
    invoiceNumber: "INV-1001",
    invoiceDate: "2026-04-01",
    amount: "100",
    poNumber: "",
    dateReceived: "2026-04-01",
    dateApproved: "",
    dateUploaded: "2026-04-01",
    dateSubmittedToDepartment: "",
    statusDate: "2026-04-01",
    routedAt: "",
    status: "Needs AP Review",
    departmentId: "",
    departmentDecision: "",
    paymentProcessed: false,
    escalations: [],
    comments: [],
    fileId: "file-1",
    notificationSentAt: "",
    ocrSummary: "",
    createdAt: "2026-04-01T12:00:00.000Z",
    updatedAt: "2026-04-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("findDuplicateInvoices", () => {
  it("matches the same vendor number and invoice number", () => {
    const result = findDuplicateInvoices(invoice(), [
      invoice({ id: "invoice-2", vendorNumber: " v-100 ", invoiceNumber: "inv 1001" }),
    ]);

    assert.equal(result.status, "Potential Duplicate");
    assert.deepEqual(
      result.matchedInvoices.map((match) => match.invoiceId),
      ["invoice-2"],
    );
  });

  it("does not match a different vendor number or invoice number", () => {
    assert.equal(
      findDuplicateInvoices(invoice(), [
        invoice({ id: "invoice-2", vendorNumber: "V-200" }),
      ]).status,
      "No Duplicate",
    );
    assert.equal(
      findDuplicateInvoices(invoice(), [
        invoice({ id: "invoice-3", invoiceNumber: "INV-1007" }),
      ]).status,
      "No Duplicate",
    );
  });

  it("excludes the current invoice and deleted invoices", () => {
    const result = findDuplicateInvoices(invoice(), [
      invoice(),
      invoice({ id: "invoice-2", status: "Deleted" }),
    ]);

    assert.equal(result.status, "No Duplicate");
  });

  it("uses vendor name fallback only when vendor number is missing", () => {
    const current = invoice({ vendorNumber: "" });
    const result = findDuplicateInvoices(current, [
      invoice({
        id: "invoice-2",
        vendorName: "ABC Supply",
        vendorNumber: "OTHER",
      }),
    ]);

    assert.equal(result.status, "Potential Duplicate");
  });

  it("does not fuzzy-match invoice numbers", () => {
    const result = findDuplicateInvoices(invoice(), [
      invoice({ id: "invoice-2", invoiceNumber: "INV-1007" }),
    ]);

    assert.equal(result.status, "No Duplicate");
  });
});
