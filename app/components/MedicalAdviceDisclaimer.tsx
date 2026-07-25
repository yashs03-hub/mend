import { cn } from "@/lib/utils";

/**
 * Binding global constraint: every user-facing surface shows this sentence.
 * Wording matches the operator console so presenters and screens say the same thing.
 */
export const MEDICAL_ADVICE_DISCLAIMER = "Educational prototype — not medical advice";

type DisclaimerTone = "quiet" | "family";

/**
 * Shared "not medical advice" notice. Quiet (meta) for clinical/call chrome;
 * family tone meets the 19px body minimum without competing with the headline.
 */
export function MedicalAdviceDisclaimer({
  tone = "quiet",
  className,
  extra,
}: {
  tone?: DisclaimerTone;
  className?: string;
  /** Optional second sentence (e.g. synthetic-data note). */
  extra?: string;
}) {
  return (
    <p
      data-disclaimer="not-medical-advice"
      className={cn(
        tone === "family" ? "text-lg leading-relaxed text-ink-tertiary" : "text-meta text-ink-tertiary",
        className,
      )}
    >
      {MEDICAL_ADVICE_DISCLAIMER}.
      {extra ? ` ${extra}` : null}
    </p>
  );
}
