import Link from "next/link";
import type { ReactNode } from "react";
import { MedicalAdviceDisclaimer } from "@/app/components/MedicalAdviceDisclaimer";
import { cn } from "@/lib/utils";
import { LiveCallStrip } from "./LiveCallStrip";

/**
 * The frame every clinician surface sits in.
 *
 * This is the dense half of the product, and the frame says so: a thin fixed
 * bar of navigation and provenance, then the page. No hero, no whitespace
 * budget. The family view spends its screen on calm; a worklist spends it on
 * rows. Live check-in is a hub mode — not a peer nav destination.
 */

const NAV = [
  { href: "/clinician", label: "Hub" },
  { href: "/clinician/engine", label: "Rule engine" },
];

export function ClinicianShell({
  active,
  breadcrumb,
  children,
}: {
  active: string;
  /** Shown after the product name when the page is below the worklist. */
  breadcrumb?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[112rem] flex-wrap items-center gap-x-8 gap-y-2 px-6 md:px-8">
          <p className="flex items-baseline gap-3 py-2">
            <Link
              href="/clinician"
              className="inline-flex min-h-11 min-w-11 items-center font-heading text-xl leading-none text-ink"
            >
              Mend
            </Link>
            <span className="eyebrow">Clinician</span>
            {breadcrumb ? (
              <span className="text-meta text-ink-tertiary">/ {breadcrumb}</span>
            ) : null}
          </p>

          <nav className="flex items-center gap-1" aria-label="Clinician sections">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.href === active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-md px-3 text-label",
                  item.href === active
                    ? "bg-wash-strong font-medium text-ink"
                    : "text-ink-secondary hover:bg-wash",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <p className="numeric ml-auto hidden text-meta text-ink-tertiary lg:block">
            Ridgeview Orthopedics · nurse line
          </p>
        </div>
        <LiveCallStrip />
      </header>

      <main className="mx-auto w-full max-w-[112rem] px-6 pb-12 md:px-8">{children}</main>

      <footer className="mx-auto w-full max-w-[112rem] px-6 pb-10 md:px-8">
        <MedicalAdviceDisclaimer extra="Synthetic patients only — no protected health information." />
      </footer>
    </div>
  );
}

/** Section heading: serif, because it is language, with a sans meta line. */
export function SectionHeading({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <h2 className="font-heading text-subhead text-ink">{title}</h2>
      {meta ? <p className="numeric text-meta text-ink-tertiary">{meta}</p> : null}
      {children}
    </div>
  );
}

/**
 * Classes for a table that re-flows into stacked, labelled cards below md,
 * from one set of markup. A dense clinical table is the right shape on a
 * laptop and the wrong shape on a phone, and a horizontally-scrolled
 * spreadsheet is worse than either — the cell keeps its column name via
 * `data-label`, so nothing is lost in the narrow form.
 */
export const TABLE_HEAD =
  "px-4 py-2.5 text-left text-meta font-medium uppercase tracking-[0.14em] text-ink-tertiary whitespace-nowrap";

export const TABLE_CELL =
  "flex items-baseline justify-between gap-4 px-4 py-1.5 md:table-cell md:py-3 " +
  "before:text-meta before:uppercase before:tracking-[0.14em] before:text-ink-tertiary " +
  "before:content-[attr(data-label)] md:before:content-none";

/** A bordered card. Used everywhere so the density reads as a grid, not a pile. */
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-line bg-raised shadow-card",
        className,
      )}
    >
      {children}
    </section>
  );
}
