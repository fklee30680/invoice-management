import type { DepartmentDecisionDefinition } from "./types";

export function defaultDepartmentDecisions(): DepartmentDecisionDefinition[] {
  return [
    {
      id: "decision-receiving-record",
      label: "Receiving Record",
      workflowAction: "complete",
      requireComment: false,
      requirePoNumber: true,
      includeInPaymentFile: true,
      active: true,
    },
    {
      id: "decision-p-card",
      label: "P-Card",
      workflowAction: "complete",
      requireComment: false,
      requirePoNumber: false,
      includeInPaymentFile: false,
      active: true,
    },
    {
      id: "decision-request-check",
      label: "Request for Check",
      workflowAction: "complete",
      requireComment: false,
      requirePoNumber: false,
      includeInPaymentFile: true,
      active: true,
    },
    {
      id: "decision-reject",
      label: "Reject",
      workflowAction: "reject",
      requireComment: false,
      requirePoNumber: false,
      includeInPaymentFile: false,
      active: true,
    },
    {
      id: "decision-hold",
      label: "Hold",
      workflowAction: "hold",
      requireComment: false,
      requirePoNumber: false,
      includeInPaymentFile: false,
      active: true,
    },
    {
      id: "decision-not-our-department",
      label: "Not our Department Invoice",
      workflowAction: "apRework",
      requireComment: true,
      requirePoNumber: false,
      includeInPaymentFile: false,
      active: true,
    },
  ];
}
