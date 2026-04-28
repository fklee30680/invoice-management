import { EnvironmentStatus } from "@/components/environment-status";
import { getPersistenceStatus } from "@/lib/runtime-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const packageVersions = {
  next: "16.2.4",
  react: "19.2.4",
  blob: "^2.3.3",
  neon: "^1.1.0",
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-[var(--line)] px-3 py-3 text-sm sm:grid-cols-[220px_1fr]">
      <div className="font-semibold text-[var(--muted)]">{label}</div>
      <div className="font-mono text-xs text-[var(--foreground)]">{value}</div>
    </div>
  );
}

export default function EnvironmentSettingsPage() {
  const status = getPersistenceStatus();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Environment</h2>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Technical deployment and storage details for the invoice management app.
          This page is intended for setup and troubleshooting.
        </p>
      </div>

      <EnvironmentStatus status={status} />

      <section className="border border-[var(--line)] bg-[var(--panel)]">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h3 className="font-semibold">Runtime Details</h3>
        </div>
        <DetailRow label="Running on Vercel" value={status.isVercel ? "yes" : "no"} />
        <DetailRow label="Database environment variable" value={status.records.variableName} />
        <DetailRow label="File storage environment variable" value={status.files.variableName} />
        <DetailRow label="Record storage provider" value={status.records.provider} />
        <DetailRow label="File storage provider" value={status.files.provider} />
      </section>

      <section className="border border-[var(--line)] bg-[var(--panel)]">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h3 className="font-semibold">Build Details</h3>
        </div>
        <DetailRow label="Next.js" value={packageVersions.next} />
        <DetailRow label="React" value={packageVersions.react} />
        <DetailRow label="Vercel Blob package" value={packageVersions.blob} />
        <DetailRow label="Neon Postgres package" value={packageVersions.neon} />
      </section>
    </section>
  );
}
