"use client";

import { resetMenuSettings } from "@/lib/actions";

export function ResetMenuButton() {
  return (
    <form
      action={resetMenuSettings}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Reset menu to the default layout? This will replace your current menu labels, groups, and order.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <button className="focus-ring border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
        Reset Menu to Default
      </button>
    </form>
  );
}
