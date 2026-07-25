# Mend Landing Page — Series-C Marketing Surface

**Design spec · 2026-07-25**  
**Route:** `/` (`app/page.tsx`)  
**Audience:** YC judges / investors *and* hospital / clinical buyers (CMIO, ortho service line, care ops)  
**Context:** Replaces the thin “launch pad” with a product-led first viewport and editorial trust depth below the fold. Demo tomorrow; polish must ship tonight.

---

## 1. Goal

In under five seconds a visitor understands: what Mend is, why post-discharge recovery needs it, and how to try the product. On scroll they get clinical credibility without invented customers. The page should feel like a late-stage medtech company — sophisticated, calm, presentable to high-level medical clients — while staying true to Mend’s existing design system.

**Success criteria**
- First viewport is product-led and YC-scannable (brand, one headline, one support line, dual CTAs, dominant product visual).
- Scroll narrative answers: why the gap exists (systems + families), how Mend works, why to trust it, how to enter the product.
- No fake hospital logos, invented pilot counts, or fabricated customer claims.
- Motion is intentional (Framer Motion); video is muted looping product footage with a static fallback.
- Light-only paper system preserved; WCAG AA; `prefers-reduced-motion` respected.
- “Not medical advice” remains on the page (footer / close), never as a hero badge.

---

## 2. Positioning & copy frame

**One-liner (existing product truth):** Voice-first post-op recovery co-pilot for orthopedics.

**Problem frame (approved):** Both sides of the discharge gap —
- Health systems lose visibility after discharge; complications surface late.
- Patients and families are alone at home with a phone tree and no clinical judgment.

**Trust frame:** Credible without inventing customers — architecture, clinical rigor, real product surfaces. LLM at the edges; deterministic engine decides escalation; fail-safe toward escalation; inspectable rules.

**Draft hero copy**
- Headline: *Recovery doesn’t end at discharge.*
- Support: Voice check-ins at home. A deterministic clinical engine. The right person notified when something drifts.
- Primary CTA label: **See the product**
- Secondary CTA label: **Talk to us**

US English only (ER, 911, care team, nurse line). No NHS terms.

---

## 3. Information architecture

Hybrid of product-led hero + editorial trust site:

| Order | Section | Job |
|---|---|---|
| 0 | Top bar | Brand-forward **Mend** + secondary Talk to us |
| 1 | Hero | Value prop + dual CTAs + dominant product video/plane |
| 2 | The gap | Why this exists — systems / families |
| 3 | How Mend works | Call → engine → three audiences; LLM never escalates |
| 4 | Why trust it | Rules inspectable, fail-safe, device determinations, no fake logos |
| 5 | See the product | Surface entries: Live call, Family, Clinician (+ quieter Rule engine) |
| 6 | Close | Restate wedge + dual CTAs + MedicalAdviceDisclaimer |

**Primary CTA:** See the product → smooth-scroll to `#product` (surfaces section). Surface rows deep-link: `/call`, `/family`, `/clinician`, quieter `/clinician/engine`.  
**Secondary CTA:** Talk to us → `mailto:` using a single exported constant `LANDING_CONTACT_EMAIL` in `app/components/landing/contact.ts` (default `hello@mend.health` until replaced). No form backend.  
**Out of scope on `/`:** Operator console link, fake metrics strips, particle backgrounds, scroll-jacking, autoplay audio.

---

## 4. Visual design

### 4.1 Design system (binding)

Preserve existing tokens in `app/globals.css` and styleguide conventions:
- Paper / wash / ink grayscale; severity colour only where clinical UI is previewed and already uses `lib/ui/severity.ts`.
- **Instrument Serif** for human voice / headlines; **Inter** for machine/UI chrome and labels.
- No purple SaaS chrome, no glow stacks, no pill-badge clusters on hero media.
- Cards only where they are the container for interaction (surface entries). Prefer hairline rules and typographic hierarchy elsewhere.

### 4.2 Hero composition (first viewport)

One composition, not a dashboard:
- Brand at hero-level weight (must pass brand test if nav were removed).
- One headline, one short support sentence, one CTA group.
- Dominant edge-to-edge (or full-bleed) **product video plane** — not an inset collage, not floating stickers/badges on the media.
- Top bar is minimal; secondary Talk to us does not overpower the brand.

### 4.3 Below-the-fold

One purpose, one headline, one short support line per section. Wide, calm measure (not the old `max-w-xl` launch pad). Pair systems/families in The gap without card clutter. How it works as three sequential beats, not a feature matrix.

---

## 5. Motion (Framer Motion)

`framer-motion` is already a dependency; match patterns in `app/components/call/*` (`useReducedMotion`).

**Three intentional motion systems (minimum):**
1. **Hero entrance** — brand, headline, support, CTAs stagger (opacity + slight Y); product plane fades/scales in after copy.
2. **Scroll reveals** — sections `whileInView` once; light child stagger; no continuous bounce or parallax noise.
3. **Interactive polish** — CTA hover ink/underline; surface rows calm horizontal nudge or border emphasis.

All motion disabled or reduced to opacity-only when `prefers-reduced-motion: reduce`.

---

## 6. Video

- Hero media: muted, looped, `playsInline` product screen capture (live call preferred; family→clinician cut acceptable).
- Asset path: `public/landing/hero.mp4` (and optional `.webm`). Poster: `public/landing/hero-poster.jpg` matching first frame.
- If file missing: static poster / staged frame of the call surface so the page never looks broken.
- No autoplay audio. Lazy-load any secondary clip if added later.
- Recording source for the hackathon: capture from the running demo (`/call`) at a projector-friendly crop; placeholder poster may ship first if capture is delayed.

---

## 7. Component architecture

Replace the thin launch pad in `app/page.tsx` with a composition of landing sections:

```
app/page.tsx                          # server entry; renders <LandingPage />
app/components/landing/
  LandingPage.tsx                     # "use client" shell — owns scroll/motion
  LandingNav.tsx
  Hero.tsx                            # copy + video + CTAs
  Gap.tsx
  HowItWorks.tsx
  Trust.tsx
  Surfaces.tsx                        # id="product"
  Close.tsx
  contact.ts                          # LANDING_CONTACT_EMAIL
  motion.ts                           # shared variants / reduced-motion helpers
```


Reuse `MedicalAdviceDisclaimer`. Do not import console/demo chrome into the marketing surface.

**Metadata:** Update `app/layout.tsx` (or page-level metadata) title/description to marketing-quality copy aligned with the hero one-liner — still accurate, not hype metrics.

---

## 8. Content constraints (honesty)

Allowed:
- Describe the product, architecture, and demo surfaces.
- Link to `/clinician/engine` as evidence of inspectable rules.
- Outcome-oriented language that does not claim named customers or quantified pilots.

Forbidden:
- Named health systems, “trusted by”, logo walls, fake ARR/NPS/readmission % unless separately verified and approved.
- Implying FDA clearance for Mend itself (device determinations are inputs; Mend is not the cleared device).
- British spellings / NHS register.

---

## 9. Accessibility & safety

- WCAG AA contrast on paper/ink.
- 44px minimum touch targets on CTAs and surface links.
- Video decorative relative to copy: accessible name / `aria-hidden` on purely decorative media; page meaning must stand without video.
- Keyboard focus-visible retained (global styles).
- Disclaimer on close section; educational prototype framing unchanged.

---

## 10. Testing & verification

- Typecheck / lint clean for new files.
- Manual: desktop + mobile first viewport; reduced-motion on; video missing fallback.
- `node scripts/visual-check.mjs` — expect `/` screenshot to change; review PNG, do not trust harness alone.
- Confirm console shortcut still works; console remains off the public nav.

---

## 11. Non-goals

- Redesigning `/call`, `/family`, `/clinician` chrome (hero may *show* them; not retheme them).
- Auth, waitlist backend, or CMS.
- Dark mode.
- Thymia / RTM adherence messaging on the landing page.
