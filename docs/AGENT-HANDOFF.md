# Agent handoff — Mend

Written 2026-07-25 ~15:35 BST (updated after P1 correctness wave). Hackathon demo is
**tomorrow (Sunday 26 July)**, judged by four YC alumni building medtech companies. First
prize is a guaranteed YC interview.

Read this, then `docs/superpowers/plans/2026-07-25-mend-rev2.md` (the implementation plan and
binding constraints) and `docs/demo-runbook.md` (stage sequence, credentials, fallbacks).

---

## 1. State right now

All 21 planned tasks are built. **P1 correctness gaps from the prior handoff are fixed** on
branch `fix/p1-correctness` (worktree `.worktrees/p1-correctness`). Tip of that branch is
`9e7954f` (plus any docs commit after). Base was `f022219` on `main`.

| Check | Expected (verified on worktree) |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | 464 passing / 41 files |
| `npm run build` | not re-run this session — run before deploy |
| `node scripts/visual-check.mjs` | now also captures `/family?state=urgent` |

**Deployed:** https://mend-ten.vercel.app — still the prior deploy until this branch is merged
and redeployed. Vercel project `mend` under `vikkashs-projects`.

**Git:** work happens on `fix/p1-correctness` in `.worktrees/p1-correctness`. Do **not**
assume the primary checkout's branch is stable — a teammate has checked out `main` mid-task
before. `origin` = `yashs03-hub/mend`, `fork` = `vikkash27/mend`.

**Routes:** `/` launch pad · `/call` demo peak · `/family` · `/clinician` ·
`/clinician/engine` vignette suite · `/console` operator surface (`Ctrl/⌘⇧M`) · `/styleguide`.

### The single biggest risk (unchanged)

`.env` still lacks live Anthropic / ElevenLabs / Twilio / Supabase credentials, and Vercel
has no environment variables. Nothing has ever run against a live service. The live site is
still fixture-mode. `/console` shows every missing key by name. See `docs/demo-runbook.md`.

Without `ANTHROPIC_API_KEY`, extraction fails safe → every typed check-in comes out amber,
including the green scenario. That is correct behaviour, not a bug.

Cross-isolate `demo_state` durability for `/family` and `/call` is **wired**
(`await loadActiveScenario()`) but **unproven** until Supabase keys exist.

---

## 2. Hard constraints — do not violate these

From the plan's Global Constraints. Reviewers have already caught violations of the first two.

1. **The LLM never makes an escalation decision.** Only `evaluate()` in
   `lib/clinical/red-flag-engine.ts` returns green/amber/red. Claude extracts, parses documents
   and writes prose. Note the subtle failure mode: a model can change severity *by omission*,
   not just by writing a level.
2. **Fail-safe direction is always toward escalation.** On ambiguity, missing or poor-quality
   data, fall back to symptom-only rules. Never reassure on uncertainty.
3. Synthetic patient data only. Real device readings belong to the operator and are labelled so.
4. Every user-facing surface shows "not medical advice".
5. Market is the **United States**: ER, 911, care team, nurse line. No NHS terms, and no British
   spellings or register (don't reintroduce "Mum", "ring", "frame", `en-GB`).
6. Mend never re-derives ECG rhythm. It consumes the KardiaMobile 6L's FDA-cleared
   determination as an input.
7. Every clinical threshold carries a `source` string naming its provenance. Uncited judgement
   calls are logged in `docs/clinical-decisions.md`.
8. TypeScript strict. No `any` in `lib/clinical/**`.

**Design system:** serif (Instrument Serif) for human voice, sans (Inter) for machine data,
tabular-nums on figures; "grayscale until it matters" with colour reserved for severity;
`lib/ui/severity.ts` is the single source of truth; severity never conveyed by colour alone;
WCAG AA; 44px touch targets; family surface minimum 19px and never any rule ids or jargon.

---

## 3. Things that will bite you

**The branch moves under you.** Prefer `.worktrees/` (now gitignored) or a separate clone.
**Verify `git branch --show-current` immediately before every commit.**

**Thymia is deliberately parked.** Do not run `git stash pop`, and do not add
`therapyAdherent` or `adherenceDays` fields.

**`tailwind-merge` silently deletes semantic font-size classes.** Register new semantic size
tokens in `lib/utils.ts`. Look at screenshots, not just the harness.

**Never trust a report over the artefact.** Open `.visual/` PNGs with an image-reading tool.
For the PE family frame, look at `family-state-urgent--*.png`, not `family-state-attention`
(attention is drift/amber by design).

**Don't run concurrent agents that commit to the same branch.**

---

## 4. What was fixed (don't re-litigate)

### Prior session (see previous handoff narrative)

- False green on extraction failure; speakable triage errors; tachycardia threshold wording;
  disclaimers; US English; launch pad; family 19px; harness escalated/attention frames;
  console drives family/call; durable caregiver SMS insert (without check-in link — fixed below).

### This session — P1 on `fix/p1-correctness` (`f022219..9e7954f`)

| ID | Fix | Commit(s) |
|---|---|---|
| S2 | Check-in vitals rows use a fresh `recorded_at` via `buildCheckinVitalsInsert` | `ad018ae` |
| S1 | Early SMS audit returns id; `linkEscalationCheckin` after `insertCheckin`; warn on soft-fail | `89e82f3`, `0e2ba64` |
| S3 | `qualityFromSensorContact`: contact lost → `quality: "poor"` | `6efac30` |
| async | `/family` and `/call` `await loadActiveScenario()` | `3eb446f` |
| urgent | `?state=urgent` → PE; harness adds `/family?state=urgent`; `attention` stays drift | `9e7954f` |

Per-task reviews were clean (S1 needed one logging fix loop). Full suite: **464 tests / 41 files**.

---

## 5. Pending work, in priority order

### P0 — user action, blocks everything

Get `ANTHROPIC_API_KEY` and the three Supabase values into `.env`, run `lib/db/schema.sql` in
the Supabase SQL editor (idempotent, self-seeds Margaret, includes `pain_score` and
`demo_state`), then mirror the keys to Vercel with `vercel env add <NAME> production` and
redeploy. Rehearse all three scenarios end to end and **record the backup video tonight.**

Merge / push `fix/p1-correctness` before or with that redeploy so production gets the P1 fixes.

### P1 — done on this branch

All five items from the prior handoff are implemented and task-reviewed. Remaining risk is
**live verification** (needs P0 keys), not missing code.

Presenter note: for the PE family deep link use **`/family?state=urgent`**. Never use
`attention` for the PE cut (`attention` = drift/amber).

### P2 — credibility polish, only if P0 is done

- **°C vs °F.** Do both engine rationale and display together, or neither.
- Family view at projector width is a narrow `max-w-md` column — sparse on stage.
- `SeverityChip` light red on solid red takeover — readable but low-contrast.
- Rehearse that `tel:911` does nothing on a desktop browser.

### Explicitly not doing

Thymia biomarkers and RTM adherence — parked. Clinician-patient messaging portal deprioritised.

---

## 6. Working preferences

- **Models:** Prefer Grok 4.5 (`cursor-grok-4.5-high-fast`) for implementation subagents.
- **Workflow:** subagent-driven development with a separate read-only reviewer pass.
- **Verification:** require real command output and actual screenshot viewing. State plainly
  what could *not* be verified — missing credentials leave many paths unproven.
- Honest status over reassurance.
