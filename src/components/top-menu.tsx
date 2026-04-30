import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/lib/auth-actions";
import { INVOICE_SUMMARY_VIEWS, summaryViewPath } from "@/lib/invoice-views";
import type { BrandingSettings, User } from "@/lib/types";
import { TOP_MENU_ITEM_CLASS, TOP_MENU_PRIMARY_ACTION_CLASS } from "./menu-styles";
import { TopMenuDropdown } from "./top-menu-dropdown";

const setupLinks = [
  { href: "/settings/branding", label: "Branding" },
  { href: "/settings/decisions", label: "Decision Types" },
  { href: "/settings/departments", label: "Department Emails" },
  { href: "/settings/email", label: "Email Templates" },
  { href: "/settings/environment", label: "Environment" },
  { href: "/settings/escalation-schedules", label: "Escalation Schedules" },
  { href: "/settings/holidays-business-days", label: "Holidays And Business Days" },
  { href: "/settings/organization-escalation-contacts", label: "Organization Escalation Contacts" },
  { href: "/settings/scheduler", label: "Scheduler Runtime" },
  { href: "/settings/statuses", label: "Statuses" },
];

const uploadLinks = [
  { href: "/files/payment-file", label: "Payment File" },
  { href: "/uploads/po-list", label: "PO List Update" },
  { href: "/uploads/vendors", label: "Vendor File" },
];

function MenuLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className={TOP_MENU_ITEM_CLASS} href={href}>
      {label}
    </Link>
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
              <MenuLink href="/audit" label="Audit Log" />
              <MenuLink href="/" label="Dashboard" />
              <TopMenuDropdown label="Files" links={uploadLinks} />
              <TopMenuDropdown label="Invoices" links={invoiceLinks} />
              <MenuLink href="/reports" label="Reports" />
              <TopMenuDropdown label="Setup" links={setupLinks} />
            </>
          ) : null}

          {user?.role === "DEPARTMENT" ? (
            <MenuLink href="/department" label="Department Dashboard" />
          ) : null}

          {user ? (
            <form action={signOut}>
              <button className={TOP_MENU_PRIMARY_ACTION_CLASS}>
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
