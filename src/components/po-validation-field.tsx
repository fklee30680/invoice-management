"use client";

import { useEffect, useRef, useState } from "react";

type PoValidationResponse = {
  enabled: boolean;
  poNumber: string;
  found: boolean;
  invoiceVendorName: string;
  poVendorName?: string;
  vendorMatches: boolean;
  severity: "none" | "warning" | "blocking";
  message: string;
  allowVendorUpdateFromPo?: boolean;
  purchaseOrder?: { id: string; poNumber: string; vendorName: string };
};

export function PoValidationField({
  defaultValue,
  invoiceId,
  label = "PO Number",
  required = false,
}: {
  defaultValue?: string;
  invoiceId: string;
  label?: string;
  required?: boolean;
}) {
  const [result, setResult] = useState<PoValidationResponse | null>(null);
  const [showMismatch, setShowMismatch] = useState(false);
  const [showPoNotFound, setShowPoNotFound] = useState(false);
  const [action, setAction] = useState("");
  const [blockingMessage, setBlockingMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;

    function preventBlockedSubmit(event: SubmitEvent) {
      if (result?.severity === "blocking" && action !== "updateVendor") {
        event.preventDefault();
        setBlockingMessage(
          result.found
            ? "Vendor mismatch must be resolved before this invoice can move forward."
            : result.message,
        );
      }
    }

    form.addEventListener("submit", preventBlockedSubmit);
    return () => form.removeEventListener("submit", preventBlockedSubmit);
  }, [action, result]);

  async function validate() {
    const input = inputRef.current;
    const form = input?.form;
    if (!input || !form) return;
    const vendorInput = form.elements.namedItem("vendorName") as HTMLInputElement | null;
    const response = await fetch("/api/po-validation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId,
        poNumber: input.value,
        vendorName: vendorInput?.value || "",
      }),
    });
    if (!response.ok) return;
    const nextResult = (await response.json()) as PoValidationResponse;
    setResult(nextResult);
    setAction("");
    setBlockingMessage("");
    setShowPoNotFound(false);
    if (
      nextResult.enabled &&
      nextResult.found &&
      !nextResult.vendorMatches &&
      nextResult.severity !== "none"
    ) {
      setShowMismatch(true);
    }
    if (nextResult.enabled && !nextResult.found && nextResult.poNumber) {
      setShowPoNotFound(true);
    }
  }

  function updateVendor() {
    const form = inputRef.current?.form;
    const vendorInput = form?.elements.namedItem("vendorName") as HTMLInputElement | null;
    if (vendorInput && result?.poVendorName) {
      vendorInput.value = result.poVendorName;
      vendorInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setAction("updateVendor");
    setBlockingMessage("");
    setShowMismatch(false);
  }

  function keepVendor() {
    setAction("keepVendor");
    setBlockingMessage(
      "Vendor mismatch must be resolved before this invoice can move forward.",
    );
    setShowMismatch(false);
  }

  return (
    <>
      <label className="text-xs font-semibold uppercase text-[var(--muted)]">
        {label}
        <input
          className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] px-3 text-sm font-normal normal-case text-[var(--foreground)]"
          defaultValue={defaultValue}
          name="poNumber"
          onBlur={validate}
          ref={inputRef}
          required={required}
        />
      </label>
      <input name="poValidationAction" type="hidden" value={action} />
      {result?.purchaseOrder?.id ? (
        <input name="poValidationPurchaseOrderId" type="hidden" value={result.purchaseOrder.id} />
      ) : null}
      {result?.severity === "warning" && !showMismatch ? (
        <div className="text-xs font-medium text-amber-800">{result.message}</div>
      ) : null}
      {blockingMessage ? (
        <div className="text-xs font-semibold text-red-700">{blockingMessage}</div>
      ) : null}
      {result?.enabled && result.severity === "none" && result.found ? (
        <div className="text-xs font-medium text-emerald-700">PO matched</div>
      ) : null}
      {showMismatch && result ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg border border-amber-300 bg-white p-4 shadow-xl">
            <h2 className="text-base font-semibold text-amber-900">Vendor Mismatch</h2>
            <p className="mt-2 text-sm text-[var(--foreground)]">
              PO {result.poNumber} was found, but the PO vendor does not match
              the invoice vendor.
            </p>
            <div className="mt-3 grid gap-2 border border-[var(--line)] bg-[var(--panel)] p-3 text-sm">
              <div>
                <span className="font-semibold">Invoice Vendor:</span>{" "}
                {result.invoiceVendorName || "Not set"}
              </div>
              <div>
                <span className="font-semibold">PO Vendor:</span>{" "}
                {result.poVendorName || "Not set"}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                className="focus-ring border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-slate-100"
                onClick={keepVendor}
                type="button"
              >
                Keep Current Vendor
              </button>
              {result.allowVendorUpdateFromPo !== false ? (
                <button
                  className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
                  onClick={updateVendor}
                  type="button"
                >
                  Update Vendor
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {showPoNotFound && result ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md border border-amber-300 bg-white p-4 shadow-xl">
            <h2 className="text-base font-semibold text-amber-900">PO Not Found</h2>
            <p className="mt-2 text-sm text-[var(--foreground)]">
              PO {result.poNumber} was not found in the PO list.
            </p>
            {result.severity === "blocking" ? (
              <p className="mt-2 text-sm font-semibold text-red-700">
                This invoice cannot move forward until a valid PO number is entered.
              </p>
            ) : null}
            <div className="mt-4 flex justify-end">
              <button
                className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
                onClick={() => setShowPoNotFound(false)}
                type="button"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
