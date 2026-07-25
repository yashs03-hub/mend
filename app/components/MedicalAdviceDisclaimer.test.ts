import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MEDICAL_ADVICE_DISCLAIMER } from "./MedicalAdviceDisclaimer";

/**
 * Surfaces judges open during the demo (and `/`, which they may mistype into).
 * ClinicianShell covers both `/clinician` and `/clinician/engine`.
 */
const PRODUCT_SURFACES = [
  "app/components/landing/Close.tsx",
  "app/components/call/CallStage.tsx",
  "app/family/page.tsx",
  "app/components/patient/PatientPortal.tsx",
  "app/components/clinician/ClinicianShell.tsx",
  "app/console/DemoConsole.tsx",
] as const;

describe("MedicalAdviceDisclaimer", () => {
  it("uses the console wording the presenters already say out loud", () => {
    expect(MEDICAL_ADVICE_DISCLAIMER).toBe("Educational prototype — not medical advice");
  });

  it("is mounted on every judge-facing product surface", () => {
    for (const relative of PRODUCT_SURFACES) {
      const source = readFileSync(path.join(process.cwd(), relative), "utf8");
      expect(source, `${relative} must import the shared disclaimer`).toMatch(
        /MedicalAdviceDisclaimer/,
      );
    }
  });
});
