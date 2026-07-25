/**
 * PubMed queries, one per uncited threshold in docs/CLINICAL_SOURCES.md.
 *
 * ⚠️ WHAT THIS CAN AND CANNOT DO.
 *
 * A search returns *candidate* literature. It cannot read a paper, cannot
 * confirm that a threshold came from it, and cannot tell you whether the
 * threshold transfers to remote monitoring. Every hit here is a reading
 * suggestion for a human, not a citation.
 *
 * Treating retrieved PMIDs as provenance would be worse than having no
 * citations at all: it manufactures the appearance of evidence, which is
 * exactly the failure this file exists to avoid.
 */

export interface EvidenceQuery {
  /** Matches the rule or constant it is meant to support. */
  ruleId: string;
  /** Where the threshold lives in the code. */
  location: string;
  /** The specific claim a human needs to confirm or refute. */
  claimToVerify: string;
  /** PubMed search string (E-utilities `term`). */
  term: string;
}

const HUMAN = 'AND humans[MeSH Terms] AND english[Language]';

export const EVIDENCE_QUERIES: EvidenceQuery[] = [
  {
    ruleId: "deterioration-score",
    location: "red-flag-engine.ts — HR/BP/temp thresholds generally",
    claimToVerify:
      "NEWS2 is the appropriate published basis for generic deterioration thresholds, and what its validated cut-points are.",
    term: `("NEWS2"[tiab] OR "National Early Warning Score"[tiab]) AND (validation[tiab] OR "predictive value"[tiab] OR derivation[tiab]) ${HUMAN}`,
  },
  {
    ruleId: "sepsis",
    location: "red-flag-engine.ts — tempC >= 38.5 AND hr > 120",
    claimToVerify:
      "The fever-plus-tachycardia pair used here is defensible against Sepsis-3 / qSOFA rather than invented.",
    term: `("Sepsis-3"[tiab] OR qSOFA[tiab] OR "quick SOFA"[tiab]) AND (criteria[tiab] OR definition[tiab] OR validation[tiab]) ${HUMAN}`,
  },
  {
    ruleId: "pe-vte",
    location: "red-flag-engine.ts — breathless/chestPain + hr > 110",
    claimToVerify:
      "Heart rate > 110 is a supportable corroborating threshold for suspected PE, and what proportion of PE presents WITHOUT tachycardia.",
    term: `("pulmonary embolism"[tiab] AND (tachycardia[tiab] OR "heart rate"[tiab]) AND (sensitivity[tiab] OR "clinical presentation"[tiab] OR "vital signs"[tiab])) ${HUMAN}`,
  },
  {
    ruleId: "vte-after-hip",
    location: "recovery-graph.ts — implied VTE risk window",
    claimToVerify:
      "When VTE actually peaks after hip arthroplasty, which determines whether the monitoring window is the right length.",
    term: `("venous thromboembolism"[tiab] OR "deep vein thrombosis"[tiab] OR "pulmonary embolism"[tiab]) AND ("hip arthroplasty"[tiab] OR "hip replacement"[tiab] OR hemiarthroplasty[tiab]) AND (incidence[tiab] OR timing[tiab] OR "postoperative day"[tiab]) ${HUMAN}`,
  },
  {
    ruleId: "postop-fever-envelope",
    location: "recovery-graph.ts — tempCMax 38.0 (days 0-13), 37.5 thereafter",
    claimToVerify:
      "THE LOAD-BEARING ONE. That early post-operative fever is predominantly non-infectious, and what temperature/day cut-point the literature supports.",
    term: `("postoperative fever"[tiab] OR "post-operative pyrexia"[tiab]) AND (arthroplasty[tiab] OR orthopedic[tiab] OR orthopaedic[tiab] OR "joint replacement"[tiab]) AND (infection[tiab] OR "non-infectious"[tiab] OR workup[tiab] OR evaluation[tiab]) ${HUMAN}`,
  },
  {
    ruleId: "pji-wound",
    location: "red-flag-engine.ts — woundDischarge, temp above envelope",
    claimToVerify:
      "Wound discharge plus fever maps onto recognised PJI / surgical-site-infection criteria.",
    term: `("periprosthetic joint infection"[tiab] AND (criteria[tiab] OR diagnosis[tiab]) AND (MSIS[tiab] OR "International Consensus"[tiab] OR definition[tiab])) ${HUMAN}`,
  },
  {
    ruleId: "dislocation",
    location: "red-flag-engine.ts — suddenSevereHipPain + shortened/rotated OR non-weight-bearing",
    claimToVerify:
      "The shortened-and-rotated / unable-to-weight-bear pair is the recognised presentation of prosthetic dislocation.",
    term: `(("hip dislocation"[tiab] OR "prosthetic dislocation"[tiab]) AND (arthroplasty[tiab] OR hemiarthroplasty[tiab]) AND (presentation[tiab] OR diagnosis[tiab] OR "clinical features"[tiab])) ${HUMAN}`,
  },
  {
    ruleId: "delirium",
    location: "red-flag-engine.ts — newConfusion -> amber",
    claimToVerify:
      "New confusion warrants same-day rather than emergency escalation in this cohort, and how often it signals something else.",
    term: `(delirium[tiab] AND ("hip fracture"[tiab] OR "hip arthroplasty"[tiab]) AND (incidence[tiab] OR "risk factors"[tiab] OR outcome[tiab] OR 4AT[tiab])) ${HUMAN}`,
  },
  {
    ruleId: "phase-boundaries",
    location: "recovery-graph.ts — day 0-13 / 14-41 / 42+",
    claimToVerify:
      "MOST INVENTED PART OF THE SYSTEM. When complications actually occur after hip arthroplasty, which is what the phase boundaries should track.",
    term: `(("total hip arthroplasty"[tiab] OR hemiarthroplasty[tiab]) AND (complications[tiab] OR readmission[tiab]) AND (timing[tiab] OR "30-day"[tiab] OR NSQIP[tiab])) ${HUMAN}`,
  },
  {
    ruleId: "ohs-instrument",
    location: "lib/clinical/ohs.ts — item set, 0-48 scoring, bands, MIC",
    claimToVerify:
      "That the 0-48 higher-is-better scoring is the current form rather than the original 1-5/12-60 lower-is-better one, what the published band cut-points are, and what change counts as meaningful for an individual patient.",
    term: `("Oxford hip score"[tiab] OR "Oxford hip"[ti]) AND (validation[tiab] OR scoring[tiab] OR "minimal important"[tiab] OR responsiveness[tiab] OR interpretation[tiab]) ${HUMAN}`,
  },
  {
    ruleId: "remote-monitoring-transfer",
    location: "docs/CLINICAL_SOURCES.md — the threshold-transfer problem",
    claimToVerify:
      "Whether anyone has studied how in-person-validated deterioration thresholds behave under remote monitoring — the gap this whole product sits in.",
    term: `("remote patient monitoring"[tiab] OR telemonitoring[tiab]) AND (postoperative[tiab] OR "post-discharge"[tiab]) AND (surgery[tiab] OR arthroplasty[tiab]) AND (deterioration[tiab] OR readmission[tiab] OR "early warning"[tiab]) ${HUMAN}`,
  },
  {
    // ADJUDICATED 2026-07-25 — docs/adjudicated/voice-followup-precedent.md.
    // Ufonia's Dora is the published precedent for this product category:
    // autonomous AI telephone follow-up after day-case surgery, deployed in
    // routine NHS care. Kept as a standing query because the benchmarks Mend is
    // measured against (false-green rate, call completion, acceptability) move
    // as that literature grows.
    ruleId: "voice-followup-precedent",
    location: "product-level — not a rule; benchmarks in docs/adjudicated/voice-followup-precedent.md",
    claimToVerify:
      "What false-negative rate, call-completion rate and patient-acceptability scores an autonomous post-operative voice assistant achieves in routine deployment, and whether those transfer beyond the cataract pathway.",
    term: `(("conversational agent"[tiab] OR "voice assistant"[tiab] OR "automated telephone"[tiab] OR "autonomous"[tiab]) AND (postoperative[tiab] OR "follow-up"[tiab]) AND (safety[tiab] OR acceptability[tiab] OR accuracy[tiab] OR deployment[tiab])) ${HUMAN}`,
  },
];
