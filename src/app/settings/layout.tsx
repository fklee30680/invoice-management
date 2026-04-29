import { requireApUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireApUser();

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="border-b border-[var(--line)] pb-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-normal">
              Setup
            </h1>
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
