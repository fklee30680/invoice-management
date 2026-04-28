import Image from "next/image";
import { requireApUser } from "@/lib/session";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireApUser();
  const data = await readData();
  const branding = data.branding;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="border-b border-[var(--line)] pb-5">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              {branding.logo ? (
                <Image
                  alt={`${branding.appTitle} logo`}
                  className="max-h-12 max-w-40 object-contain"
                  height={48}
                  src="/branding/logo"
                  unoptimized
                  width={160}
                />
              ) : null}
              <div>
                <p className="text-sm font-semibold uppercase tracking-normal text-[var(--accent)]">
                  AP Setup
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-normal">
                  Setup
                </h1>
              </div>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
              Configure the operational tables and messages used by the AP invoice
              workflow.
            </p>
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
