"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SUBMENU_ITEM_CLASS, TOP_MENU_ITEM_CLASS } from "./menu-styles";

export type TopMenuDropdownLink = {
  href: string;
  label: string;
};

export function TopMenuDropdown({
  label,
  links,
}: {
  label: string;
  links: TopMenuDropdownLink[];
}) {
  const [open, setOpen] = useState(false);
  const [openedPath, setOpenedPath] = useState("");
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const isOpen = open && openedPath === pathname;
  const sortedLinks = [...links].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-expanded={isOpen}
        className={`${TOP_MENU_ITEM_CLASS} gap-2`}
        onClick={() => {
          setOpenedPath(pathname);
          setOpen((value) => !value);
        }}
        type="button"
      >
        <span className="font-bold">{label}</span>
        <span aria-hidden="true" className="text-[var(--muted)]">
          v
        </span>
      </button>
      {isOpen ? (
        <div className="absolute left-0 z-20 mt-1 min-w-56 border border-[var(--line)] bg-white py-1 shadow-lg">
          {sortedLinks.map((link) => (
            <Link
              className={SUBMENU_ITEM_CLASS}
              href={link.href}
              key={link.href}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
