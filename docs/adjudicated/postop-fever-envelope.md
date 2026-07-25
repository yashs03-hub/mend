# Adjudicated: post-operative fever envelope

**Threshold under review:** `recovery-graph.ts` — `normalEnvelope.tempCMax`.

**Status: ⚠️ PARTIALLY SUPPORTED — the temperature is defensible, the original
day boundary was not.**

**Basis:** abstracts of all 27 PubMed matches, read 2026-07-25 via
`npm run abstracts -- --rule postop-fever-envelope --all`. Abstract-level only —
no full texts retrieved. Every number below needs confirming against the paper,
and any change to the engine needs a named clinician's sign-off.

---

## What the evidence supports

**38.0 °C is the conventional definition of post-operative fever**, used
consistently across the arthroplasty literature (PMIDs
[24902928](https://pubmed.ncbi.nlm.nih.gov/24902928/),
[24522863](https://pubmed.ncbi.nlm.nih.gov/24522863/),
[36449067](https://pubmed.ncbi.nlm.nih.gov/36449067/)). Using it as the early
ceiling is standard rather than invented.

**Early fever is expected and predominantly non-infectious** — the premise the
whole "don't cry wolf" design rests on:

| PMID | Finding |
|---|---|
| [10546613](https://pubmed.ncbi.nlm.nih.gov/10546613/) *Clin Orthop Relat Res* 1999 | 100 TKA + 100 THA. Max daily temp peaked on **POD 1**, levelled toward normal **by POD 5**. No documented joint infection. "Post-operative fever after total joint arthroplasty is a normal inflammatory response." |
| [28851265](https://pubmed.ncbi.nlm.nih.gov/28851265/) *J Orthop Surg* 2017 | Systematic review, 22 studies. Pyrexia prevalence 8.1–87.3%. "Early post-operative fever is an expected event." |
| [36449067](https://pubmed.ncbi.nlm.nih.gov/36449067/) *Arch Orthop Trauma Surg* 2023 | 675 arthroplasties. POF ≥38.0 in 13.2%, ≥38.5 in 3.1%. **Only 1 of 89 febrile patients developed early PJI.** |

**Mend's core design principle appears almost verbatim in the literature.**
PMID 10546613: *"A workup for sepsis is not indicated in the perioperative
period unless corroborating signs or symptoms are present."* PMID 36449067:
*"A fever-related diagnostic workup was rarely helpful in the absence of
clinical symptoms."* That is exactly the fuse-with-symptoms architecture the
engine implements.

## What the evidence contradicted — and what changed because of it

The original envelope ran **38.0 °C across days 0–13**. Three independent
studies put the discriminating boundary at POD 3–6, not 13:

| PMID | Finding | Implication |
|---|---|---|
| [20452174](https://pubmed.ncbi.nlm.nih.gov/20452174/) *J Arthroplasty* 2010 | n=1100. Fever **after POD 3** independently predicts a positive workup, **OR 23.3** (p<0.001) | boundary ~POD 3 |
| [23412504](https://pubmed.ncbi.nlm.nih.gov/23412504/) *J Orthop Trauma* 2013 | Positive diagnostic yield **40% at POD ≥6** vs **16% at POD 0–5** | ~POD 5–6 |
| [28851265](https://pubmed.ncbi.nlm.nih.gov/28851265/) *J Orthop Surg* 2017 | Workup unwarranted "on the third post-operative day or before" | ~POD 3 |

Concretely: under the original envelope a patient at day 10 with 37.9 °C read
**green**. An odds ratio of 23.3 is not a subtle correction.

**✅ Acted on.** `HIP_RECOVERY` now carries a **"Consolidation"** phase between
"Early protected" and "Progressive mobility", splitting the old 0–13 window at
the boundary the literature supports.

## What the evidence adds that the engine still does not model

**1. Persistence.** [24902928](https://pubmed.ncbi.nlm.nih.gov/24902928/)
(n=980): *consecutive* fever ≥3 days was significantly associated with
infection, independent of peak. *(Partially acted on — the engine now emits
`fever.persistent`.)*

**2. Magnitude bands.** Same paper plus
[20452174](https://pubmed.ncbi.nlm.nih.gov/20452174/): ≥39.0 °C carries a
materially higher positive rate (25.4% vs 6.9%). *(Acted on — `fever.severe`.)*

**3. Sub-38 temperatures matter later.**
[24522863](https://pubmed.ncbi.nlm.nih.gov/24522863/) found infected and
non-infected TKA patients differed in max temperature during weeks 2–4
**"including MTs less than 38 °C"** — direct support for the tighter late
ceiling, which was otherwise the most arbitrary number in the file.

**4. Our cohort runs hotter — STILL OPEN.**
[36449067](https://pubmed.ncbi.nlm.nih.gov/36449067/): **trauma** THA had ≥38.5
fever in **10.6%** vs **3.0%** elective (OR 3.88, p<0.01). Margaret is a
*hip-fracture hemiarthroplasty* — the trauma arm. A single envelope shared
between elective THA and trauma hemiarthroplasty will over-alarm exactly the
patients it was built for. Whether to carry separate elective/trauma envelopes
is a judgement call the evidence supports but does not decide.

## Not relevant (screened out)

Paediatric osteoarticular infection
([41174689](https://pubmed.ncbi.nlm.nih.gov/41174689/)), atlantoaxial
dislocation technique ([37166469](https://pubmed.ncbi.nlm.nih.gov/37166469/)),
COVID-era screening commentary
([32386473](https://pubmed.ncbi.nlm.nih.gov/32386473/)), 1997 malaria-endemic
cohort ([9487422](https://pubmed.ncbi.nlm.nih.gov/9487422/) — 5.7% of pyrexia
was malaria; different population and era). The procalcitonin papers
([20048106](https://pubmed.ncbi.nlm.nih.gov/20048106/),
[28353448](https://pubmed.ncbi.nlm.nih.gov/28353448/)) concern biomarker
discrimination rather than temperature thresholds, and assume bloods Mend does
not have.

## Limits of this adjudication

- **Abstracts only.** Exact cut-points, denominators and populations live in the
  full text.
- **Mostly elective TKA/THA inpatients.** Mend monitors a discharged trauma
  hemiarthroplasty patient at home. Every study above measured temperature on a
  ward, at known times, with a consistent device. **None validates a
  self-measured reading at home** — the threshold-transfer gap in
  `../CLINICAL_SOURCES.md`, still open.
- **One reader, no second screen.** A real review needs dual independent
  screening.

## Reproduce

```bash
npm run evidence                                        # PubMed candidates, no key
npm run abstracts -- --rule postop-fever-envelope --all # the 27 abstracts read here
npm run evidence:elicit                                 # semantic cross-reference (needs key)
```
