import { Phase } from "./types";

const THRESHOLD_SOURCE =
  "Plausible-but-uncited: general post-op physiology. Needs NEWS2/AAOS citation before clinical use.";

/**
 * Hip arthroplasty recovery graph (elective THA + hip-fracture hemiarthroplasty).
 *
 * The `normalEnvelope` is what makes the engine specific rather than merely
 * sensitive: 37.8 C on day 2 is inside the early envelope and stays green,
 * while the same reading on day 21 is outside it and escalates.
 *
 * NOTE: these thresholds and phase boundaries are clinically plausible but are
 * NOT yet sourced. See docs/CLINICAL_SOURCES.md — every number here needs a
 * named citation and medical-director sign-off before any non-synthetic use.
 */
export const HIP_RECOVERY: Phase[] = [
  {
    name: "Early protected",
    dayStart: 0,
    dayEnd: 3,
    normalEnvelope: {
      tempCMax: 38.0,
      hrMax: 100,
      spo2Min: 94,
      source: THRESHOLD_SOURCE,
    },
    rehab: [
      "Ankle pumps every hour while awake",
      "Static quadriceps squeezes",
      "Assisted sit-to-stand",
      "Short walks with your frame or walker",
    ],
    precautions: [
      "No bending the hip past 90 degrees",
      "No crossing your legs or bringing the operated leg past the midline",
      "No twisting on the operated leg",
    ],
    weightBearing: "Weight-bear as tolerated with a frame/walker",
  },
  {
    name: "Consolidation",
    dayStart: 4,
    dayEnd: 13,
    normalEnvelope: {
      tempCMax: 37.8,
      hrMax: 100,
      spo2Min: 94,
      source: THRESHOLD_SOURCE,
    },
    rehab: [
      "Ankle pumps every hour while awake",
      "Static quadriceps squeezes",
      "Assisted sit-to-stand",
      "Short walks with your frame or walker",
    ],
    precautions: [
      "No bending the hip past 90 degrees",
      "No crossing your legs or bringing the operated leg past the midline",
      "No twisting on the operated leg",
    ],
    weightBearing: "Weight-bear as tolerated with a frame/walker",
  },
  {
    name: "Progressive mobility",
    dayStart: 14,
    dayEnd: 41,
    normalEnvelope: {
      tempCMax: 37.5,
      hrMax: 95,
      spo2Min: 94,
      source: THRESHOLD_SOURCE,
    },
    rehab: [
      "Progress to a single stick",
      "Side-lying hip abduction",
      "Standing hip extension",
      "Stairs one step at a time",
    ],
    precautions: [
      "Keep to your hip precautions",
      "Avoid low chairs and deep sofas",
    ],
    weightBearing: "Weight-bear as tolerated, weaning the walking aid",
  },
  {
    name: "Strengthening",
    dayStart: 42,
    dayEnd: 999,
    normalEnvelope: {
      tempCMax: 37.5,
      hrMax: 95,
      spo2Min: 94,
      source: THRESHOLD_SOURCE,
    },
    rehab: [
      "Resistance band abduction",
      "Mini squats to a chair",
      "Balance work",
      "Stationary cycling",
    ],
    precautions: ["Return to driving only when your surgeon has cleared you"],
    weightBearing: "Full weight-bearing",
  },
];


/**
 * Days before the graph clamp to the first phase and days past it to the last,
 * so an out-of-range day never produces an undefined phase downstream.
 */
export function getPhase(dayPostOp: number): Phase {
  const recovery = HIP_RECOVERY;
  if (dayPostOp < recovery[0].dayStart) return recovery[0];
  const p = recovery.find(
    (ph) => dayPostOp >= ph.dayStart && dayPostOp <= ph.dayEnd,
  );
  return p ?? recovery[recovery.length - 1];
}
