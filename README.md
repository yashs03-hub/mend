# Mend

**A voice-first recovery co-pilot for orthopaedic patients after they go home.**

Between discharge and the six-week clinic, nobody is watching. Complications cluster in
exactly that window — venous thromboembolism, surgical site infection, dislocation,
delirium — and the patients least able to use an app are the ones most at risk. Mend calls
them instead.

> ⚠️ **Educational prototype — not medical advice. All data is synthetic.**
> Mend routes concerns to a clinician; it does not diagnose, and it must not be used for
> real patient care. See [Safety](#safety).

---

## The thesis

**LLMs at the edges. A deterministic core.**

```
  voice call  ──▶  Claude          ──▶  red-flag engine  ──▶  Claude        ──▶  clinician
  (ElevenLabs)     extracts             DETERMINISTIC          writes SBAR
                   symptoms             green/amber/red        summary
  wearables   ──▶  vitals
  (HR/BP/ECG/temp) normalised
```

The language model transcribes, extracts structured symptoms, and writes the handoff note.
It **never decides whether to escalate**. Every green/amber/red verdict comes from a plain
TypeScript rule table that is auditable, unit-tested, and reproducible — the same inputs
always produce the same verdict, and every verdict carries the list of rules that fired.

That boundary is the product. It is also what separates this from a chatbot with a
stethoscope emoji.

## Scope

| | |
|---|---|
| **Setting** | At home, post-discharge — *not* the inpatient ward |
| **Hero procedure** | Hip arthroplasty (elective THA + hip-fracture hemiarthroplasty) |
| **Persona** | 82F, hemiarthroplasty after hip fracture, discharged POD 3, living alone |
| **Market** | US — RPM (`99453/99454/99457/99458`) and RTM (`98975/98977/98980/98981`) |
| **Inputs** | Voice check-in + heart rate, blood pressure, 3-lead ECG, temperature |

The ward already has nurses, mandated observations and a crash team. Home has none of
those, no billing pathway competitor, and a hospital that pays real money for readmissions
it never saw coming.

## Getting started

```bash
npm install
npm test          # 59 tests — the clinical core must be green before anything ships
npm run dev       # http://localhost:3000
```

**It runs with no keys at all.** Without `ANTHROPIC_API_KEY` the app falls back to a
deterministic keyword extractor and a deterministic SBAR; without Supabase it skips
persistence; without an ElevenLabs agent id the voice widget hides itself. Every fallback
is labelled in the UI rather than degrading silently — so a dead venue wifi costs you
fluency, not the demo.

To run it fully, copy `.env.local.example` to `.env.local` and fill in your own keys.
**Never commit `.env*`** — it is gitignored, and it should stay that way.

### Demo script

Three scenarios, in the order they land:

1. **Day 1 home · stable** → green, rehab plan, no clinician note generated.
2. **37.8 °C · move the day** → run it on day 4 (green), then change the day to 21 and run
   it again (amber). The vitals do not move; the verdict does. This is the specificity
   beat — the engine is stage-aware, not threshold-blind.
3. **Day 6 home · escalation** → breathlessness and pleuritic chest pain, corroborated by
   HR 122 sinus tachycardia → red, *Call 911*, with a full SBAR handoff.

The "Why" panel under every verdict lists the rules that actually fired, attributed to
`red-flag-engine.ts`. That is the pitch in one glance: the decision is derived, not
generated.

## Safety

- Synthetic data only. No real patient data enters this repo, ever.
- The disclaimer is rendered in the UI, not buried in a footer.
- Escalation advice routes to a human clinician. Mend does not diagnose.
- The red-flag engine fails **toward** escalation: when vitals are missing or implausible,
  symptom-only rules still apply rather than silently downgrading a verdict.

### Known gap: threshold provenance

Every clinical threshold in the engine is **plausible but uncited**. The full register of
what needs a source, and why a citation alone is not sufficient, is in
[`docs/CLINICAL_SOURCES.md`](docs/CLINICAL_SOURCES.md). This gates any non-synthetic use.

## Synthetic data and evaluation

```bash
npm run generate:data    # writes data/*.jsonl (seeded — same seed, same corpus)
npm run eval:data        # scores the extractor and diffs the engine vs the rubric
npm run evidence         # pulls candidate literature from PubMed for each threshold
```

Two corpora, and they prove different things:

| | Tests | Labels from | What it proves |
|---|---|---|---|
| `extraction-corpus.jsonl` (1,200) | transcript → `Symptoms` | generator intent — ground truth by construction | Real accuracy. Non-circular. |
| `vignettes.jsonl` (2,000) | day + symptoms + vitals → severity | `lib/data/rubric.ts`, an independently written second opinion | Disagreements = a bug in one of the two. **Agreement ≠ correct.** |

That second distinction matters. Labelling vignettes with `evaluate()` would score
100% by construction and tell you nothing — so the rubric is written separately, in
a different shape, and the eval prints a standing reminder that agreement between
two implementations by the same author is internal consistency, not clinical
validity.

The corpus has already paid for itself: it found the offline extractor scoring
**470 false positives across 533 transcripts containing an explicit denial**
("no chest pain at all" → chest pain). Now 1. See `lib/llm/extract.ts`.

### Evidence retrieval

```bash
npm run evidence           # PubMed (NCBI E-utilities) — no key required
npm run evidence:elicit    # Elicit semantic search — needs ELICIT_API_KEY
```

Two passes on purpose. PubMed is boolean/MeSH: exhaustive on precise terminology,
poor at a conceptual question. Elicit is semantic: good at the question as asked,
weaker at term coverage. They fail in opposite directions, so a paper found by
**both** (marked ★) is a genuinely stronger candidate than one found by either.

**Retrieved PMIDs are candidates, not citations.** A search cannot read a paper,
confirm a threshold came from it, or judge whether a value validated on an examined
patient survives the move to a phone call and four vitals.

## Repo layout

```
lib/clinical/     the deterministic core — no network, no keys, fully unit-tested
  types.ts            shared types; Symptoms is the LLM's only output
  recovery-graph.ts   hip phases + per-phase normal envelopes
  vitals.ts           quality and plausibility gate
  red-flag-engine.ts  evaluate() — the only thing that decides green/amber/red
lib/llm/          the edges — extraction in, SBAR out; both degrade to deterministic
lib/sim/          simulated device feed standing in for real peripherals
lib/data/         corpus generators, the independent rubric, PubMed query set
app/              Next.js App Router UI + /api/checkin
scripts/          dataset generation, evaluation, evidence retrieval
data/             generated corpora + retrieved reading lists (all synthetic)
docs/             design spec, implementation plan, ASC business case, mockup
```

`docs/mockups/mend-ui-mockup.html` is standalone — open it directly, no build step.

## Stack

Next.js 16 (App Router, TypeScript) · ElevenLabs Conversational AI · Claude (Opus 5) ·
Supabase · Vitest · Vercel
