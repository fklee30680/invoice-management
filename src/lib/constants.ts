import type { DepartmentDecision, WorkflowStatus } from "./types";

export const WORKFLOW_STATUSES: WorkflowStatus[] = [
  "Uploaded",
  "Needs AP Review",
  "Routed",
  "Approved/Completed",
  "Rejected",
  "Hold",
];

export const DEPARTMENT_DECISIONS: DepartmentDecision[] = [
  "Receiving Record",
  "P-Card",
  "Request for Check",
  "Reject",
  "Hold",
  "Not our Department Invoice",
];

export const AP_USER_ID = "user-ap-admin";
