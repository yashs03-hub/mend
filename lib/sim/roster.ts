import { composeDecision } from "../clinical/compose";
import { getPhase } from "../clinical/recovery-graph";
import { evaluate } from "../clinical/red-flag-engine";
import { evaluateTrends } from "../clinical/trends";
import type {
  Decision,
  EcgReading,
  Phase,
  Symptoms,
  TrendFinding,
  VitalsReading,
} from "../clinical/types";
import type { BillingPeriod } from "../clinical/billing";
import { buildFallbackSbar } from "../llm/sbar";
import { type Scenario, scenarioHistory, scenarioVitals } from "./fixtures";

/**
 * Five synthetic patients for the clinician worklist.
 *
 * One patient is a demo; a worklist is a product. The point of this file is
 * that the fifth patient costs the same as the first, and that none of them
 * is written prose: every severity, condition, fired rule, rationale, trend
 * finding and SBAR on the clinician screens is produced here by running the
 * real `evaluate()`, `evaluateTrends()`, `composeDecision()` and
 * `buildFallbackSbar()` over a declared series of readings. Change a
 * threshold in the recovery graph and this roster re-sorts itself.
 *
 * What is authored is only the physiology: for each patient, one row per
 * post-op day of what they said and what their devices read. Margaret's
 * acute day-4 reading and Alan's fourteen-day drift come straight from
 * `lib/sim/fixtures.ts`, so the worklist, the call view and the trend engine
 * are all looking at the same numbers.
 *
 * No database is involved. `lib/db/supabase.ts` returns null without
 * credentials and every clinician screen renders from this file regardless,
 * which is the state a teammate cloning the repo is in.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;

/** Clinical review time logged against a check-in, by what it turned out to be. */
const MANAGEMENT_MINUTES: Record<Decision["level"], number> = {
  red: 22,
  amber: 8,
  green: 2,
};

interface DayProfile {
  day: number;
  /** What the patient said, in their own words. Rendered in serif. */
  said: string;
  symptoms: Symptoms;
  /** Literal readings, or omitted in favour of `scenario`. */
  vitals?: Omit<VitalsReading, "timestamp" | "source" | "quality"> &
    Partial<Pick<VitalsReading, "source" | "quality">>;
  /** Takes the reading from `lib/sim/fixtures.ts` instead of restating it. */
  scenario?: Scenario;
  ecg?: EcgReading["determination"];
  /** Set when a clinician has already dealt with this one. */
  acknowledgedBy?: string;
  callSeconds: number;
}

interface PatientProfile {
  id: string;
  name: string;
  age: number;
  procedure: string;
  caregiver: string;
  /** Minutes before "now" that today's check-in landed; drives worklist recency. */
  lastCheckinMinutesAgo: number;
  days: DayProfile[];
}

export interface CheckinRecord {
  id: string;
  dayPostOp: number;
  at: string;
  said: string;
  symptoms: Symptoms;
  vitals: VitalsReading;
  ecg?: EcgReading;
  /** `evaluate()` on this reading alone, before any trajectory is considered. */
  baseDecision: Decision;
  /** Findings from `evaluateTrends()` over every reading up to and including this one. */
  trendFindings: TrendFinding[];
  /** `composeDecision()` of the two. This is the verdict the patient was given. */
  decision: Decision;
  sbar: string;
  callSeconds: number;
  managementMinutes: number;
  acknowledgedBy?: string;
}

export interface RosterPatient {
  id: string;
  name: string;
  age: number;
  procedure: string;
  caregiver: string;
  surgeryDate: string;
  dayPostOp: number;
  phase: Phase;
  /** Oldest first. */
  checkins: CheckinRecord[];
  latest: CheckinRecord;
  /** Non-green check-ins nobody has signed off yet. */
  openEscalations: number;
  /** Non-green check-ins a clinician has already dealt with. */
  closedEscalations: number;
  billing: BillingPeriod;
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const PROFILES: PatientProfile[] = [
  {
    id: "margaret-ellison",
    name: "Margaret Ellison",
    age: 82,
    procedure: "Hip hemiarthroplasty",
    caregiver: "Sarah Ellison (daughter)",
    lastCheckinMinutesAgo: 34,
    days: [
      {
        day: 0,
        said: "Sore, but they had me on my feet with the frame before lunch.",
        symptoms: { painScore: 6, painControlled: true },
        vitals: { hr: 88, sbp: 118, dbp: 74, tempC: 37.2, spo2: 96, respRate: 16 },
        ecg: "normal_sinus_rhythm",
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 214,
      },
      {
        day: 1,
        said: "I slept badly but the pain is no worse than yesterday.",
        symptoms: { painScore: 5, painControlled: true },
        vitals: { hr: 84, sbp: 120, dbp: 76, tempC: 37.1, spo2: 97, respRate: 15 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 158,
      },
      {
        day: 2,
        said: "I got to the end of the hall and back twice.",
        symptoms: { painScore: 4, painControlled: true },
        vitals: { hr: 80, sbp: 122, dbp: 78, tempC: 37.0, spo2: 97, respRate: 16 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 141,
      },
      {
        day: 3,
        said: "Four out of ten. The ankle pumps are getting easier.",
        symptoms: { painScore: 4, painControlled: true },
        vitals: { hr: 78, sbp: 122, dbp: 78, tempC: 36.9, spo2: 97, respRate: 16 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 132,
      },
      {
        day: 4,
        said: "I got up to the bathroom and I had to sit down halfway. My chest feels tight.",
        symptoms: { painScore: 4, painControlled: true, breathless: true, chestPain: true },
        // The same acute reading /call escalates on, taken from the fixture
        // rather than retyped, so the two screens cannot drift apart.
        scenario: "pe",
        ecg: "tachycardia",
        callSeconds: 79,
      },
    ],
  },
  {
    id: "doris-whitfield",
    name: "Doris Whitfield",
    age: 74,
    procedure: "Cemented total hip replacement",
    caregiver: "Raymond Whitfield (husband)",
    lastCheckinMinutesAgo: 131,
    days: [
      {
        day: 0,
        said: "Groggy. They say the hip went well.",
        symptoms: { painScore: 6, painControlled: true },
        vitals: { hr: 82, sbp: 128, dbp: 80, tempC: 36.9, spo2: 97, respRate: 16 },
        ecg: "normal_sinus_rhythm",
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 189,
      },
      {
        day: 1,
        said: "Managed the stairs with the physio holding on.",
        symptoms: { painScore: 5, painControlled: true },
        vitals: { hr: 80, sbp: 126, dbp: 78, tempC: 37.0, spo2: 97, respRate: 15 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 166,
      },
      {
        day: 2,
        said: "Same as yesterday, really.",
        symptoms: { painScore: 5, painControlled: true },
        vitals: { hr: 78, sbp: 124, dbp: 78, tempC: 36.9, spo2: 98, respRate: 16 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 121,
      },
      {
        day: 3,
        said: "A bit weepy. My husband says that's normal.",
        symptoms: { painScore: 4, painControlled: true },
        vitals: { hr: 82, sbp: 126, dbp: 80, tempC: 37.0, spo2: 97, respRate: 16 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 174,
      },
      {
        day: 4,
        said: "The dressing looks a bit pink but it isn't sore.",
        symptoms: { painScore: 4, painControlled: true },
        vitals: { hr: 84, sbp: 126, dbp: 80, tempC: 37.1, spo2: 97, respRate: 16 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 152,
      },
      {
        day: 5,
        said: "I feel a bit warm but I've had the heating on.",
        symptoms: { painScore: 4, painControlled: true },
        vitals: { hr: 86, sbp: 124, dbp: 78, tempC: 37.2, spo2: 97, respRate: 16 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 143,
      },
      {
        day: 6,
        said: "Warm again this morning. The wound is weeping a little.",
        symptoms: { painScore: 4, painControlled: true },
        vitals: { hr: 88, sbp: 124, dbp: 78, tempC: 37.4, spo2: 96, respRate: 17 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 168,
      },
      {
        day: 7,
        said: "There's a bit of yellow on the dressing now.",
        symptoms: { painScore: 5, painControlled: true, woundDischarge: true },
        vitals: { hr: 90, sbp: 122, dbp: 78, tempC: 37.6, spo2: 96, respRate: 17 },
        acknowledgedBy: "M. Adeyemi, NP",
        callSeconds: 205,
      },
      {
        day: 8,
        said: "I was shivery in the night and I've taken paracetamol.",
        symptoms: { painScore: 5, painControlled: true, woundDischarge: true },
        vitals: { hr: 92, sbp: 120, dbp: 76, tempC: 38.1, spo2: 96, respRate: 18 },
        callSeconds: 221,
      },
      {
        day: 9,
        said: "Still hot, and there's more coming from the wound than yesterday.",
        symptoms: { painScore: 5, painControlled: true, woundDischarge: true },
        vitals: { hr: 94, sbp: 120, dbp: 76, tempC: 38.3, spo2: 96, respRate: 18 },
        ecg: "normal_sinus_rhythm",
        callSeconds: 243,
      },
    ],
  },
  {
    // Female, like the rest of the roster, because `projectionClause` in
    // lib/clinical/trends.ts writes "she" into every projected-breach
    // sentence. That module is under test and not this task's to change, so
    // the roster is written to be true rather than the engine bent to fit it.
    id: "eileen-prosser",
    name: "Eileen Prosser",
    age: 68,
    procedure: "Dynamic hip screw fixation",
    caregiver: "Dai Prosser (husband)",
    lastCheckinMinutesAgo: 187,
    // Filled from scenarioHistory("drift") below: the resting heart rate
    // climbing 3 bpm a day while every single reading stays inside the
    // envelope. This is the case a threshold alone never catches.
    days: [],
  },
  {
    id: "beatrice-nkemelu",
    name: "Beatrice Nkemelu",
    age: 71,
    procedure: "Total hip replacement",
    caregiver: "Chidi Nkemelu (son)",
    lastCheckinMinutesAgo: 316,
    days: [
      {
        day: 0,
        said: "It hurts, but less than the arthritis did.",
        symptoms: { painScore: 6, painControlled: true },
        vitals: { hr: 78, sbp: 126, dbp: 80, tempC: 37.0, spo2: 97, respRate: 16 },
        ecg: "normal_sinus_rhythm",
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 172,
      },
      {
        day: 1,
        said: "Slept four hours. Up with the frame twice.",
        symptoms: { painScore: 5, painControlled: true },
        vitals: { hr: 76, sbp: 124, dbp: 78, tempC: 36.9, spo2: 98, respRate: 15 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 149,
      },
      {
        day: 2,
        said: "My son is staying this week so I'm not doing the stairs alone.",
        symptoms: { painScore: 5, painControlled: true },
        vitals: { hr: 79, sbp: 122, dbp: 78, tempC: 37.1, spo2: 97, respRate: 16 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 138,
      },
      {
        day: 3,
        said: "My left calf is tight and a bit swollen since last night.",
        symptoms: { painScore: 5, painControlled: true, calfPainOrSwelling: true },
        vitals: { hr: 80, sbp: 124, dbp: 80, tempC: 37.0, spo2: 97, respRate: 16 },
        acknowledgedBy: "M. Adeyemi, NP — Doppler negative, same day",
        callSeconds: 233,
      },
      {
        day: 4,
        said: "The scan was clear. The calf is easier today.",
        symptoms: { painScore: 4, painControlled: true },
        vitals: { hr: 77, sbp: 122, dbp: 78, tempC: 36.9, spo2: 98, respRate: 16 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 161,
      },
      {
        day: 5,
        said: "Down to one stick indoors.",
        symptoms: { painScore: 4, painControlled: true },
        vitals: { hr: 75, sbp: 120, dbp: 76, tempC: 36.8, spo2: 98, respRate: 15 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 127,
      },
      {
        day: 6,
        said: "Nothing to report. I did the abduction exercises twice.",
        symptoms: { painScore: 3, painControlled: true },
        vitals: { hr: 78, sbp: 122, dbp: 78, tempC: 37.0, spo2: 97, respRate: 16 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 116,
      },
      {
        day: 7,
        said: "Good day. I sat in the garden.",
        symptoms: { painScore: 3, painControlled: true },
        vitals: { hr: 76, sbp: 120, dbp: 76, tempC: 36.9, spo2: 98, respRate: 15 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 109,
      },
      {
        day: 8,
        said: "A bit stiff first thing, fine by the afternoon.",
        symptoms: { painScore: 3, painControlled: true },
        vitals: { hr: 79, sbp: 122, dbp: 78, tempC: 37.0, spo2: 97, respRate: 16 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 121,
      },
      {
        day: 9,
        said: "Slept right through for the first time.",
        symptoms: { painScore: 2, painControlled: true },
        vitals: { hr: 74, sbp: 120, dbp: 76, tempC: 36.8, spo2: 98, respRate: 15 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 104,
      },
      {
        day: 10,
        said: "Walked to the post box and back.",
        symptoms: { painScore: 2, painControlled: true },
        vitals: { hr: 77, sbp: 122, dbp: 78, tempC: 36.9, spo2: 97, respRate: 16 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 112,
      },
      {
        day: 11,
        said: "All fine. Same as yesterday.",
        symptoms: { painScore: 2, painControlled: true },
        vitals: { hr: 75, sbp: 120, dbp: 76, tempC: 36.9, spo2: 98, respRate: 15 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 98,
      },
      {
        day: 12,
        said: "Church on Sunday, with the stick.",
        symptoms: { painScore: 2, painControlled: true },
        vitals: { hr: 78, sbp: 122, dbp: 78, tempC: 37.0, spo2: 97, respRate: 16 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 103,
      },
      {
        day: 13,
        said: "Tired after yesterday but no pain to speak of.",
        symptoms: { painScore: 2, painControlled: true },
        vitals: { hr: 76, sbp: 120, dbp: 76, tempC: 36.8, spo2: 98, respRate: 15 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 96,
      },
      // Day 14 moves her into the Progressive mobility phase, where the
      // envelope tightens: hrMax 95, tempCMax 37.5. Her chart shows the band
      // step down under an unchanged patient.
      {
        day: 14,
        said: "The physio says I can start weaning off the stick.",
        symptoms: { painScore: 2, painControlled: true },
        vitals: { hr: 74, sbp: 120, dbp: 76, tempC: 36.9, spo2: 98, respRate: 15 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 118,
      },
      {
        day: 15,
        said: "Side-lying exercises done. Nothing to report.",
        symptoms: { painScore: 1, painControlled: true },
        vitals: { hr: 77, sbp: 122, dbp: 78, tempC: 37.0, spo2: 97, respRate: 16 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 94,
      },
      {
        day: 16,
        said: "Walked to the shop. Took my time.",
        symptoms: { painScore: 1, painControlled: true },
        vitals: { hr: 75, sbp: 120, dbp: 76, tempC: 36.8, spo2: 98, respRate: 15 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 101,
      },
      {
        day: 17,
        said: "Stairs one at a time, both ways.",
        symptoms: { painScore: 1, painControlled: true },
        vitals: { hr: 78, sbp: 122, dbp: 78, tempC: 36.9, spo2: 97, respRate: 16 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 99,
      },
      {
        day: 18,
        said: "Honestly, I keep forgetting I had it done.",
        symptoms: { painScore: 1, painControlled: true },
        vitals: { hr: 76, sbp: 120, dbp: 76, tempC: 36.9, spo2: 98, respRate: 15 },
        ecg: "normal_sinus_rhythm",
        callSeconds: 92,
      },
    ],
  },
  {
    id: "harold-ferreira",
    name: "Harold Ferreira",
    age: 79,
    procedure: "Hip revision arthroplasty",
    caregiver: "Ana Ferreira (daughter)",
    lastCheckinMinutesAgo: 402,
    days: [
      {
        day: 0,
        said: "Second time around. I know the drill.",
        symptoms: { painScore: 6, painControlled: true },
        vitals: { hr: 80, sbp: 130, dbp: 82, tempC: 37.0, spo2: 96, respRate: 16 },
        ecg: "normal_sinus_rhythm",
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 181,
      },
      {
        day: 1,
        said: "Stiffer than last time but the pain is covered.",
        symptoms: { painScore: 5, painControlled: true },
        vitals: { hr: 78, sbp: 128, dbp: 80, tempC: 36.9, spo2: 97, respRate: 16 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 154,
      },
      {
        day: 2,
        said: "Up to the kitchen and back three times.",
        symptoms: { painScore: 5, painControlled: true },
        vitals: { hr: 76, sbp: 126, dbp: 80, tempC: 37.0, spo2: 97, respRate: 15 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 137,
      },
      {
        day: 3,
        said: "Ana is here until Sunday so I'm being looked after.",
        symptoms: { painScore: 4, painControlled: true },
        vitals: { hr: 79, sbp: 126, dbp: 78, tempC: 36.8, spo2: 98, respRate: 16 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 128,
      },
      {
        day: 4,
        said: "No complaints. The swelling is going down.",
        symptoms: { painScore: 4, painControlled: true },
        vitals: { hr: 75, sbp: 124, dbp: 78, tempC: 36.9, spo2: 97, respRate: 15 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 119,
      },
      {
        day: 5,
        said: "Slept better. Pain's a three.",
        symptoms: { painScore: 3, painControlled: true },
        vitals: { hr: 77, sbp: 124, dbp: 78, tempC: 37.0, spo2: 98, respRate: 16 },
        acknowledgedBy: "K. Osei, RN",
        callSeconds: 113,
      },
      {
        day: 6,
        said: "Nothing new. I'm getting bored, which I'm told is a good sign.",
        symptoms: { painScore: 3, painControlled: true },
        vitals: { hr: 74, sbp: 122, dbp: 76, tempC: 36.8, spo2: 98, respRate: 15 },
        ecg: "normal_sinus_rhythm",
        callSeconds: 106,
      },
    ],
  },
];

/**
 * Alan's fourteen days come from the shipped drift fixture rather than being
 * retyped here, so the trend-engine demo, its unit tests and this worklist
 * can never disagree about what his heart rate did.
 */
const DRIFT_SAID = [
  "Home and settled. Sore but nothing surprising.",
  "Slept in the chair. Pain's a five.",
  "Managed the hall twice with the frame.",
  "Same as yesterday. No complaints.",
  "A bit more tired than I expected.",
  "Slower today, but I got round the garden.",
  "Nothing to tell you. Pain's a four.",
  "I needed a sit down after the stairs.",
  "More puffed than last week doing the same walk.",
  "Tired again. I put it down to the weather.",
  "Fine, I think. Dai says I look washed out.",
  "Had to stop halfway up the stairs today.",
  "Same again. Tired, but the hip itself is fine.",
  "No worse than yesterday. I just have no energy.",
];

function driftDays(): DayProfile[] {
  const history = scenarioHistory("drift");

  return history.map((reading, index) => ({
    day: index,
    said: DRIFT_SAID[index] ?? DRIFT_SAID[DRIFT_SAID.length - 1],
    symptoms: { painScore: index < 4 ? 5 : 4, painControlled: true },
    vitals: {
      hr: reading.hr,
      sbp: reading.sbp,
      dbp: reading.dbp,
      tempC: reading.tempC,
      spo2: reading.spo2,
      respRate: reading.respRate,
    },
    ecg: index === history.length - 1 ? "normal_sinus_rhythm" : undefined,
    // Only the latest is still waiting on a clinician.
    acknowledgedBy: index < history.length - 1 ? "K. Osei, RN" : undefined,
    callSeconds: 120 + index * 4,
  }));
}

function buildPatient(profile: PatientProfile, now: number): RosterPatient {
  const days = profile.days.length > 0 ? profile.days : driftDays();
  const dayPostOp = days[days.length - 1].day;
  const lastCheckinAt = now - profile.lastCheckinMinutesAgo * MS_PER_MINUTE;

  const vitalsSeries: VitalsReading[] = [];
  const symptomsSeries: Symptoms[] = [];
  const checkins: CheckinRecord[] = [];

  for (const entry of days) {
    const at = new Date(
      lastCheckinAt - (dayPostOp - entry.day) * MS_PER_DAY,
    ).toISOString();

    const reading = entry.vitals ?? scenarioVitals(entry.scenario ?? "green", new Date(at));
    const vitals: VitalsReading = {
      timestamp: at,
      source: reading.source ?? "simulated",
      quality: reading.quality ?? "ok",
      hr: reading.hr,
      sbp: reading.sbp,
      dbp: reading.dbp,
      tempC: reading.tempC,
      spo2: reading.spo2,
      respRate: reading.respRate,
      deviceLabel: reading.deviceLabel,
    };

    const ecg: EcgReading | undefined = entry.ecg
      ? { recordedAt: at, determination: entry.ecg, bpm: vitals.hr, source: "kardia_6l" }
      : undefined;

    vitalsSeries.push(vitals);
    symptomsSeries.push(entry.symptoms);

    const phase = getPhase(entry.day);
    const baseDecision = evaluate({
      dayPostOp: entry.day,
      symptoms: entry.symptoms,
      vitals,
      ecg,
    });
    const trendFindings = evaluateTrends([...vitalsSeries], [...symptomsSeries], phase);
    const decision = composeDecision(baseDecision, trendFindings);

    checkins.push({
      id: `${profile.id}-day-${entry.day}`,
      dayPostOp: entry.day,
      at,
      said: entry.said,
      symptoms: entry.symptoms,
      vitals,
      ecg,
      baseDecision,
      trendFindings,
      decision,
      sbar: buildFallbackSbar({
        patient: profile.name,
        dayPostOp: entry.day,
        procedure: profile.procedure,
        decision,
        symptoms: entry.symptoms,
        vitals,
        ecg,
        trendFindings,
        client: null,
      }),
      callSeconds: entry.callSeconds,
      managementMinutes: MANAGEMENT_MINUTES[decision.level],
      acknowledgedBy: entry.acknowledgedBy,
    });
  }

  const escalations = checkins.filter((c) => c.decision.level !== "green");
  const surgeryMs = lastCheckinAt - dayPostOp * MS_PER_DAY;

  return {
    id: profile.id,
    name: profile.name,
    age: profile.age,
    procedure: profile.procedure,
    caregiver: profile.caregiver,
    surgeryDate: isoDate(surgeryMs),
    dayPostOp,
    phase: getPhase(dayPostOp),
    checkins,
    latest: checkins[checkins.length - 1],
    openEscalations: escalations.filter((c) => c.acknowledgedBy === undefined).length,
    closedEscalations: escalations.filter((c) => c.acknowledgedBy !== undefined).length,
    billing: {
      periodStart: isoDate(surgeryMs),
      periodEnd: isoDate(surgeryMs + 30 * MS_PER_DAY),
      monitoringDays: checkins.length,
      managementMinutes: checkins.reduce((sum, c) => sum + c.managementMinutes, 0),
      setupComplete: true,
      // Every check-in is a live two-way voice call, which is what the
      // management codes mean by interactive communication.
      interactiveContact: true,
    },
  };
}

const SEVERITY_ORDER: Record<Decision["level"], number> = { red: 0, amber: 1, green: 2 };

/**
 * The worklist order: worst first, then most recently heard from. A nurse
 * working top-down should never have to scroll past a green row to reach a
 * red one, and among equals the freshest information wins.
 */
export function buildRoster(now: Date = new Date()): RosterPatient[] {
  const ms = now.getTime();
  return PROFILES.map((profile) => buildPatient(profile, ms)).sort((a, b) => {
    const bySeverity =
      SEVERITY_ORDER[a.latest.decision.level] - SEVERITY_ORDER[b.latest.decision.level];
    if (bySeverity !== 0) return bySeverity;
    return Date.parse(b.latest.at) - Date.parse(a.latest.at);
  });
}

export function findPatient(id: string, now: Date = new Date()): RosterPatient | undefined {
  return buildRoster(now).find((patient) => patient.id === id);
}

export function rosterIds(): string[] {
  return PROFILES.map((profile) => profile.id);
}
