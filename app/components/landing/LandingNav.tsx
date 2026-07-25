"use client";

import { talkToUsHref } from "./contact";
import { landingCopy } from "./copy";

export function LandingNav() {
  return (
    <header className="relative z-20 flex items-center justify-between px-6 py-5 sm:px-10 lg:px-14">
      <a
        href="#top"
        className="inline-flex min-h-11 items-center font-heading text-subhead tracking-tight text-ink"
      >
        {landingCopy.brand}
      </a>
      <a
        href={talkToUsHref()}
        className="min-h-11 inline-flex items-center text-label text-ink-secondary transition-colors hover:text-ink"
      >
        {landingCopy.contactCta}
      </a>
    </header>
  );
}
