"use client";

import { useState } from "react";
import { deleteVendor } from "@/lib/actions";

export function DeleteVendorConfirmation({
  invoiceReferenceCount = 0,
  vendorId,
}: {
  invoiceReferenceCount?: number;
  vendorId: string;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        className="focus-ring border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
        onClick={() => setConfirming(true)}
        type="button"
      >
        Delete
      </button>
      {confirming ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md border border-red-200 bg-white p-4 shadow-xl">
            <h2 className="text-base font-semibold text-red-800">Delete this vendor?</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {invoiceReferenceCount > 0
                ? `This vendor is referenced by ${invoiceReferenceCount} invoice(s). Deleting it will not change those invoices, but future vendor validation will not find this vendor.`
                : "Existing invoices that already reference this vendor will not be changed, but future vendor validation will no longer find this vendor."}
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                className="focus-ring border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-slate-100"
                onClick={() => setConfirming(false)}
                type="button"
              >
                Cancel
              </button>
              <form action={deleteVendor}>
                <input name="vendorId" type="hidden" value={vendorId} />
                <input name="confirmDelete" type="hidden" value="yes" />
                <button className="focus-ring bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">
                  Delete Vendor
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
