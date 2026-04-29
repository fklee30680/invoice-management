"use client";

import { useState } from "react";
import { deleteInvoice } from "@/lib/actions";

export function DeleteInvoiceConfirmation({ invoiceId }: { invoiceId: string }) {
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
            <h2 className="text-base font-semibold text-red-800">Delete invoice?</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              This will remove the invoice, related file records, and stored invoice
              file. This action cannot be undone.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                className="focus-ring border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-slate-100"
                onClick={() => setConfirming(false)}
                type="button"
              >
                Cancel
              </button>
              <form action={deleteInvoice}>
                <input name="invoiceId" type="hidden" value={invoiceId} />
                <input name="confirmDelete" type="hidden" value="yes" />
                <button className="focus-ring bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">
                  Delete Invoice
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
