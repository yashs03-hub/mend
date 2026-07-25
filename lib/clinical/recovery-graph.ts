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

export const LATARJET_RECOVERY: Phase[] = [
  {
    name: "Sling immobilisation",
    dayStart: 0,
    dayEnd: 3,
    normalEnvelope: {
      tempCMax: 38.0,
      hrMax: 100,
      spo2Min: 94,
      source: THRESHOLD_SOURCE,
    },
    rehab: [
      "Elbow, wrist, and hand range-of-motion exercises",
      "Pendulum exercises (resting arm out of sling)",
      "Ball squeezes for forearm activation",
    ],
    precautions: [
      "Keep sling on at all times except during exercises or washing",
      "No active shoulder elevation (no lifting the arm using its own muscles)",
      "No external rotation past neutral (0 degrees)",
    ],
    weightBearing: "Non-weight-bearing (do not push up or lift with operated arm)",
  },
  {
    name: "Consolidation sling",
    dayStart: 4,
    dayEnd: 13,
    normalEnvelope: {
      tempCMax: 37.8,
      hrMax: 100,
      spo2Min: 94,
      source: THRESHOLD_SOURCE,
    },
    rehab: [
      "Elbow, wrist, and hand range-of-motion exercises",
      "Pendulum exercises (resting arm out of sling)",
      "Ball squeezes for forearm activation",
    ],
    precautions: [
      "Keep sling on at all times except during exercises or washing",
      "No active shoulder elevation (no lifting the arm using its own muscles)",
      "No external rotation past neutral (0 degrees)",
    ],
    weightBearing: "Non-weight-bearing (do not push up or lift with operated arm)",
  },
  {
    name: "Passive range of motion",
    dayStart: 14,
    dayEnd: 41,
    normalEnvelope: {
      tempCMax: 37.5,
      hrMax: 95,
      spo2Min: 94,
      source: THRESHOLD_SOURCE,
    },
    rehab: [
      "Sling weaning (usually off by week 6)",
      "Passive forward flexion (assisted by other arm)",
      "Passive external rotation progressing to 30 degrees",
      "Scapular shrugs and retraction",
    ],
    precautions: [
      "No active shoulder elevation or abduction",
      "No forced external rotation past 30 degrees",
      "No lifting objects heavier than a cup of water",
    ],
    weightBearing: "Non-weight-bearing",
  },
  {
    name: "Active and strengthening",
    dayStart: 42,
    dayEnd: 999,
    normalEnvelope: {
      tempCMax: 37.5,
      hrMax: 95,
      spo2Min: 94,
      source: THRESHOLD_SOURCE,
    },
    rehab: [
      "Active-assisted and active forward flexion/abduction",
      "Light resistance band rotation exercises",
      "Internal rotation behind the back",
      "Progressive loading under physical therapy guidance",
    ],
    precautions: [
      "Avoid sudden jerking movements",
      "No heavy lifting or contact sports until cleared by surgeon",
    ],
    weightBearing: "Full weight-bearing / progressive loading",
  },
];

/**
 * Days before the graph clamp to the first phase and days past it to the last,
 * so an out-of-range day never produces an undefined phase downstream.
 */
export function getPhase(dayPostOp: number, procedure: "hip" | "latarjet" = "hip"): Phase {
  const recovery = procedure === "latarjet" ? LATARJET_RECOVERY : HIP_RECOVERY;
  if (dayPostOp < recovery[0].dayStart) return recovery[0];
  const p = recovery.find(
    (ph) => dayPostOp >= ph.dayStart && dayPostOp <= ph.dayEnd,
  );
  return p ?? recovery[recovery.length - 1];
}
