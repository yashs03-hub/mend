import { Decision, Symptoms, VitalsReading } from "./types";
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
}): Decision {
  const { dayPostOp, symptoms: s, procedure = "hip" } = input;
  const v = usableVitals(input.vitals);
  const phase = getPhase(dayPostOp, procedure);

  const hr = v.hr;
  const tach =
    (hr !== undefined && hr > 110) ||
    (v.ecgFlags?.includes("sinus_tachycardia") ?? false);

  // "Usable" means we actually have a physiologic number to reason about.
  // ECG flags alone do not count: they can corroborate a symptom but cannot
  // stand in for the absence of one.
  const vitalsUsable =
    v.quality === "ok" &&
    (hr !== undefined || v.sbp !== undefined || v.tempC !== undefined);

  // ---------------- RED — life-threatening, same-hour ----------------

  if (s.breathless || s.chestPain) {
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
      );
    }
  }

  if (v.sbp !== undefined && v.sbp < 90 && hr !== undefined && hr > 110) {
    return red(
      "Suspected shock / bleeding",
      "Call 911 now.",
      "911",
      [`Hypotension SBP ${v.sbp} with tachycardia HR ${hr}`],
    );
  }

  if (procedure === "hip" && s.suddenSevereHipPain && (s.legShortenedOrRotated || s.unableToWeightBear)) {
    return red(
      "Suspected hip dislocation",
      "Go to the emergency room now — do not put weight on that leg.",
      "ER",
      [
        "Sudden severe hip pain with a shortened/rotated leg or inability to weight-bear",
      ],
    );
  }

  if (v.tempC !== undefined && v.tempC >= 38.5 && hr !== undefined && hr > 120) {
    return red("Possible sepsis", "Go to the emergency room now.", "ER", [
      `Fever ${v.tempC} C with tachycardia HR ${hr}`,
    ]);
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
    );
  }

  if (s.calfPainOrSwelling) {
    return amber(
      "Possible DVT",
      "Call your surgeon's office today — you may need a scan of your leg.",
      "surgeon_office",
      ["Calf pain or swelling reported, without chest symptoms"],
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
    );
  }

  if (v.ecgFlags?.includes("new_af")) {
    return amber(
      "New atrial fibrillation",
      "Call the nurse line today.",
      "nurse_line",
      ["New atrial fibrillation on ECG, haemodynamically stable"],
    );
  }

  if (s.painControlled === false) {
    return amber(
      "Uncontrolled pain",
      "Call the nurse line today so we can review your pain relief.",
      "nurse_line",
      ["Pain not controlled on current analgesia"],
    );
  }

  if (s.newConfusion) {
    return amber(
      "New confusion",
      "Call your surgeon's office today.",
      "surgeon_office",
      ["New confusion reported"],
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
    );
  }

  // ---------------- GREEN ----------------

  return {
    level: "green",
    action: "You're on track. Here's today's rehab.",
    rationale: [
      `No red or amber criteria met; vitals within the ${phase.name} envelope`,
    ],
  };
}

function red(
  condition: string,
  action: string,
  call: "911" | "ER",
  rationale: string[],
): Decision {
  return { level: "red", condition, action, call, rationale };
}

function amber(
  condition: string,
  action: string,
  call: "surgeon_office" | "nurse_line",
  rationale: string[],
): Decision {
  return { level: "amber", condition, action, call, rationale };
}
