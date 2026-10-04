"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/employees", label: "Employees" },
  { href: "/admin/rewards", label: "Rewards" },
  { href: "/admin/tiers", label: "Tiers" },
  { href: "/admin/reports", label: "Reports" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="admin-nav" style={{ marginTop: 16 }} aria-label="Admin">
      {LINKS.map((l) => {
        const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
