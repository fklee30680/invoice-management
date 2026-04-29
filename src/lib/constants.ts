import type { DepartmentDecisionDefinition } from "./types";

export function defaultDepartmentDecisions(): DepartmentDecisionDefinition[] {
  return [
    {
      id: "decision-receiving-record",
      label: "Receiving Record",
      workflowAction: "complete",
      requireComment: false,
      active: true,
    },
    {
      id: "decision-p-card",
      label: "P-Card",
      workflowAction: "complete",
      requireComment: false,
      active: true,
    },
    {
      id: "decision-request-check",
      label: "Request for Check",
      workflowAction: "complete",
      requireComment: false,
      active: true,
    },
    {
      id: "decision-reject",
      label: "Reject",
      workflowAction: "reject",
      requireComment: false,
      active: true,
    },
    {
      id: "decision-hold",
      label: "Hold",
      workflowAction: "hold",
      requireComment: false,
      active: true,
    },
    {
      id: "decision-not-our-department",
      label: "Not our Department Invoice",
      workflowAction: "apRework",
      requireComment: true,
      active: true,
    },
  ];
}
