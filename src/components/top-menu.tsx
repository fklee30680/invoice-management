import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/lib/auth-actions";
import { INVOICE_SUMMARY_VIEWS, summaryViewPath } from "@/lib/invoice-views";
import type { BrandingSettings, User } from "@/lib/types";

const setupLinks = [
  { href: "/settings/email", label: "Email Template" },
  { href: "/settings/departments", label: "Department Emails" },
  { href: "/settings/statuses", label: "Statuses" },
  { href: "/settings/branding", label: "Branding" },
];

function MenuLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      className="focus-ring block px-3 py-2 text-sm font-medium hover:bg-slate-100"
      href={href}
    >
      {label}
    </Link>
  );
}

function MenuGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <details className="relative">
      <summary className="focus-ring flex min-h-10 cursor-pointer list-none items-center gap-2 border border-transparent px-3 text-sm font-semibold hover:border-[var(--line)] hover:bg-white">
        {label}
        <span aria-hidden="true" className="text-[var(--muted)]">
          v
        </span>
      </summary>
      <div className="absolute left-0 z-20 mt-1 min-w-56 border border-[var(--line)] bg-white py-1 shadow-lg">
        {children}
      </div>
    </details>
  );
}

export function TopMenu({
  branding,
  user,
}: {
  branding: BrandingSettings;
  user?: User;
}) {
  const invoiceLinks = Object.entries(INVOICE_SUMMARY_VIEWS).map(([view, config]) => ({
    href: summaryViewPath(view as keyof typeof INVOICE_SUMMARY_VIEWS),
    label: config.label,
  }));

  return (
    <header className="border-b border-[var(--line)] bg-[var(--panel)] px-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-3 py-2">
        <Link className="focus-ring flex items-center gap-3" href={user?.role === "DEPARTMENT" ? "/department" : "/"}>
          {branding.logo ? (
            <Image
              alt={`${branding.appTitle} logo`}
              className="max-h-9 max-w-32 object-contain"
              height={36}
              src="/branding/logo"
              unoptimized
              width={128}
            />
          ) : null}
          <span className="font-semibold">{branding.appTitle}</span>
        </Link>

        <nav className="flex flex-wrap items-center gap-1">
          {user?.role === "AP" ? (
            <>
              <MenuLink href="/" label="Dashboard" />
              <MenuGroup label="Invoices">
                {invoiceLinks.map((link) => (
                  <MenuLink href={link.href} key={link.href} label={link.label} />
                ))}
              </MenuGroup>
              <MenuGroup label="Setup">
                {setupLinks.map((link) => (
                  <MenuLink href={link.href} key={link.href} label={link.label} />
                ))}
              </MenuGroup>
              <MenuLink href="/audit" label="Audit Log" />
            </>
          ) : null}

          {user?.role === "DEPARTMENT" ? (
            <MenuLink href="/department" label="Department Dashboard" />
          ) : null}

          {user ? (
            <form action={signOut}>
              <button className="focus-ring min-h-10 border border-[var(--line)] bg-white px-3 text-sm font-semibold hover:bg-slate-100">
                Sign Out
              </button>
            </form>
          ) : (
            <MenuLink href="/login" label="Sign In" />
          )}
        </nav>
      </div>
    </header>
  );
}
