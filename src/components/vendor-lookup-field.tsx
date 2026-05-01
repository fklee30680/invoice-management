"use client";

import { useMemo, useState } from "react";

export type VendorLookupOption = {
  vendorId: string;
  vendorName: string;
  vendorNumber: string;
  label: string;
};

export function VendorLookupField({
  extractedVendor,
  listId = "vendor-lookup-options",
  options,
  selectedVendorNumber,
}: {
  extractedVendor?: string;
  listId?: string;
  options: VendorLookupOption[];
  selectedVendorNumber?: string;
}) {
  const initial = useMemo(() => {
    const match = options.find((option) => option.vendorNumber === selectedVendorNumber);
    return match?.label || "";
  }, [options, selectedVendorNumber]);
  const [displayValue, setDisplayValue] = useState(initial);
  const selected = options.find((option) => option.label === displayValue);

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold uppercase text-[var(--muted)]">
        Vendor
        <input
          className="focus-ring mt-1 min-h-10 w-full border border-[var(--line)] px-3 text-sm font-normal normal-case text-[var(--foreground)]"
          defaultValue={initial}
          list={listId}
          onChange={(event) => setDisplayValue(event.currentTarget.value)}
          placeholder="Search vendor name or number"
        />
      </label>
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.vendorId} value={option.label} />
        ))}
      </datalist>
      <input name="vendorNumber" type="hidden" value={selected?.vendorNumber || ""} />
      <input name="vendorName" type="hidden" value={selected?.vendorName || ""} />
      {extractedVendor && !selected ? (
        <div className="text-xs text-[var(--muted)]">
          Extracted vendor: {extractedVendor}
        </div>
      ) : null}
      <div className="text-xs text-[var(--muted)]">
        Vendor must be selected from the vendor file before routing.
      </div>
      {displayValue && !selected ? (
        <div className="text-xs font-semibold text-amber-800">
          No matching vendors found. Add the vendor to the vendor file before routing.
        </div>
      ) : null}
    </div>
  );
}
