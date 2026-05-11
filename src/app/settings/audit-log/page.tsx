import Link from "next/link";
import {
  restoreAuditLogSettings,
  updateAuditLogSettings,
} from "@/lib/actions";
import {
  auditLogFilterFields,
  defaultAuditLogSettings,
} from "@/lib/audit-log";
import { requireApUser } from "@/lib/session";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuditLogSetupPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const inputClass =
  "focus-ring mt-1 min-h-10 w-full border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)]";
const labelClass = "text-xs font-semibold uppercase text-[var(--muted)]";

function firstQueryValue(
  query: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = query[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function AuditLogSetupPage({
  searchParams,
}: AuditLogSetupPageProps) {
  await requireApUser();
  const data = await readData();
  const query = (await searchParams) || {};
  const error = firstQueryValue(query, "error");
  const saved = firstQueryValue(query, "saved");
  const restored = firstQueryValue(query, "restored");
  const settings = data.auditLogSettings;
  const defaults = defaultAuditLogSettings();
  const enabledFilters = new Set(settings.enabledFilterFields);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal">Audit Log Setup</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Configure audit log retention policy and which filters appear on the Audit Log page.
            </p>
          </div>
          <Link
            className="focus-ring inline-flex self-start border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 sm:self-auto"
            href="/audit"
          >
            Back to Audit Log
          </Link>
        </header>

        {saved ? (
          <div className="border border-green-300 bg-green-50 px-4 py-3 text-sm font-semibold text-green-900">
            Audit log settings saved.
          </div>
        ) : null}
        {restored ? (
          <div className="border border-green-300 bg-green-50 px-4 py-3 text-sm font-semibold text-green-900">
            Default audit log settings restored.
          </div>
        ) : null}
        {error === "invalid-retention" ? (
          <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            Retention period must be between 3 and 25 years.
          </div>
        ) : null}
        {error === "filters-required" ? (
          <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            Select at least one audit log filter.
          </div>
        ) : null}

        <form action={updateAuditLogSettings} className="space-y-5">
          <section className="border border-[var(--line)] bg-[var(--panel)] p-4">
            <div>
              <h2 className="text-base font-semibold">Retention Settings</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Changing retention settings does not delete existing audit records. Purge or archive
                behavior must be run separately.
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className={labelClass}>
                Retention Period, Years
                <input
                  className={inputClass}
                  defaultValue={settings.retentionYears}
                  max={25}
                  min={3}
                  name="retentionYears"
                  type="number"
                />
                <span className="mt-1 block text-xs font-normal normal-case text-[var(--muted)]">
                  Recommended default is {defaults.retentionYears} years. This defines policy only.
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm">
                <input
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  defaultChecked={settings.retainSecurityEventsPermanently}
                  name="retainSecurityEventsPermanently"
                  type="checkbox"
                />
                <span>
                  <span className="block font-semibold">
                    Retain Security/User Access Events Permanently
                  </span>
                  <span className="text-[var(--muted)]">
                    Recommended for sign-in, access, role, and permission changes when recorded.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm">
                <input
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  defaultChecked={settings.retainInvoiceEventsPermanently}
                  name="retainInvoiceEventsPermanently"
                  type="checkbox"
                />
                <span>
                  <span className="block font-semibold">Retain Invoice Events Permanently</span>
                  <span className="text-[var(--muted)]">
                    Use only when invoice workflow audit history should never expire.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm">
                <input
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  defaultChecked={settings.retainSetupEventsPermanently}
                  name="retainSetupEventsPermanently"
                  type="checkbox"
                />
                <span>
                  <span className="block font-semibold">Retain Setup Changes Permanently</span>
                  <span className="text-[var(--muted)]">
                    Recommended because setup changes affect workflow behavior.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm">
                <input
                  className="mt-1 h-4 w-4 accent-[var(--accent)]"
                  defaultChecked={settings.allowManualPurge}
                  name="allowManualPurge"
                  type="checkbox"
                />
                <span>
                  <span className="block font-semibold">Allow Manual Purge</span>
                  <span className="text-[var(--muted)]">
                    Controls whether a future manual purge option may be shown. This page does not
                    purge records automatically.
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section className="border border-[var(--line)] bg-[var(--panel)] p-4">
            <div>
              <h2 className="text-base font-semibold">Audit Log Filters</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Select which filters should appear on the Audit Log page.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {auditLogFilterFields.map((field) => (
                <label
                  className="flex items-center gap-3 border border-[var(--line)] bg-white px-3 py-2 text-sm"
                  key={field.key}
                >
                  <input
                    className="h-4 w-4 accent-[var(--accent)]"
                    defaultChecked={enabledFilters.has(field.key)}
                    name="enabledFilterFields"
                    type="checkbox"
                    value={field.key}
                  />
                  <span className="font-medium">{field.label}</span>
                </label>
              ))}
            </div>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button className="focus-ring bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
              Save Audit Log Settings
            </button>
          </div>
        </form>

        <form
          action={restoreAuditLogSettings}
          className="border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Restore Defaults</h2>
              <p className="mt-1">
                Restore the default retention policy and default Audit Log filters.
              </p>
            </div>
            <button className="focus-ring border border-amber-600 bg-white px-3 py-2 text-sm font-semibold hover:bg-amber-100">
              Restore Default Audit Log Settings
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
