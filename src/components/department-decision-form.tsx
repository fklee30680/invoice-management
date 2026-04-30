"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { submitDepartmentDecision } from "@/lib/actions";

type DecisionOption = {
  id: string;
  label: string;
  requirePoNumber: boolean;
};

export function DepartmentDecisionForm({
  currentDecision,
  decisionOptions,
  initialDecision,
  invoiceId,
  poRequiredError,
  hasPoNumber,
  poNumberEnabled,
}: {
  currentDecision: string;
  decisionOptions: DecisionOption[];
  initialDecision: string;
  invoiceId: string;
  poRequiredError: boolean;
  hasPoNumber: boolean;
  poNumberEnabled: boolean;
}) {
  const [decision, setDecision] = useState(initialDecision || currentDecision);
  const poInputRef = useRef<HTMLInputElement>(null);
  const requiresPo = useMemo(
    () => decisionOptions.some((option) => option.label === decision && option.requirePoNumber),
    [decision, decisionOptions],
  );
  const showPoInput = poNumberEnabled && requiresPo && !hasPoNumber;

  useEffect(() => {
    if (showPoInput) {
      poInputRef.current?.focus();
    }
  }, [showPoInput]);

  return (
    <form
      action={submitDepartmentDecision}
      className="border border-[var(--line)] bg-[var(--panel)] p-4"
    >
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <h2 className="font-semibold">Decision</h2>
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
          <label className="mt-3 block text-xs font-semibold uppercase text-amber-900">
            PO Number
            <input
              className={`focus-ring mt-1 min-h-10 w-full border px-3 text-sm font-normal normal-case text-[var(--foreground)] ${
                poRequiredError ? "border-red-500 bg-red-50" : "border-amber-400 bg-white"
              }`}
              name="poNumber"
              ref={poInputRef}
              required
            />
          </label>
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
