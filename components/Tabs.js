"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "./I18n";

const TABS = [
  { href: "/", label: "tabs.days" },
  { href: "/year", label: "tabs.year" },
  { href: "/history", label: "tabs.history" },
  { href: "/settings", label: "tabs.settings" },
];

export default function Tabs() {
  const pathname = usePathname();
  const t = useT();
  return (
    <nav className="tabs" aria-label={t("tabs.label")}>
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={pathname === tab.href ? "page" : undefined}>
          {t(tab.label)}
        </Link>
      ))}
    </nav>
  );
}
