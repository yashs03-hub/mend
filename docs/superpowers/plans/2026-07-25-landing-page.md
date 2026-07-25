# Landing Page (Series-C Marketing Surface) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the thin `/` launch pad with a product-led, Framer-animated marketing landing page that sells Mend to YC judges and clinical buyers without inventing customers.

**Architecture:** Server `app/page.tsx` renders a client `LandingPage` shell that owns Framer Motion and composes focused section components under `app/components/landing/`. Copy and contact live in pure modules (unit-tested). Hero shows a muted looping product video when present, with a crafted HTML product plane fallback so the page never looks broken. Existing design tokens and `MedicalAdviceDisclaimer` are reused.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict, Tailwind v4 tokens from `app/globals.css`, `framer-motion` (already installed), Vitest (node env).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-25-landing-page-design.md` — binding.
- Preserve Mend design system: paper/ink grayscale, Instrument Serif for voice, Inter for machine/UI; no purple SaaS chrome, no glow stacks, no fake logo walls or invented metrics.
- US English only (ER, 911, care team, nurse line). No NHS terms or British spellings.
- Every user-facing surface shows "Educational prototype — not medical advice" via `MedicalAdviceDisclaimer`.
- Do not imply FDA clearance for Mend; device determinations are inputs.
- Operator console stays off public nav (`Ctrl/⌘⇧M` shortcut unchanged).
- Respect `prefers-reduced-motion` (opacity-only / skip travel when reduced).
- TypeScript strict. No `any`.
- Verify `git branch --show-current` immediately before every commit (teammates share this working copy).
- Prefer Grok 4.5 for implementation subagents.

---

## File structure

| Path | Responsibility |
|---|---|
| `app/page.tsx` | Server entry; page metadata; renders `<LandingPage />` |
| `app/layout.tsx` | Optional root metadata tweak only if page-level metadata is insufficient |
| `app/components/landing/contact.ts` | `LANDING_CONTACT_EMAIL`, `talkToUsHref()` |
| `app/components/landing/copy.ts` | All marketing strings + surface link data |
| `app/components/landing/motion.ts` | Shared variants + `useLandingMotion()` helper |
| `app/components/landing/LandingPage.tsx` | Client shell; section order |
| `app/components/landing/LandingNav.tsx` | Brand + Talk to us |
| `app/components/landing/Hero.tsx` | First viewport: copy, CTAs, video/mock plane |
| `app/components/landing/HeroProductPlane.tsx` | Video + HTML fallback product visual |
| `app/components/landing/Gap.tsx` | Systems / families problem |
| `app/components/landing/HowItWorks.tsx` | Three beats |
| `app/components/landing/Trust.tsx` | Credibility without invented customers |
| `app/components/landing/Surfaces.tsx` | `#product` deep links |
| `app/components/landing/Close.tsx` | Final CTAs + disclaimer |
| `app/components/landing/copy.test.ts` | Copy/surface/contact honesty tests |
| `app/components/MedicalAdviceDisclaimer.test.ts` | Point `/` coverage at landing Close |
| `public/landing/hero.mp4` | Optional muted loop (may be absent at first ship) |
| `public/landing/hero-poster.jpg` | Optional poster; HTML mock covers absence |

---

### Task 1: Landing copy, contact, and motion primitives

**Files:**
- Create: `app/components/landing/contact.ts`
- Create: `app/components/landing/copy.ts`
- Create: `app/components/landing/motion.ts`
- Create: `app/components/landing/copy.test.ts`

**Interfaces:**
- Consumes: nothing from later tasks
- Produces:
  - `LANDING_CONTACT_EMAIL: string`
  - `talkToUsHref(): string` → `mailto:${LANDING_CONTACT_EMAIL}?subject=...`
  - `landingCopy` object with `brand`, `headline`, `support`, `primaryCta`, `secondaryCta`, `gap`, `how`, `trust`, `surfaces`, `close`
  - `PRODUCT_SURFACES: ReadonlyArray<{ href: string; label: string; note: string; quiet?: boolean }>`
  - `fadeUp`, `staggerContainer`, `viewportOnce` from `motion.ts`
  - `useLandingMotion(): { reduce: boolean; fadeUp; staggerContainer; viewportOnce }`

- [ ] **Step 1: Write the failing test**

Create `app/components/landing/copy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LANDING_CONTACT_EMAIL, talkToUsHref } from "./contact";
import { landingCopy, PRODUCT_SURFACES } from "./copy";

describe("landing copy honesty", () => {
  it("does not invent named customers or fake metrics", () => {
    const blob = JSON.stringify({ landingCopy, PRODUCT_SURFACES });
    expect(blob).not.toMatch(/Mayo|Cleveland Clinic|trusted by|NPS|ARR|readmission rate/i);
  });

  it("keeps US clinical register", () => {
    const blob = JSON.stringify(landingCopy);
    expect(blob).not.toMatch(/\bNHS\b|\bMum\b|\bring the\b/i);
  });

  it("exposes the four product surfaces with real routes", () => {
    const hrefs = PRODUCT_SURFACES.map((s) => s.href);
    expect(hrefs).toEqual(
      expect.arrayContaining(["/call", "/family", "/clinician", "/clinician/engine"]),
    );
  });

  it("builds a mailto for Talk to us", () => {
    expect(LANDING_CONTACT_EMAIL).toMatch(/@/);
    expect(talkToUsHref()).toMatch(/^mailto:/);
    expect(talkToUsHref()).toContain(LANDING_CONTACT_EMAIL);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/components/landing/copy.test.ts`

Expected: FAIL (cannot resolve modules / exports missing)

- [ ] **Step 3: Implement contact, copy, motion**

`app/components/landing/contact.ts`:

```ts
export const LANDING_CONTACT_EMAIL = "hello@mend.health";

export function talkToUsHref(): string {
  const subject = encodeURIComponent("Mend briefing");
  return `mailto:${LANDING_CONTACT_EMAIL}?subject=${subject}`;
}
```

`app/components/landing/copy.ts`:

```ts
export const landingCopy = {
  brand: "Mend",
  headline: "Recovery doesn’t end at discharge.",
  support:
    "Voice check-ins at home. A deterministic clinical engine. The right person notified when something drifts.",
  primaryCta: "See the product",
  secondaryCta: "Talk to us",
  gap: {
    eyebrow: "The gap",
    title: "After discharge, everyone loses the plot.",
    support:
      "Hospitals lose visibility. Families are left with a phone tree. Complications surface late.",
    systemsTitle: "Health systems",
    systemsBody:
      "Post-op patients go home and the care team’s line of sight drops. Drift shows up as a readmission, not a Tuesday morning call.",
    familiesTitle: "Patients and families",
    familiesBody:
      "An elderly patient will answer a calm daily call. They will not open another app. Families need a clear update without clinical jargon.",
  },
  how: {
    eyebrow: "How Mend works",
    title: "One morning event. Three audiences.",
    support:
      "Language models extract and speak. A deterministic engine decides. Escalation is never improvised.",
    beats: [
      {
        title: "Morning voice check-in",
        body: "Mend calls the patient, listens in plain language, and confirms what matters before anything else happens.",
      },
      {
        title: "Deterministic clinical engine",
        body: "Symptoms and vitals meet cited red-flag rules against the recovery phase. The LLM never chooses green, amber, or red.",
      },
      {
        title: "The right people, same truth",
        body: "Patient call guidance, family update, and clinician worklist all reflect the same engine decision.",
      },
    ],
  },
  trust: {
    eyebrow: "Why trust it",
    title: "Clinical rigor you can inspect.",
    support: "Credibility from architecture — not logo walls or invented pilots.",
    points: [
      {
        title: "Rules you can open",
        body: "Every threshold carries provenance. The vignette suite at /clinician/engine shows what fires and why.",
      },
      {
        title: "Fail-safe by design",
        body: "On ambiguity, missing data, or poor signal quality, Mend escalates. It never reassures into uncertainty.",
      },
      {
        title: "Devices stay devices",
        body: "Mend consumes FDA-cleared determinations from home ECG hardware. It does not re-derive rhythm from a waveform.",
      },
    ],
  },
  surfaces: {
    eyebrow: "Product",
    title: "See Mend from every seat.",
    support: "Live call, family update, clinician worklist — one engine underneath.",
  },
  close: {
    title: "Built for the hardest week after surgery.",
    support:
      "A voice-first recovery co-pilot for orthopedics — calm when it’s fine, decisive when it isn’t.",
  },
} as const;

export const PRODUCT_SURFACES = [
  { href: "/call", label: "Live call", note: "Voice check-in on stage" },
  { href: "/family", label: "Family", note: "Caregiver morning update" },
  { href: "/clinician", label: "Clinician", note: "Recovery worklist" },
  {
    href: "/clinician/engine",
    label: "Rule engine",
    note: "Deterministic safety rules",
    quiet: true,
  },
] as const;
```

`app/components/landing/motion.ts`:

```ts
"use client";

import { useReducedMotion, type Variants } from "framer-motion";

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.06 },
  },
};

export const viewportOnce = { once: true, amount: 0.25 } as const;

export function useLandingMotion() {
  const reduce = Boolean(useReducedMotion());
  const reducedFade: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.2 } },
  };
  return {
    reduce,
    fadeUp: reduce ? reducedFade : fadeUp,
    staggerContainer: reduce
      ? ({ hidden: {}, show: {} } satisfies Variants)
      : staggerContainer,
    viewportOnce,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run app/components/landing/copy.test.ts`

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git branch --show-current   # must be the intended branch
git add app/components/landing/contact.ts app/components/landing/copy.ts \
  app/components/landing/motion.ts app/components/landing/copy.test.ts
git commit -m "$(cat <<'EOF'
feat(landing): add copy, contact, and motion primitives

Lock marketing strings and honesty constraints before building sections.
EOF
)"
```

---

### Task 2: Nav, hero, and product plane

**Files:**
- Create: `app/components/landing/LandingNav.tsx`
- Create: `app/components/landing/HeroProductPlane.tsx`
- Create: `app/components/landing/Hero.tsx`
- Create: `public/landing/.gitkeep`

**Interfaces:**
- Consumes: `landingCopy`, `talkToUsHref`, `useLandingMotion` from Task 1
- Produces: `<LandingNav />`, `<Hero />` (includes `#` primary scroll target wiring via `href="#product"`)

- [ ] **Step 1: Create asset directory**

```bash
mkdir -p public/landing
touch public/landing/.gitkeep
```

If a screen capture becomes available later, place `public/landing/hero.mp4` and optional `public/landing/hero-poster.jpg` — do not block shipping on the video file.

- [ ] **Step 2: Implement LandingNav**

`app/components/landing/LandingNav.tsx`:

```tsx
"use client";

import { talkToUsHref } from "./contact";
import { landingCopy } from "./copy";

export function LandingNav() {
  return (
    <header className="relative z-20 flex items-center justify-between px-6 py-5 sm:px-10 lg:px-14">
      <a
        href="#top"
        className="font-heading text-subhead tracking-tight text-ink"
      >
        {landingCopy.brand}
      </a>
      <a
        href={talkToUsHref()}
        className="min-h-11 inline-flex items-center text-label text-ink-secondary transition-colors hover:text-ink"
      >
        {landingCopy.secondaryCta}
      </a>
    </header>
  );
}
```

- [ ] **Step 3: Implement HeroProductPlane**

Craft a calm HTML mock of the live-call moment (patient name, “On a call”, one lede line, grayscale vitals). Overlay `<video>` when the mp4 exists; on `error` or missing load, keep the mock visible.

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useLandingMotion } from "./motion";

const VIDEO_SRC = "/landing/hero.mp4";
const POSTER_SRC = "/landing/hero-poster.jpg";

export function HeroProductPlane() {
  const { reduce, fadeUp } = useLandingMotion();
  const [videoOk, setVideoOk] = useState(true);

  return (
    <motion.div
      variants={fadeUp}
      className="relative aspect-[4/3] w-full overflow-hidden bg-wash sm:aspect-[16/10] lg:aspect-auto lg:min-h-[28rem] lg:flex-1"
      aria-hidden="true"
    >
      {/* HTML product mock — always present as fallback / underlay */}
      <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-br from-wash via-paper to-wash-strong p-8 sm:p-10">
        <div className="space-y-3">
          <p className="eyebrow">Live check-in</p>
          <p className="font-heading text-heading tracking-tight text-ink">
            Margaret · morning call
          </p>
          <p className="max-w-sm font-serif text-lede text-ink-secondary">
            “A little short of breath when I stood up — nothing like yesterday.”
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 border-t border-line pt-6">
          {[
            { label: "HR", value: "122", unit: "bpm" },
            { label: "Rhythm", value: "Sinus tach", unit: "" },
            { label: "SpO₂", value: "94", unit: "%" },
          ].map((tile) => (
            <div key={tile.label}>
              <p className="text-meta text-ink-tertiary">{tile.label}</p>
              <p className="numeric mt-1 text-vital text-ink">
                {tile.value}
                {tile.unit ? (
                  <span className="ml-1 text-label text-ink-tertiary">
                    {tile.unit}
                  </span>
                ) : null}
              </p>
            </div>
          ))}
        </div>
      </div>

      {videoOk ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay={!reduce}
          muted
          loop
          playsInline
          poster={POSTER_SRC}
          onError={() => setVideoOk(false)}
        >
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>
      ) : null}
    </motion.div>
  );
}
```

- [ ] **Step 4: Implement Hero**

Split layout: copy left / product plane right on large screens; stack on phone. Primary CTA is `<a href="#product">`. Secondary is mailto. Stagger entrance with `staggerContainer` + `fadeUp`. Brand word **Mend** appears at display weight in the hero (brand test).

```tsx
"use client";

import { motion } from "framer-motion";
import { talkToUsHref } from "./contact";
import { landingCopy } from "./copy";
import { HeroProductPlane } from "./HeroProductPlane";
import { useLandingMotion } from "./motion";

export function Hero() {
  const { fadeUp, staggerContainer } = useLandingMotion();

  return (
    <section className="relative px-6 pb-16 pt-6 sm:px-10 sm:pb-24 lg:px-14">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="max-w-xl"
        >
          <motion.p variants={fadeUp} className="font-heading text-display tracking-tight text-ink">
            {landingCopy.brand}
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="mt-6 font-heading text-title tracking-tight text-ink sm:text-heading lg:text-title"
          >
            {landingCopy.headline}
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-5 max-w-md font-serif text-lede text-ink-secondary"
          >
            {landingCopy.support}
          </motion.p>
          <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="#product"
              className="inline-flex min-h-12 items-center bg-ink px-6 text-label text-paper transition-opacity hover:opacity-90"
            >
              {landingCopy.primaryCta}
            </a>
            <a
              href={talkToUsHref()}
              className="inline-flex min-h-12 items-center px-2 text-label text-ink-secondary underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              {landingCopy.secondaryCta}
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="min-w-0"
        >
          <HeroProductPlane />
        </motion.div>
      </div>
    </section>
  );
}
```

Note on type scale: if `text-title` feels smaller than intended under `text-heading` in the `sm:` branch above, prefer a single clear hierarchy — `text-title` or `text-heading` for the headline, never smaller than lede. Adjust in implementation so headline > support visually on all breakpoints.

- [ ] **Step 5: Smoke-check in isolation (optional)**

Temporarily render `<LandingNav /><Hero />` from `app/page.tsx` only if needed for visual check; otherwise wait for Task 4 assembly. Prefer assembling in Task 4 to avoid thrash.

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add app/components/landing/LandingNav.tsx \
  app/components/landing/HeroProductPlane.tsx \
  app/components/landing/Hero.tsx \
  public/landing/.gitkeep
git commit -m "$(cat <<'EOF'
feat(landing): add product-led hero with video fallback plane

Ship a YC-scannable first viewport; HTML mock covers missing mp4.
EOF
)"
```

---

### Task 3: Gap, How it works, Trust sections

**Files:**
- Create: `app/components/landing/Gap.tsx`
- Create: `app/components/landing/HowItWorks.tsx`
- Create: `app/components/landing/Trust.tsx`

**Interfaces:**
- Consumes: `landingCopy`, `useLandingMotion`
- Produces: three section components with `whileInView` reveals

- [ ] **Step 1: Implement Gap**

```tsx
"use client";

import { motion } from "framer-motion";
import { landingCopy } from "./copy";
import { useLandingMotion } from "./motion";

export function Gap() {
  const { fadeUp, staggerContainer, viewportOnce } = useLandingMotion();
  const c = landingCopy.gap;

  return (
    <section className="border-t border-line px-6 py-20 sm:px-10 sm:py-28 lg:px-14">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.p variants={fadeUp} className="eyebrow">
          {c.eyebrow}
        </motion.p>
        <motion.h2
          variants={fadeUp}
          className="mt-4 max-w-2xl font-heading text-heading tracking-tight text-ink"
        >
          {c.title}
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-4 max-w-xl font-serif text-lede text-ink-secondary"
        >
          {c.support}
        </motion.p>
        <div className="mt-14 grid gap-12 md:grid-cols-2 md:gap-16">
          <motion.div variants={fadeUp} className="border-t border-line pt-6">
            <h3 className="font-heading text-subhead text-ink">{c.systemsTitle}</h3>
            <p className="mt-3 text-body text-ink-secondary">{c.systemsBody}</p>
          </motion.div>
          <motion.div variants={fadeUp} className="border-t border-line pt-6">
            <h3 className="font-heading text-subhead text-ink">{c.familiesTitle}</h3>
            <p className="mt-3 text-body text-ink-secondary">{c.familiesBody}</p>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 2: Implement HowItWorks**

`app/components/landing/HowItWorks.tsx`:

```tsx
"use client";

import { motion } from "framer-motion";
import { landingCopy } from "./copy";
import { useLandingMotion } from "./motion";

export function HowItWorks() {
  const { fadeUp, staggerContainer, viewportOnce } = useLandingMotion();
  const c = landingCopy.how;

  return (
    <section className="border-t border-line bg-wash/40 px-6 py-20 sm:px-10 sm:py-28 lg:px-14">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.p variants={fadeUp} className="eyebrow">
          {c.eyebrow}
        </motion.p>
        <motion.h2
          variants={fadeUp}
          className="mt-4 max-w-2xl font-heading text-heading tracking-tight text-ink"
        >
          {c.title}
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-4 max-w-xl font-serif text-lede text-ink-secondary"
        >
          {c.support}
        </motion.p>
        <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {c.beats.map((beat, index) => (
            <motion.li
              key={beat.title}
              variants={fadeUp}
              className="border-t border-line pt-6"
            >
              <p className="numeric text-meta text-ink-tertiary">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-3 font-heading text-subhead text-ink">
                {beat.title}
              </h3>
              <p className="mt-3 text-body text-ink-secondary">{beat.body}</p>
            </motion.li>
          ))}
        </ol>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 3: Implement Trust**

`app/components/landing/Trust.tsx`:

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { landingCopy } from "./copy";
import { useLandingMotion } from "./motion";

export function Trust() {
  const { fadeUp, staggerContainer, viewportOnce } = useLandingMotion();
  const c = landingCopy.trust;

  return (
    <section className="border-t border-line px-6 py-20 sm:px-10 sm:py-28 lg:px-14">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.p variants={fadeUp} className="eyebrow">
          {c.eyebrow}
        </motion.p>
        <motion.h2
          variants={fadeUp}
          className="mt-4 max-w-2xl font-heading text-heading tracking-tight text-ink"
        >
          {c.title}
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-4 max-w-xl font-serif text-lede text-ink-secondary"
        >
          {c.support}
        </motion.p>
        <ul className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {c.points.map((point) => (
            <motion.li
              key={point.title}
              variants={fadeUp}
              className="border-t border-line pt-6"
            >
              <h3 className="font-heading text-subhead text-ink">{point.title}</h3>
              <p className="mt-3 text-body text-ink-secondary">{point.body}</p>
              {point.title === "Rules you can open" ? (
                <Link
                  href="/clinician/engine"
                  className="mt-4 inline-flex min-h-11 items-center text-label text-ink underline-offset-4 hover:underline"
                >
                  Inspect the rule engine →
                </Link>
              ) : null}
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git branch --show-current
git add app/components/landing/Gap.tsx \
  app/components/landing/HowItWorks.tsx \
  app/components/landing/Trust.tsx
git commit -m "$(cat <<'EOF'
feat(landing): add gap, how-it-works, and trust sections

Editorial depth below the fold for clinical and investor readers.
EOF
)"
```

---

### Task 4: Surfaces, Close, assemble page, update disclaimer test

**Files:**
- Create: `app/components/landing/Surfaces.tsx`
- Create: `app/components/landing/Close.tsx`
- Create: `app/components/landing/LandingPage.tsx`
- Modify: `app/page.tsx` (replace launch pad)
- Modify: `app/components/MedicalAdviceDisclaimer.test.ts` (point coverage at Close)
- Modify: `app/layout.tsx` metadata description if page metadata does not cover root

**Interfaces:**
- Consumes: all prior landing components + `MedicalAdviceDisclaimer`
- Produces: full `/` route

- [ ] **Step 1: Update disclaimer surface list (failing until Close exists)**

In `app/components/MedicalAdviceDisclaimer.test.ts`, change the `/` entry from `"app/page.tsx"` to `"app/components/landing/Close.tsx"` so the disclaimer must live on the marketing close section (page will only import `LandingPage`).

- [ ] **Step 2: Implement Surfaces**

```tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { landingCopy, PRODUCT_SURFACES } from "./copy";
import { useLandingMotion } from "./motion";

export function Surfaces() {
  const { fadeUp, staggerContainer, viewportOnce } = useLandingMotion();
  const c = landingCopy.surfaces;

  return (
    <section
      id="product"
      className="scroll-mt-8 border-t border-line px-6 py-20 sm:px-10 sm:py-28 lg:px-14"
    >
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.p variants={fadeUp} className="eyebrow">
          {c.eyebrow}
        </motion.p>
        <motion.h2
          variants={fadeUp}
          className="mt-4 font-heading text-heading tracking-tight text-ink"
        >
          {c.title}
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-4 max-w-xl font-serif text-lede text-ink-secondary"
        >
          {c.support}
        </motion.p>
        <nav aria-label="Product surfaces" className="mt-12 flex flex-col">
          {PRODUCT_SURFACES.map((surface) => (
            <motion.div key={surface.href} variants={fadeUp}>
              <Link
                href={surface.href}
                className={`group flex min-h-14 items-baseline justify-between gap-6 border-t border-line py-5 transition-transform last:border-b hover:translate-x-1 ${
                  surface.quiet ? "opacity-80" : ""
                }`}
              >
                <span className="font-heading text-subhead text-ink group-hover:text-ink-secondary">
                  {surface.label}
                </span>
                <span className="text-label text-ink-tertiary">{surface.note}</span>
              </Link>
            </motion.div>
          ))}
        </nav>
      </motion.div>
    </section>
  );
}
```

Honor `prefers-reduced-motion`: when `reduce` is true, omit `hover:translate-x-1` (pass `reduce` from `useLandingMotion` and conditionally apply the class).

- [ ] **Step 3: Implement Close**

`app/components/landing/Close.tsx`:

```tsx
"use client";

import { motion } from "framer-motion";
import { MedicalAdviceDisclaimer } from "@/app/components/MedicalAdviceDisclaimer";
import { talkToUsHref } from "./contact";
import { landingCopy } from "./copy";
import { useLandingMotion } from "./motion";

export function Close() {
  const { fadeUp, staggerContainer, viewportOnce } = useLandingMotion();
  const c = landingCopy.close;

  return (
    <section className="border-t border-line px-6 py-20 sm:px-10 sm:py-28 lg:px-14">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.h2
          variants={fadeUp}
          className="max-w-2xl font-heading text-heading tracking-tight text-ink"
        >
          {c.title}
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-4 max-w-xl font-serif text-lede text-ink-secondary"
        >
          {c.support}
        </motion.p>
        <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href="#product"
            className="inline-flex min-h-12 items-center bg-ink px-6 text-label text-paper transition-opacity hover:opacity-90"
          >
            {landingCopy.primaryCta}
          </a>
          <a
            href={talkToUsHref()}
            className="inline-flex min-h-12 items-center px-2 text-label text-ink-secondary underline-offset-4 transition-colors hover:text-ink hover:underline"
          >
            {landingCopy.secondaryCta}
          </a>
        </motion.div>
        <motion.div variants={fadeUp}>
          <MedicalAdviceDisclaimer className="mt-16" />
        </motion.div>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 4: Assemble LandingPage + page.tsx**

`app/components/landing/LandingPage.tsx`:

```tsx
"use client";

import { Close } from "./Close";
import { Gap } from "./Gap";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { LandingNav } from "./LandingNav";
import { Surfaces } from "./Surfaces";
import { Trust } from "./Trust";

export function LandingPage() {
  return (
    <main id="top" className="relative min-h-dvh overflow-x-hidden bg-paper">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,var(--color-wash)_0%,transparent_50%),radial-gradient(ellipse_at_90%_30%,var(--color-wash-strong)_0%,transparent_40%)]"
      />
      <div className="relative">
        <LandingNav />
        <Hero />
        <Gap />
        <HowItWorks />
        <Trust />
        <Surfaces />
        <Close />
      </div>
    </main>
  );
}
```

`app/page.tsx`:

```tsx
import type { Metadata } from "next";
import { LandingPage } from "@/app/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Mend — Post-op recovery that doesn’t end at discharge",
  description:
    "Voice-first post-op orthopedic recovery co-pilot. Deterministic clinical engine. One morning check-in for patients, families, and clinicians.",
};

export default function Home() {
  return <LandingPage />;
}
```

If Next.js root layout `title: "Mend"` conflicts awkwardly, leave layout as default template and rely on page metadata (Next merges titles). Do not invent hype metrics in description.

- [ ] **Step 5: Run tests**

Run:

```bash
npx vitest run app/components/landing/copy.test.ts app/components/MedicalAdviceDisclaimer.test.ts
npx tsc --noEmit
```

Expected: all listed tests PASS; `tsc` clean.

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git add app/page.tsx app/components/landing \
  app/components/MedicalAdviceDisclaimer.test.ts
git commit -m "$(cat <<'EOF'
feat(landing): ship Series-C marketing page on /

Product-led hero, editorial trust narrative, and real surface deep links.
EOF
)"
```

---

### Task 5: Visual verification and motion polish

**Files:**
- Modify: landing components only if screenshots reveal hierarchy / spacing issues
- Possibly: add `html { scroll-behavior: smooth; }` scoped carefully — prefer `scroll-smooth` on `<html>` in `LandingPage` wrapper via `useEffect` that sets `document.documentElement.classList.add("scroll-smooth")` and cleans up on unmount (avoid changing global app scroll for `/call` mid-demo). Only if `#product` jump feels abrupt.

**Interfaces:**
- Consumes: running dev server
- Produces: reviewed `.visual/root--*.png` evidence

- [ ] **Step 1: Typecheck, test, build**

```bash
npx tsc --noEmit
npm test
npm run build
```

Expected: clean tsc; existing suite still green (including updated disclaimer test); build succeeds with `/` page.

- [ ] **Step 2: Visual harness on `/`**

With `npm run dev` already running:

```bash
node scripts/visual-check.mjs /
```

Open and **actually view** (image-read) at least:

- `.visual/root--projector.png`
- `.visual/root--phone.png`

Checklist while viewing:
- Brand “Mend” is hero-level in first viewport
- No fake logos / metric strips
- Dual CTAs visible
- Product plane present (mock or video)
- Sections readable; no console link in nav
- Disclaimer present near bottom
- Phone layout not crushed; 44px targets on CTAs

- [ ] **Step 3: Reduced motion pass**

In browser DevTools → emulate `prefers-reduced-motion: reduce` → reload `/`. Confirm no large travel animations; page still understandable.

- [ ] **Step 4: Polish pass (only if screenshots demand it)**

Allowed fixes: spacing, type scale, hero grid balance, surface hover without `translate` when reduced motion, video/mock layering. Do not add new sections or fake social proof.

- [ ] **Step 5: Final commit if polish landed**

```bash
git branch --show-current
git add app/components/landing
git commit -m "$(cat <<'EOF'
polish(landing): tighten hero and motion after visual check

Adjust spacing and reduced-motion behavior from projector screenshots.
EOF
)"
```

If no polish needed, skip this commit.

- [ ] **Step 6: Optional video capture (does not block demo)**

Record a muted loop of `/call` (or family→clinician) at ~1920×1080, export `public/landing/hero.mp4`, matching poster `public/landing/hero-poster.jpg`. Commit assets separately if size is reasonable for git; otherwise keep HTML mock for the live demo and host video only on Vercel if needed.

---

## Spec coverage checklist (author self-review)

| Spec requirement | Task |
|---|---|
| Product-led first viewport | Task 2 |
| Dual CTAs (See product / Talk to us) | Tasks 1–2, 4 |
| Gap systems + families | Task 3 |
| How Mend works / LLM never escalates | Task 3 |
| Trust without invented customers | Tasks 1, 3 |
| Surfaces `#product` | Task 4 |
| Close + disclaimer | Task 4 |
| Framer Motion + reduced motion | Tasks 1–5 |
| Video + fallback | Task 2, 5 |
| Design system preserved | All tasks |
| Metadata | Task 4 |
| Visual verification | Task 5 |
| Console off public nav | Tasks 2, 4 |

No placeholders remain. Contact email is explicit (`hello@mend.health`). Video absence is an intentional non-blocking fallback.
