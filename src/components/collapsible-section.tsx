import type { ReactNode } from "react";

export function CollapsibleSection({
  children,
  defaultOpen = false,
  summaryText = "Collapsed",
  title,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  summaryText?: string;
  title: string;
}) {
  return (
    <section className="border border-[var(--line)] bg-[var(--panel)]">
      <details open={defaultOpen}>
        <summary className="focus-ring flex cursor-pointer list-none flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>
            <span className="font-semibold">{title}</span>
            <span className="ml-2 text-[var(--muted)]">{summaryText}</span>
          </span>
          <span className="text-xs font-semibold uppercase text-[var(--muted)]">
            Expand / Collapse
          </span>
        </summary>
        <div className="border-t border-[var(--line)] p-4">{children}</div>
      </details>
    </section>
  );
}
