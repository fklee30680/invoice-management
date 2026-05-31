"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { submitDepartmentDecision } from "@/lib/actions";
import { PoValidationField } from "@/components/po-validation-field";

type DecisionOption = {
  id: string;
  label: string;
  requirePoNumber: boolean;
};

const decisionErrorMessages: Record<string, string> = {
  "comment-required":
    "A comment is required when sending the invoice back as not your department.",
  "po-required":
    "PO number is required for this decision. Please enter the PO number before submitting.",
  "po-not-found":
    "PO number was not found in the PO list. This invoice cannot move forward until a valid PO number is entered.",
  "po-vendor-mismatch":
    "Vendor mismatch must be resolved before this invoice can move forward.",
  "po-vendor-not-found":
    "The PO vendor was not found in the vendor file. Select a vendor from the vendor file before this invoice can move forward.",
  "vendor-required":
    "Select a valid vendor from the vendor file before submitting this decision.",
};

export function DepartmentDecisionForm({
  currentDecision,
  decisionError,
  decisionOptions,
  initialDecision,
  invoiceId,
  hasPoNumber,
  poNumberEnabled,
}: {
  currentDecision: string;
  decisionError?: string;
  decisionOptions: DecisionOption[];
  initialDecision: string;
  invoiceId: string;
  hasPoNumber: boolean;
  poNumberEnabled: boolean;
}) {
  const [decision, setDecision] = useState(initialDecision || currentDecision);
  const poInputRef = useRef<HTMLDivElement>(null);
  const requiresPo = useMemo(
    () => decisionOptions.some((option) => option.label === decision && option.requirePoNumber),
    [decision, decisionOptions],
  );
  const showPoInput = poNumberEnabled && requiresPo && !hasPoNumber;
  const decisionErrorMessage = decisionError ? decisionErrorMessages[decisionError] : undefined;
  const decisionStatusLabel =
    decision && decision === currentDecision ? "Decision submitted" : "Selected decision";
  const decisionStatusClass = decision
    ? "border-[var(--accent)] bg-white text-[var(--accent)]"
    : "border-[var(--line)] bg-white text-[var(--muted)]";
  const decisionErrorClass =
    decisionError === "po-required"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-red-300 bg-red-50 text-red-800";

  useEffect(() => {
    if (showPoInput) {
      poInputRef.current?.querySelector("input")?.focus();
    }
  }, [showPoInput]);

  return (
    <form
      action={submitDepartmentDecision}
      className="border border-[var(--line)] bg-[var(--panel)] p-4"
    >
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <h2 className="font-semibold">Decision</h2>
      <div className="mt-4 space-y-2" aria-live="polite">
        <div>
          <div className="text-xs font-semibold uppercase text-[var(--muted)]">
            Decision Status
          </div>
          <div className={`mt-1 border px-3 py-2 text-sm font-semibold ${decisionStatusClass}`}>
            {decision ? `${decisionStatusLabel}: ${decision}` : "No decision selected."}
          </div>
        </div>
        {decisionErrorMessage ? (
          <div
            className={`border px-3 py-2 text-sm font-semibold ${decisionErrorClass}`}
            role="alert"
          >
            {decisionErrorMessage}
          </div>
        ) : null}
      </div>
      <label className="mt-4 block text-xs font-semibold uppercase text-[var(--muted)]">
        Decision Type
        <select
          className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm font-normal normal-case text-[var(--foreground)]"
          name="decision"
          onChange={(event) => setDecision(event.currentTarget.value)}
          value={decision}
          required
        >
          <option value="">Select decision</option>
          {decisionOptions.map((option) => (
            <option key={option.id} value={option.label}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {showPoInput ? (
        <div className="mt-4 border border-amber-300 bg-amber-50 p-3">
          <div className="text-sm font-semibold text-amber-900">
            PO number is required for this decision. Please enter the PO number before submitting.
          </div>
          <div ref={poInputRef}>
            <PoValidationField invoiceId={invoiceId} required />
          </div>
        </div>
      ) : null}

      <label className="mt-4 block text-xs font-semibold uppercase text-[var(--muted)]">
        Comments
        <textarea
          className="focus-ring mt-1 min-h-28 w-full resize-y border border-[var(--line)] bg-white p-3 text-sm font-normal normal-case text-[var(--foreground)]"
          name="comment"
          placeholder="Add context for AP. Required if this invoice is not your department."
        />
      </label>
      <button className="focus-ring mt-4 w-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
        Submit Decision
      </button>
    </form>
  );
}
