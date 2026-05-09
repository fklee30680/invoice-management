import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterableStatuses,
  statusBadgeClass,
  statusesForApWorkQueue,
  statusesForCompleted,
  statusesForDepartmentWork,
  statusesForEscalation,
  statusesForPaymentFile,
} from "./status-config";
import type { AppData, InvoiceStatusDefinition } from "./types";

function dataWithStatuses(statuses: InvoiceStatusDefinition[]) {
  return { statuses } as AppData;
}

const inactiveStatus: InvoiceStatusDefinition = {
  id: "status-custom-inactive",
  label: "Legacy Review",
  active: false,
  tone: "purple",
  showInFilter: true,
  showInApWorkQueue: true,
  showInDepartmentWork: true,
  showInCompleted: true,
  includeInEscalation: true,
  includeInPaymentFile: true,
};

const activeStatus: InvoiceStatusDefinition = {
  id: "status-custom-active",
  label: "Active Review",
  active: true,
  tone: "amber",
  showInFilter: true,
  showInApWorkQueue: true,
  showInDepartmentWork: true,
  showInCompleted: true,
  includeInEscalation: true,
  includeInPaymentFile: true,
};

describe("status configuration active flag", () => {
  it("uses inactive statuses for historical badge display", () => {
    const data = dataWithStatuses([inactiveStatus]);

    assert.match(statusBadgeClass(data, "Legacy Review"), /purple/);
  });

  it("excludes inactive statuses from operational status helpers", () => {
    const data = dataWithStatuses([inactiveStatus, activeStatus]);

    assert.deepEqual(
      filterableStatuses(data).map((status) => status.label),
      ["Active Review"],
    );
    assert.deepEqual(statusesForApWorkQueue(data), ["Active Review"]);
    assert.deepEqual(statusesForDepartmentWork(data), ["Active Review"]);
    assert.deepEqual(statusesForCompleted(data), ["Active Review"]);
    assert.deepEqual(statusesForEscalation(data), ["Active Review"]);
    assert.deepEqual(statusesForPaymentFile(data), ["Active Review"]);
  });
});
