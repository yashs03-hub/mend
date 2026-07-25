# Clinical threshold provenance

**Status: OPEN. Every threshold in the engine is currently uncited.**

The numbers in `lib/clinical/` are clinically plausible but were not derived from
a document anyone can point a reviewer at. They came from general medical
knowledge. That is adequate for a synthetic-data prototype carrying a
not-medical-advice disclaimer, and it is not adequate for anything else.

This file records what needs a citation, where the citation should come from,
and — critically — the fact that a citation alone does not discharge the
obligation.

## Why a citation is necessary but not sufficient

Every instrument below was validated on **a clinician examining a patient in
person**, with the option of bloods, imaging, and a repeat look an hour later.
Mend has a phone call and four vitals. You cannot transplant a threshold across
that gap unchanged: it has to shift toward sensitivity, and *that shift is
itself a clinical decision* that needs its own recorded rationale and a named
person who signed it off.

So each rule needs three things, not one:

1. the source the original threshold came from,
2. the adjusted threshold actually used here,
3. why it moved, and who agreed.

## Register

| Rule / constant | Where it lives | Source it should come from |
|---|---|---|
| Generic deterioration (HR, BP, temp) | `red-flag-engine.ts` | **NEWS2** (Royal College of Physicians, 2017) — already a published deterministic lookup table. Adopt it rather than reinventing it. |
| Sepsis (`tempC ≥ 38.5` + `hr > 120`) | `red-flag-engine.ts` | **Sepsis-3** (Singer et al., *JAMA* 2016) qSOFA; **CMS SEP-1** for what a US emergency department will act on |
| PE / DVT (`hr > 110`, symptom pairs) | `red-flag-engine.ts` | **Wells** score, **PERC** rule; **CHEST** antithrombotic guidelines; **AAOS CPG on VTE prophylaxis in hip & knee arthroplasty** |
| Post-op fever envelope (`tempCMax` per phase) | `recovery-graph.ts` | **Adjudicated 2026-07-25** — PMIDs 24902928, 24522863, 36449067, 20452174, 23412504, 28851265. Early fever non-infectious window reduced from 13 days to 3 days; new Consolidation phase (POD 4–13) added at 37.8 °C; persistence escalation and severe fever red band implemented. |
| Wound infection / PJI | `red-flag-engine.ts` | **MSIS / ICM 2018** criteria; **CDC NHSN** surgical-site-infection surveillance definitions |
| Hip dislocation | `red-flag-engine.ts` | **AAOS Management of Hip Fractures in Older Adults (2021)**; arthroplasty instability literature |
| New confusion / delirium | `red-flag-engine.ts` | **4AT**, **CAM**; hip-fracture delirium incidence data |
| **Phase boundaries (days 0–3, 4–13, 14–41, 42+)** | `recovery-graph.ts` | **Adjudicated 2026-07-25** — Adjusted to align with post-operative fever literature showing fever transition at POD 3–6. |
| Rehab milestones and precautions | `recovery-graph.ts` | AAOS / APTA post-THA protocols — or the unit's own, which is more defensible for a demo |
| Plausibility ranges (HR 20–250 etc.) | `vitals.ts` | Device specifications, not clinical guidelines. These are artefact filters, not thresholds. |
| RPM / RTM CPT codes | `docs/business-case-asc.html` | **AMA CPT** descriptors + **CMS Physician Fee Schedule** final rule. These change annually — version-pin them. See the global-period caveat in the business case. |

## Two decisions already made without a source

Recorded here so they are not mistaken for derived numbers:

- **Breathlessness or chest pain without tachycardia returns amber, not green.**
  A normal heart rate does not exclude a pulmonary embolism. There is no
  citation behind the specific choice of amber-rather-than-red; it is a
  judgement that same-day assessment is proportionate when the symptom is
  uncorroborated.
- **No usable vitals plus no reported symptoms returns amber, not green.**
  Silence is not a normal result. This is a design principle rather than a
  clinical threshold, but it changes patient-facing behaviour, so it belongs
  here.

## Candidate literature (retrieved, not adjudicated)

`npm run evidence` queries PubMed via NCBI E-utilities — one query per row in
the register above — and writes a reading list to
[`data/evidence/READING-LIST.md`](../data/evidence/READING-LIST.md), with the
raw records in `data/evidence/candidates.json`.

**A retrieved PMID is not a citation.** A search engine cannot read a paper,
cannot confirm a threshold came from it, and certainly cannot judge whether a
threshold validated on an examined patient survives the move to a phone call
and four vitals. Presenting retrieved hits as provenance would manufacture the
*appearance* of evidence, which is worse than openly having none.

The workflow the reading list is built for:

> read → decide **supports / refutes / irrelevant** → record the verdict and the
> adjusted threshold here → get it signed off by a named clinician.

### Two retrieval passes, deliberately

`npm run evidence:elicit` runs the same ten claims through Elicit's semantic
search and cross-references the result against the PubMed hits. This is not
redundancy — the two methods fail in opposite directions:

| | Strength | Weakness |
|---|---|---|
| PubMed (boolean / MeSH) | Exhaustive on precise terminology | Poor at a conceptual question |
| Elicit (semantic) | Good at the question as asked | Weaker at exhaustive term coverage |

A paper surfaced independently by both is marked **★** and is the sensible place
to start reading. Requires `ELICIT_API_KEY` (Pro plan or above) — generate it
yourself at elicit.com/settings; it is never written into this repo.

For the load-bearing threshold, Elicit can also run a full screened and
extracted review:

```bash
npm run evidence:elicit -- --review postop-fever-envelope
```

That returns machine-screened, machine-extracted values. **Extraction is an LLM
reading papers.** It compresses the triage; it does not replace the read. Any
value that will end up telling an 82-year-old to call 911 needs a human who has
read the paper and a clinician who has signed it off.

Two things worth noting from the first retrieval:

- The post-operative fever query is the narrowest and most on-target: 27
  matches, several of them directly about the febrile course after hip and knee
  arthroplasty. That is the load-bearing threshold and the literature to ground
  it appears to exist.
- The threshold-transfer query — *has anyone studied how in-person deterioration
  thresholds behave under remote monitoring?* — returns **13 papers**, none of
  them orthopaedic. Interpret that carefully: a thin result is a hypothesis
  about a gap, not proof of one, and it may equally reflect the query. But if it
  holds up under a proper search, it is both the largest unquantified risk in
  this product and an obvious piece of research.

## Next step

Add a `source` field to the rule structures so the register above lives in the
code rather than beside it, and add a test asserting every rule carries a
non-empty source. That converts the weakest question a reviewer can ask — *did
you make these up?* — into the strongest thing you can show them.
