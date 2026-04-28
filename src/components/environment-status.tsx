import type { PersistenceStatus } from "@/lib/runtime-config";

function statusLabels(status: PersistenceStatus) {
  return {
    database: status.records.issue
      ? "Postgres configured but unavailable"
      : status.records.configured
        ? "Postgres active"
        : "Temporary storage",
    files: status.files.issue
      ? "Blob configured but unavailable"
      : status.files.configured
        ? "Vercel Blob active"
        : "Temporary storage",
  };
}

export function EnvironmentStatus({ status }: { status: PersistenceStatus }) {
  const itemClass = "border border-[var(--line)] bg-white px-3 py-2";
  const goodClass = "text-emerald-700";
  const warnClass = "text-amber-700";
  const labels = statusLabels(status);

  return (
    <section className="grid gap-3 text-sm md:grid-cols-2">
      <div className={itemClass}>
        <div className="text-xs font-semibold uppercase text-[var(--muted)]">
          Database
        </div>
        <div className={`mt-1 font-semibold ${status.records.configured && !status.records.issue ? goodClass : warnClass}`}>
          {labels.database}
        </div>
        <div className="mt-1 text-xs text-[var(--muted)]">
          Env: {status.records.variableName}
        </div>
        <div className="mt-1 text-xs text-[var(--muted)]">
          Provider: {status.records.provider}
        </div>
        {status.records.issue ? (
          <div className="mt-2 text-xs text-amber-800">
            Last error: {status.records.issue}
          </div>
        ) : null}
      </div>
      <div className={itemClass}>
        <div className="text-xs font-semibold uppercase text-[var(--muted)]">
          File Storage
        </div>
        <div className={`mt-1 font-semibold ${status.files.configured && !status.files.issue ? goodClass : warnClass}`}>
          {labels.files}
        </div>
        <div className="mt-1 text-xs text-[var(--muted)]">
          Env: {status.files.variableName}
        </div>
        <div className="mt-1 text-xs text-[var(--muted)]">
          Provider: {status.files.provider}
        </div>
        {status.files.issue ? (
          <div className="mt-2 text-xs text-amber-800">
            Last error: {status.files.issue}
          </div>
        ) : null}
      </div>
      {status.warning ? (
        <div className="border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 md:col-span-2">
          {status.warning}
        </div>
      ) : null}
    </section>
  );
}
