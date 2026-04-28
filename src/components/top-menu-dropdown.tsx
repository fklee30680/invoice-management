"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
        className="focus-ring flex min-h-10 items-center gap-2 border border-transparent px-3 text-sm font-semibold hover:border-[var(--line)] hover:bg-white"
        onClick={() => {
          setOpenedPath(pathname);
          setOpen((value) => !value);
        }}
        type="button"
      >
        {label}
        <span aria-hidden="true" className="text-[var(--muted)]">
          v
        </span>
      </button>
      {isOpen ? (
        <div className="absolute left-0 z-20 mt-1 min-w-56 border border-[var(--line)] bg-white py-1 shadow-lg">
          {links.map((link) => (
            <Link
              className="focus-ring block px-3 py-2 text-sm font-medium hover:bg-slate-100"
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
