import { Decision, Symptoms, VitalsReading, EcgReading } from "./types";
import { getPhase } from "./recovery-graph";
import { usableVitals } from "./vitals";

/**
 * The deterministic clinical core.
 *
 * This function — and only this function — decides green/amber/red. The language
 * model extracts symptoms upstream and writes prose downstream; neither is
 * permitted to influence the verdict. Same inputs always produce the same
 * output, every branch is unit-tested, and every verdict carries the list of
 * rules that fired so a clinician can audit it.
 *
 * Ordering is significant: red rules are evaluated before amber, and the first
 * matching rule wins, so a life-threatening pattern is never masked by a
 * lower-acuity one that happens to appear earlier in the symptom set.
 */
export function evaluate(input: {
  dayPostOp: number;
  symptoms: Symptoms;
  vitals: VitalsReading;
  procedure?: "hip" | "latarjet";
  history?: { tempC?: number; dayPostOp: number }[];
  ecg?: EcgReading;
  symptomsUnusable?: boolean;
}): Decision {
  const { dayPostOp, symptoms: s, procedure = "hip" } = input;
  const v = usableVitals(input.vitals);
  const phase = getPhase(dayPostOp, procedure);

  const hr = v.hr;
  const tach =
    (hr !== undefined && hr > 110) ||
    (v.ecgFlags?.includes("sinus_tachycardia") ?? false) ||
    (input.ecg?.determination === "tachycardia");

  // "Usable" means we actually have a physiologic number to reason about.
  // ECG flags alone do not count: they can corroborate a symptom but cannot
  // stand in for the absence of one.
  const vitalsUsable =
    v.quality === "ok" &&
    (hr !== undefined || v.sbp !== undefined || v.tempC !== undefined);

  // ---------------- RED — life-threatening, same-hour ------------  if (s.breathless || s.chestPain) {
    const reasons: string[] = [];
    if (tach) {
      reasons.push(
        `Breathlessness/chest pain with tachycardia (HR ${hr ?? "n/a"}, ECG ${
          v.ecgFlags?.join("/") ?? "n/a"
        })`,
      );
    }
    if (tach || !vitalsUsable) {
      return red(
        "Suspected pulmonary embolism",
        "Call 911 now. This could be a clot on the lung.",
        "911",
        reasons.length
          ? reasons
          : [
              "Breathlessness or chest pain reported; no usable vitals to reassure against — escalating on the safe side",
            ],
        tach ? ["pe.breathless_with_tachycardia"] : ["pe.unusable_vitals_failsafe"],
      );
    }
  }

  if (v.sbp !== undefined && v.sbp < 90 && hr !== undefined && hr > 110) {
    return red(
      "Suspected shock / bleeding",
      "Call 911 now.",
      "911",
      [`Hypotension SBP ${v.sbp} with tachycardia HR ${hr}`],
      ["shock.hypotension"],
    );
  }

  if (procedure === "hip" && s.suddenSevereHipPain && (s.legShortenedOrRotated || s.unableToWeightBear)) {
    return red(
      "Suspected hip dislocation",
      "Call 911 now. Go to the emergency room now — do not put weight on that leg.",
      "911",
      [
        "Sudden severe hip pain with a shortened/rotated leg or inability to weight-bear",
      ],
      ["dislocation.classic_triad"],
    );
  }

  if (v.tempC !== undefined && v.tempC >= 38.5 && hr !== undefined && hr > 120) {
    return red("Possible sepsis", "Go to the emergency room now.", "ER", [
      `Fever ${v.tempC} C with tachycardia HR ${hr}`,
    ], ["sepsis.fever_with_tachycardia"]);
  }

  if (v.spo2 !== undefined && v.spo2 < 90) {
    return red(
      "Hypoxia",
      "Call 911 now. This oxygen level requires immediate assessment.",
      "911",
      [`SpO2 ${v.spo2}% is below 90%`],
      ["hypoxia.spo2_critical"],
    );
  }

  if (v.tempC !== undefined && v.tempC >= 39.0) {
    return red(
      "Severe fever",
      "Go to the emergency room now.",
      "ER",
      [`Severe fever ${v.tempC} C is at or above 39.0 C`],
      ["fever.severe"],
    );
  }

  if (hasPersistentFever(dayPostOp, v.tempC, procedure, input.history)) {
    return red(
      "Persistent fever",
      "Go to the emergency room now.",
      "ER",
      [`Fever has been above the envelope for 3 consecutive days (current temp: ${v.tempC} C)`],
      ["fever.persistent"],
    );
  }

  // ---------------- AMBER — urgent, same-day ----------------

  if (procedure === "latarjet" && (s.deltoidSensationLoss || s.unableToElevateArm)) {
    const reasons: string[] = [];
    if (s.deltoidSensationLoss) reasons.push("Deltoid sensation loss reported");
    if (s.unableToElevateArm) reasons.push("Inability to elevate arm reported");
    return amber(
      "Suspected axillary nerve palsy",
      "Call your surgeon's office today to review your arm function and sensation.",
      "surgeon_office",
      reasons.map((r) => `${r} (suspected axillary nerve palsy)`),
      ["axillary_nerve_palsy"],
    );
  }

  // Breathlessness or chest pain that reached here was not corroborated by
  // tachycardia — but a normal heart rate does not exclude a pulmonary
  // embolism, so this can never fall through to green. We downgrade the
  // urgency, not the concern, and we deliberately avoid naming it a suspected
  // PE without corroboration.
  if (s.breathless || s.chestPain) {
    return amber(
      "New breathlessness or chest pain",
      "Call your surgeon's office today — this needs to be assessed even though your other readings look normal.",
      "surgeon_office",
      [
        `${s.breathless ? "Breathlessness" : "Chest pain"} reported without tachycardia (HR ${hr ?? "n/a"}) — a normal heart rate does not exclude a clot`,
      ],
      ["pe.breathless_no_tachycardia"],
    );
  }

  if (s.calfPainOrSwelling) {
    return amber(
      "Possible DVT",
      "Call your surgeon's office today — you may need a scan of your leg.",
      "surgeon_office",
      ["Calf pain or swelling reported, without chest symptoms"],
      ["dvt.calf_pain_or_swelling"],
    );
  }

  if (
    s.woundDischarge ||
    (v.tempC !== undefined && v.tempC > phase.normalEnvelope.tempCMax)
  ) {
    return amber(
      "Possible wound infection",
      "Call your surgeon's office today.",
      "surgeon_office",
      [
        s.woundDischarge
          ? "Wound discharge reported"
          : `Temp ${v.tempC} C is above the ${phase.name} envelope of ${phase.normalEnvelope.tempCMax} C`,
      ],
      s.woundDischarge ? ["wound_infection.discharge"] : ["wound_infection.fever"],
    );
  }

  if (v.ecgFlags?.includes("new_af") || input.ecg?.determination === "atrial_fibrillation") {
    return amber(
      "New atrial fibrillation",
      "Call the nurse line today.",
      "nurse_line",
      ["New atrial fibrillation on ECG, haemodynamically stable"],
      ["afib.new_atrial_fibrillation"],
    );
  }

  if (s.painControlled === false) {
    return amber(
      "Uncontrolled pain",
      "Call the nurse line today so we can review your pain relief.",
      "nurse_line",
      ["Pain not controlled on current analgesia"],
      ["pain.uncontrolled"],
    );
  }

  if (s.newConfusion) {
    return amber(
      "New confusion",
      "Call your surgeon's office today.",
      "surgeon_office",
      ["New confusion reported"],
      ["confusion.new_onset"],
    );
  }

  if (input.symptomsUnusable) {
    return amber(
      "Symptom extraction unavailable",
      "Contact the nurse line — spoken symptoms could not be read from this check-in, so Mend cannot confirm the patient is well.",
      "nurse_line",
      ["Symptom extraction did not run or failed"],
      ["symptoms.extraction_failed"],
    );
  }

  // ---------------- Absence of data is not evidence of wellbeing ----------------
  //
  // Reaching here means nothing was reported and nothing tripped a rule. That is
  // only reassuring if we actually measured something. With no usable reading we
  // have silence, not a normal result, so we ask rather than reassure.
  if (!vitalsUsable) {
    return amber(
      "No usable readings",
      "Call the nurse line today — we could not get a reliable reading from your monitor.",
      "nurse_line",
      [
        `No usable vitals this check-in (quality: ${input.vitals.quality}) and no symptoms reported — cannot confirm you are well`,
      ],
      ["vitals.unusable_no_data"],
    );
  }well`,
      ],
    );
  }

  // ---------------- GREEN ----------------

  return {
    level: "green",
    action: "You're on track. Here's today's rehab.",
    rationale: [
      `No red or amber criteria met; Day ${dayPostOp} vitals within the ${phase.name} envelope`,
    ],
    firedRules: [],
  };
}

function red(
  condition: string,
  action: string,
  call: "911" | "ER",
  rationale: string[],
  firedRules: string[] = [],
): Decision {
  return { level: "red", condition, action, call, rationale, firedRules };
}

function amber(
  condition: string,
  action: string,
  call: "surgeon_office" | "nurse_line",
  rationale: string[],
  firedRules: string[] = [],
): Decision {
  return { level: "amber", condition, action, call, rationale, firedRules };
}

function hasPersistentFever(
  currentDay: number,
  currentTemp: number | undefined,
  procedure: "hip" | "latarjet",
  history?: { tempC?: number; dayPostOp: number }[]
): boolean {
  if (currentTemp === undefined) return false;
  const currentEnvelope = getPhase(currentDay, procedure).normalEnvelope.tempCMax;
  if (currentTemp <= currentEnvelope) return false;

  if (!history) return false;

  const prev1 = history.find(h => h.dayPostOp === currentDay - 1);
  const prev2 = history.find(h => h.dayPostOp === currentDay - 2);

  if (prev1 && prev2 && prev1.tempC !== undefined && prev2.tempC !== undefined) {
    const env1 = getPhase(currentDay - 1, procedure).normalEnvelope.tempCMax;
    const env2 = getPhase(currentDay - 2, procedure).normalEnvelope.tempCMax;
    if (prev1.tempC > env1 && prev2.tempC > env2) {
      return true;
    }
  }
  return false;
}
