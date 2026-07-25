import type {
  Decision,
  Phase,
  Severity,
  VitalsReading,
} from "@/lib/clinical/types";
import { SEVERITY_LEVELS } from "@/lib/ui/severity";

/**
 * Presentation helpers for the live call view.
 *
 * IMPORTANT: nothing here decides an escalation. `evaluate()` owns every
 * verdict; `vitalStatus()` only answers the much smaller question "is this
 * one number inside the phase envelope the engine judges against", so a tile
 * can show its own reading in context. Its chips are deliberately labelled
 * "In range" / "Above range" / "Below range" and never "Urgent" — a single
 * reading is not a triage decision and must not be dressed up as one.
 *
 * The offsets below (+10 bpm, -2%, the absolute 90 floors) are the same
 * numbers red-flag-engine.ts uses, so a tile can never say "in range" about a
 * value that the engine treats as a red flag. They are duplicated rather than
 * imported because the engine's are private to its rule context, and this is
 * a display concern that must not be able to alter the engine.
 */

export interface VitalStatus {
  level: Severity;
  /** Chip text. Always present — severity is never colour alone. */
  label: string;
  /** The bound this reading was compared against, for the meta line. */
  envelope: string;
}

const TACHYCARDIA_OFFSET_BPM = 10;
const PE_SPO2_OFFSET_PCT = 2;
const CRITICAL_SPO2_PCT = 90;
const CRITICAL_SBP_MMHG = 90;

const IN_RANGE = "In range";
const ABOVE_RANGE = "Above range";
const BELOW_RANGE = "Below range";

export function hrStatus(hr: number | undefined, phase: Phase): VitalStatus | undefined {
  if (hr === undefined) return undefined;
  const max = phase.normalEnvelope.hrMax;
  const envelope = `expected ≤ ${max} bpm`;
  if (hr > max + TACHYCARDIA_OFFSET_BPM) {
    return { level: "red", label: ABOVE_RANGE, envelope };
  }
  if (hr > max) {
    return { level: "amber", label: ABOVE_RANGE, envelope };
  }
  return { level: "green", label: IN_RANGE, envelope };
}

export function spo2Status(
  spo2: number | undefined,
  phase: Phase,
): VitalStatus | undefined {
  if (spo2 === undefined) return undefined;
  const min = phase.normalEnvelope.spo2Min;
  const envelope = `expected ≥ ${min}%`;
  if (spo2 < CRITICAL_SPO2_PCT || spo2 < min - PE_SPO2_OFFSET_PCT) {
    return { level: "red", label: BELOW_RANGE, envelope };
  }
  if (spo2 < min) {
    return { level: "amber", label: BELOW_RANGE, envelope };
  }
  return { level: "green", label: IN_RANGE, envelope };
}

/**
 * Temperature alone never reaches red in the engine — the sepsis rule needs a
 * fever AND tachycardia — so this tops out at amber rather than implying a
 * red the engine would not have produced.
 */
export function tempStatus(
  tempC: number | undefined,
  phase: Phase,
): VitalStatus | undefined {
  if (tempC === undefined) return undefined;
  const max = phase.normalEnvelope.tempCMax;
  const envelope = `expected ≤ ${max.toFixed(1)} °C`;
  return tempC > max
    ? { level: "amber", label: ABOVE_RANGE, envelope }
    : { level: "green", label: IN_RANGE, envelope };
}

export function bpStatus(sbp: number | undefined): VitalStatus | undefined {
  if (sbp === undefined) return undefined;
  const envelope = `systolic floor ${CRITICAL_SBP_MMHG} mmHg`;
  return sbp < CRITICAL_SBP_MMHG
    ? { level: "red", label: BELOW_RANGE, envelope }
    : { level: "green", label: IN_RANGE, envelope };
}

export interface CallTarget {
  /** The one thing she must do, in Mend's voice. */
  imperative: string;
  /** Face of the button. */
  buttonLabel: string;
  /** `tel:` href, or undefined when there is no number to dial from here. */
  href: string | undefined;
  /** Who is on the other end. */
  detail: string;
}

/**
 * Turns `Decision.call` into the single action shown on the takeover. Every
 * branch is a rendering of a value the engine produced — this never chooses
 * an escalation target of its own.
 */
export function callTarget(decision: Decision): CallTarget {
  switch (decision.call) {
    case "911":
      return {
        imperative: "Hang up and call 911 now.",
        buttonLabel: "Call 911",
        href: "tel:911",
        detail: "Emergency services",
      };
    case "ER":
      return {
        imperative: "Go to the emergency room now.",
        buttonLabel: "Go to the ER",
        href: undefined,
        detail: "Nearest emergency department",
      };
    case "surgeon_office":
      return {
        imperative: "Call your surgeon's office today.",
        buttonLabel: "Call the surgeon's office",
        href: undefined,
        detail: "Orthopaedic team",
      };
    case "nurse_line":
      return {
        imperative: "Call the nurse line today.",
        buttonLabel: "Call the nurse line",
        href: undefined,
        detail: "Recovery nurse line",
      };
    default:
      return {
        imperative: decision.action,
        buttonLabel: "Contact your care team",
        href: undefined,
        detail: "Care team",
      };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Re-validates a `decision` jsonb payload arriving over Supabase Realtime.
 * A row read off a socket is untrusted `unknown` at the type level, and a
 * malformed one must degrade to "no update" rather than paint an unknown
 * severity onto the stage screen.
 */
export function parseDecision(raw: unknown): Decision | undefined {
  if (!isRecord(raw)) return undefined;

  const level = raw.level;
  if (typeof level !== "string" || !(SEVERITY_LEVELS as readonly string[]).includes(level)) {
    return undefined;
  }
  if (typeof raw.action !== "string" || raw.action.trim().length === 0) {
    return undefined;
  }

  const call = raw.call;
  const validCall =
    call === "911" || call === "ER" || call === "surgeon_office" || call === "nurse_line";

  return {
    level: level as Severity,
    ...(typeof raw.condition === "string" ? { condition: raw.condition } : {}),
    action: raw.action,
    ...(validCall ? { call } : {}),
    rationale: stringArray(raw.rationale),
    firedRules: stringArray(raw.firedRules),
  };
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

const VITALS_SOURCES = ["ble_heart_rate", "manual", "kardia_6l", "simulated"] as const;

/**
 * Re-validates a `vitals` row arriving over Supabase Realtime into the
 * clinical shape. Mirrors lib/db/queries.ts's `rowToVitalsReading`, which is
 * server-only; a bad row yields undefined and the tiles keep their last
 * trustworthy reading.
 */
export function parseVitalsRow(raw: unknown): VitalsReading | undefined {
  if (!isRecord(raw)) return undefined;
  if (typeof raw.recorded_at !== "string") return undefined;

  const source = typeof raw.source === "string" ? raw.source : "";
  const quality = raw.quality;

  const hr = numberOrUndefined(raw.hr);
  const sbp = numberOrUndefined(raw.sbp);
  const dbp = numberOrUndefined(raw.dbp);
  const tempC = numberOrUndefined(raw.temp_c);
  const spo2 = numberOrUndefined(raw.spo2);
  const respRate = numberOrUndefined(raw.resp_rate);

  return {
    timestamp: raw.recorded_at,
    ...(hr !== undefined ? { hr } : {}),
    ...(sbp !== undefined ? { sbp } : {}),
    ...(dbp !== undefined ? { dbp } : {}),
    ...(tempC !== undefined ? { tempC } : {}),
    ...(spo2 !== undefined ? { spo2 } : {}),
    ...(respRate !== undefined ? { respRate } : {}),
    source: (VITALS_SOURCES as readonly string[]).includes(source)
      ? (source as VitalsReading["source"])
      : "manual",
    ...(typeof raw.device_label === "string" ? { deviceLabel: raw.device_label } : {}),
    quality: quality === "ok" || quality === "poor" || quality === "stale" ? quality : "poor",
  };
}

/** How the heart-rate tile describes where its number came from. */
export function sourceLabel(vitals: VitalsReading): string {
  if (vitals.deviceLabel) return vitals.deviceLabel;
  switch (vitals.source) {
    case "ble_heart_rate":
      return "Chest strap";
    case "kardia_6l":
      return "KardiaMobile 6L";
    case "manual":
      return "Entered by hand";
    case "simulated":
      return "Simulated feed";
  }
  // `source` is optional, so the switch cannot be exhaustive. Say the
  // provenance is unknown rather than implying a device we cannot name.
  return "Source unknown";
}
