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
| Post-op fever envelope (`tempCMax` per phase) | `recovery-graph.ts` | Arthroplasty-specific post-operative fever literature — early fever is predominantly non-infectious. **This is the single most load-bearing citation in the product**, because it is the rule that lets Mend not cry wolf. |
| Wound infection / PJI | `red-flag-engine.ts` | **MSIS / ICM 2018** criteria; **CDC NHSN** surgical-site-infection surveillance definitions |
| Hip dislocation | `red-flag-engine.ts` | **AAOS Management of Hip Fractures in Older Adults (2021)**; arthroplasty instability literature |
| New confusion / delirium | `red-flag-engine.ts` | **4AT**, **CAM**; hip-fracture delirium incidence data |
| **Phase boundaries (days 0–13, 14–41, 42+)** | `recovery-graph.ts` | **ACS NSQIP** 30-day complication *timing* for THA / hemiarthroplasty, plus **AJRR** registry data. This is the most invented part of the system and the part with the best available real data. |
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

## Next step

Add a `source` field to the rule structures so the register above lives in the
code rather than beside it, and add a test asserting every rule carries a
non-empty source. That converts the weakest question a reviewer can ask — *did
you make these up?* — into the strongest thing you can show them.
