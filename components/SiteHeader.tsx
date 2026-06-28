"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./site-header.css";

// The app had no global navigation — /live linked back to / but nothing linked
// forward, and the Signals panel was unreachable. This is the one nav for all surfaces.
const NAV = [
  { href: "/", label: "Pipeline", hint: "Review & approve outreach drafts" },
  { href: "/live", label: "Live", hint: "Reason about any company, live" },
  {
    href: "/signals",
    label: "Signals",
    hint: "The 52 buying triggers we watch",
  },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand" aria-label="Cutthrough home">
          <span className="site-brand-mark" aria-hidden>
            ◓
          </span>
          <span className="site-brand-name">Cutthrough</span>
          <span className="site-brand-tag">AI SDR</span>
        </Link>

        <nav className="site-nav" aria-label="Primary">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="site-nav-link"
                aria-current={active ? "page" : undefined}
                title={item.hint}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
