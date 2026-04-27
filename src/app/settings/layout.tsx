import Link from "next/link";
import Image from "next/image";
import { requireApUser } from "@/lib/session";
import { readData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const setupLinks = [
  {
    href: "/settings/email",
    label: "Email Template",
    description: "Department notification subject and message.",
  },
  {
    href: "/settings/departments",
    label: "Department Emails",
    description: "Department routing names and recipient addresses.",
  },
  {
    href: "/settings/branding",
    label: "Branding",
    description: "Logo, colors, fonts, and display names.",
  },
];

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireApUser();
  const data = await readData();
  const branding = data.branding;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              className="focus-ring inline-flex border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-100"
              href="/"
            >
              Back to Dashboard
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-3">
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
          <div className="border border-[var(--line)] bg-white px-4 py-3 text-sm">
            <div className="font-semibold">{user.name}</div>
            <div className="mt-1 text-[var(--muted)]">AP access required</div>
          </div>
        </header>

        <nav className="grid gap-3 md:grid-cols-3">
          {setupLinks.map((link) => (
            <Link
              className="focus-ring border border-[var(--line)] bg-white px-4 py-3 text-sm hover:border-[var(--accent)] hover:bg-teal-50"
              href={link.href}
              key={link.href}
            >
              <div className="font-semibold text-[var(--foreground)]">
                {link.label}
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                {link.description}
              </div>
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </main>
  );
}
