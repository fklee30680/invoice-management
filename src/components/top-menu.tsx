import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/lib/auth-actions";
import { menuItemAvailable, menuItemRoles } from "@/lib/menu-registry";
import type { BrandingSettings, MenuConfigItem, MenuSettings, User } from "@/lib/types";
import { TOP_MENU_ITEM_CLASS, TOP_MENU_PRIMARY_ACTION_CLASS } from "./menu-styles";
import { TopMenuDropdown } from "./top-menu-dropdown";

function MenuLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className={TOP_MENU_ITEM_CLASS} href={href}>
      {label}
    </Link>
  );
}

export function TopMenu({
  branding,
  menuSettings,
  user,
}: {
  branding: BrandingSettings;
  menuSettings: MenuSettings;
  user?: User;
}) {
  const menuItems = user
    ? menuSettings.items
        .filter((item) => menuItemVisibleForRole(item, user.role))
        .sort((left, right) => left.order - right.order)
    : [];

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
          {menuItems.map((item) => (
            <MenuItem item={item} key={item.id} role={user?.role} />
          ))}

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

function MenuItem({
  item,
  role,
}: {
  item: MenuConfigItem;
  role?: User["role"];
}) {
  if (item.type === "group") {
    const links = (item.children || [])
      .filter((child) => role && menuItemVisibleForRole(child, role))
      .sort((left, right) => left.order - right.order)
      .map((child) => ({ href: child.href || "", label: child.label }));
    if (links.length === 0) return null;
    return <TopMenuDropdown label={item.label} links={links} />;
  }

  if (!item.href) return null;
  return <MenuLink href={item.href} label={item.label} />;
}

function menuItemVisibleForRole(item: MenuConfigItem, role: User["role"]) {
  return item.enabled && menuItemAvailable(item) && menuItemRoles(item).includes(role);
}
