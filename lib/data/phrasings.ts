import { Symptoms } from "@/lib/clinical/types";

/**
 * Phrase bank for the synthetic extraction corpus.
 *
 * Written in the voice of the persona — an 82-year-old speaking to a friendly
 * caller — because that is the distribution the extractor actually sees. A
 * corpus of clinical prose would flatter the model and teach it nothing.
 *
 * Each entry carries a `label`, which becomes ground truth by construction:
 * we know what the clause means because we chose what it means before we wrote
 * it down. That is what keeps this corpus non-circular.
 */

export type SymptomKey = keyof Symptoms;

export interface Clause {
  text: string;
  /** What this clause asserts. `{}` means it asserts nothing extractable. */
  label: Partial<Symptoms>;
  kind: "positive" | "negated" | "distractor" | "filler";
}

/** Clauses that should set a field true. */
const POSITIVE: Clause[] = [
  { text: "I'm a bit out of puff today", label: { breathless: true }, kind: "positive" },
  { text: "going to the bathroom left me really breathless", label: { breathless: true }, kind: "positive" },
  { text: "I get short of breath just walking to the kitchen", label: { breathless: true }, kind: "positive" },
  { text: "I can't seem to catch my breath properly", label: { breathless: true }, kind: "positive" },

  { text: "there's a sharp catch in my chest when I breathe deep", label: { chestPain: true }, kind: "positive" },
  { text: "my chest hurts when I take a big breath", label: { chestPain: true }, kind: "positive" },
  { text: "I've got a pain in my chest that comes and goes", label: { chestPain: true }, kind: "positive" },

  { text: "my right calf has been sore and swollen", label: { calfPainOrSwelling: true }, kind: "positive" },
  { text: "the back of my leg is tender and a bit puffy", label: { calfPainOrSwelling: true }, kind: "positive" },
  { text: "my calf feels tight and it hurts to squeeze it", label: { calfPainOrSwelling: true }, kind: "positive" },

  { text: "there's some yellow discharge coming from the wound", label: { woundDischarge: true }, kind: "positive" },
  { text: "the dressing was oozing this morning", label: { woundDischarge: true }, kind: "positive" },
  { text: "the cut has started weeping a bit", label: { woundDischarge: true }, kind: "positive" },

  { text: "I've been feeling feverish and shivery", label: { feverSubjective: true }, kind: "positive" },
  { text: "I came over all hot and cold in the night", label: { feverSubjective: true }, kind: "positive" },
  { text: "I had chills earlier", label: { feverSubjective: true }, kind: "positive" },

  { text: "the hip went pop when I stood up and the pain was awful", label: { suddenSevereHipPain: true }, kind: "positive" },
  { text: "I got a sudden severe pain in the hip out of nowhere", label: { suddenSevereHipPain: true }, kind: "positive" },
  { text: "my leg gave way and the pain was terrible", label: { suddenSevereHipPain: true }, kind: "positive" },

  { text: "that leg looks shorter than the other one now", label: { legShortenedOrRotated: true }, kind: "positive" },
  { text: "my foot is turned out funny compared to before", label: { legShortenedOrRotated: true }, kind: "positive" },

  { text: "I can't put any weight on it at all", label: { unableToWeightBear: true }, kind: "positive" },
  { text: "I can't stand on that leg this morning", label: { unableToWeightBear: true }, kind: "positive" },

  { text: "my daughter says I've been muddled since yesterday", label: { newConfusion: true }, kind: "positive" },
  { text: "I got confused about what day it was", label: { newConfusion: true }, kind: "positive" },

  { text: "the pain is bad and the tablets aren't helping", label: { painControlled: false }, kind: "positive" },
  { text: "it's absolute agony by the evening", label: { painControlled: false }, kind: "positive" },
  { text: "the pain relief isn't touching it", label: { painControlled: false }, kind: "positive" },

  { text: "the pain is fine, quite manageable", label: { painControlled: true }, kind: "positive" },
  { text: "it's sore but nothing I can't handle", label: { painControlled: true }, kind: "positive" },
  { text: "the pain is under control with the tablets", label: { painControlled: true }, kind: "positive" },
];

/**
 * Clauses that mention a symptom in order to DENY it.
 *
 * These are the adversarial core of the corpus. A naive keyword matcher scores
 * these exactly backwards — "no chest pain at all" contains "chest pain" — and
 * a false positive here escalates a well patient, which is how a monitoring
 * product loses a clinician's trust permanently.
 */
const NEGATED: Clause[] = [
  { text: "no chest pain at all, thankfully", label: {}, kind: "negated" },
  { text: "I've had no chest pain since the operation", label: {}, kind: "negated" },
  { text: "I'm not breathless, my breathing's been fine", label: {}, kind: "negated" },
  { text: "no shortness of breath to speak of", label: {}, kind: "negated" },
  { text: "no calf pain or swelling that I can see", label: {}, kind: "negated" },
  { text: "my calf is fine, no swelling", label: {}, kind: "negated" },
  { text: "there's no discharge from the wound, it's dry", label: {}, kind: "negated" },
  { text: "no oozing, the dressing is clean", label: {}, kind: "negated" },
  { text: "I haven't had any fever or chills", label: {}, kind: "negated" },
  { text: "no confusion, I'm sharp as ever", label: {}, kind: "negated" },
  { text: "I can still put weight on it, no trouble", label: {}, kind: "negated" },
];

/** Clauses that name a body part or worry without asserting a red flag. */
const DISTRACTOR: Clause[] = [
  { text: "my other hip aches a bit, the one they didn't do", label: {}, kind: "distractor" },
  { text: "the physiotherapist mentioned watching out for calf pain", label: {}, kind: "distractor" },
  { text: "my husband had a chest infection last winter", label: {}, kind: "distractor" },
  { text: "the nurse asked about breathlessness when she rang", label: {}, kind: "distractor" },
  { text: "I read a leaflet about blood clots in the leg", label: {}, kind: "distractor" },
  { text: "my shoulder is stiff from using the frame", label: {}, kind: "distractor" },
  { text: "the scar looks neat, the district nurse was pleased", label: {}, kind: "distractor" },
];

/** Clauses carrying no clinical signal, to keep transcripts realistic. */
const FILLER: Clause[] = [
  { text: "I slept alright, thank you for asking", label: {}, kind: "filler" },
  { text: "my daughter came round with the shopping", label: {}, kind: "filler" },
  { text: "I did my exercises before lunch", label: {}, kind: "filler" },
  { text: "I walked to the kitchen with the frame", label: {}, kind: "filler" },
  { text: "the weather's been lovely", label: {}, kind: "filler" },
  { text: "I've been eating properly, don't worry", label: {}, kind: "filler" },
  { text: "I watched a bit of telly this afternoon", label: {}, kind: "filler" },
];

export const CLAUSES = { POSITIVE, NEGATED, DISTRACTOR, FILLER };

export const ALL_CLAUSES: Clause[] = [
  ...POSITIVE,
  ...NEGATED,
  ...DISTRACTOR,
  ...FILLER,
];
