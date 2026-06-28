"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FLOW } from "./flow";
import "./site-header.css";

// One nav for all surfaces — rendered as a numbered stepper (not scattered tabs) so the
// four surfaces read as a single pipeline: Graveyard → Why → Re-trigger → Send. The
// arrows + step numbers make the flow legible at a glance, on every page.
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

        <nav className="site-nav site-flow" aria-label="Pipeline flow">
          {FLOW.map((item, i) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Fragment key={item.href}>
                {i > 0 && (
                  <span className="site-flow-arrow" aria-hidden>
                    →
                  </span>
                )}
                <Link
                  href={item.href}
                  className="site-nav-link site-flow-link"
                  aria-current={active ? "page" : undefined}
                  title={item.hint}
                >
                  <span className="site-flow-num" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="site-flow-label">{item.label}</span>
                </Link>
              </Fragment>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
