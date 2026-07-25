import { ChevronRight } from "lucide-react";
import { SeverityChip } from "@/components/ui/severity-chip";
import { TREND_ESCALATION_RULE_ID } from "@/lib/clinical/compose";
import { auditRule, ruleEntry, type RuleAudit } from "@/lib/clinical/rule-catalog";
import type { Symptoms, VitalsReading } from "@/lib/clinical/types";
import type { CheckinRecord } from "@/lib/sim/roster";
import { cn } from "@/lib/utils";
import { callLength, clockTime, timeAgo } from "./format";

/**
 * The audit trail: every decision expandable down to the rule that made it.
 *
 * This is the feature that separates Mend from a chatbot, so it is designed
 * rather than dumped. A clinician asking "why did it say that?" gets four
 * things, in this order, without leaving the page:
 *
 *   1. the rule id that fired, named, not a hash;
 *   2. the exact input values that rule read — and, just as importantly, the
 *      fields it read and found absent, since "not reported" is why a lot of
 *      rules don't fire;
 *   3. every threshold it compared them against, with the arithmetic that
 *      produced the number (hrMax + 10, spo2Min − 2) rather than the number
 *      alone;
 *   4. each threshold's `source` string, verbatim. Ours currently says
 *      "plausible-but-uncited... needs NEWS2/AAOS citation before clinical
 *      use", and it is printed exactly like that. An audit trail that hides
 *      the weakness of its own evidence is decoration.
 *
 * A green check-in expands too, and says plainly that no rule fired. Green is
 * the absence of a fired rule, never a rule firing favourably, and the trail
 * has to show the difference.
 */

const SYMPTOM_LABELS: Record<string, string> = {
  breathless: "breathless",
  chestPain: "chest pain",
  calfPainOrSwelling: "calf pain or swelling",
  woundDischarge: "wound discharge",
  feverSubjective: "feels feverish",
  suddenSevereHipPain: "sudden severe hip pain",
  legShortenedOrRotated: "leg shortened or rotated",
  unableToWeightBear: "unable to weight-bear",
  painControlled: "pain controlled",
  newConfusion: "new confusion",
  painScore: "pain score",
};

function symptomSummary(symptoms: Symptoms): string {
  const parts = Object.entries(symptoms).map(([key, value]) => {
    const label = SYMPTOM_LABELS[key] ?? key;
    if (typeof value === "number") return `${label} ${value}/10`;
    return value ? label : `no ${label}`;
  });
  return parts.length > 0 ? parts.join(" · ") : "none reported";
}

function vitalsSummary(vitals: VitalsReading): string {
  const parts: string[] = [];
  if (vitals.hr !== undefined) parts.push(`HR ${vitals.hr}`);
  if (vitals.sbp !== undefined && vitals.dbp !== undefined) {
    parts.push(`BP ${vitals.sbp}/${vitals.dbp}`);
  }
  if (vitals.tempC !== undefined) parts.push(`Temp ${vitals.tempC.toFixed(1)}`);
  if (vitals.spo2 !== undefined) parts.push(`SpO₂ ${vitals.spo2}%`);
  if (vitals.respRate !== undefined) parts.push(`RR ${vitals.respRate}`);
  parts.push(`quality ${vitals.quality}`);
  return parts.join(" · ");
}

function Subhead({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

function RuleCard({ audit, rationale }: { audit: RuleAudit; rationale?: string }) {
  const { entry } = audit;

  return (
    <div className="space-y-4 rounded-lg border border-line bg-paper p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="numeric text-label font-medium text-ink">{audit.id}</p>
        <p className="text-meta text-ink-tertiary">
          {entry ? entry.condition : "no provenance recorded for this rule id"}
        </p>
      </div>

      {entry ? (
        <p className="text-label text-ink-secondary">{entry.test}</p>
      ) : null}

      {rationale ? (
        <p className="border-l-2 border-line-strong pl-3 font-serif text-lede leading-snug text-ink">
          {rationale}
        </p>
      ) : null}

      {audit.inputs.length > 0 ? (
        <div className="space-y-2">
          <Subhead>Inputs it read</Subhead>
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {audit.inputs.map((input) => (
              <div
                key={input.path}
                className="flex items-baseline justify-between gap-3 border-b border-line py-1 last:border-b-0"
              >
                <dt className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate text-meta text-ink-secondary">
                    {input.label}
                  </span>
                  <span className="numeric truncate text-meta text-ink-tertiary">
                    {input.path}
                  </span>
                </dt>
                <dd
                  className={cn(
                    "numeric shrink-0 text-meta",
                    input.present ? "font-medium text-ink" : "text-ink-tertiary italic",
                  )}
                >
                  {input.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {audit.thresholds.length > 0 ? (
        <div className="space-y-2">
          <Subhead>Thresholds it compared them against</Subhead>
          <ul className="space-y-2.5">
            {audit.thresholds.map((threshold) => (
              <li
                key={threshold.label}
                className="space-y-1 border-l-2 border-line-strong pl-3"
              >
                <p className="flex flex-wrap items-baseline gap-x-3">
                  <span className="text-meta text-ink-secondary">
                    {threshold.label}
                  </span>
                  <span className="numeric text-label font-medium text-ink">
                    {threshold.value}
                  </span>
                </p>
                <p className="numeric text-meta text-ink-tertiary">
                  {threshold.derivation}
                </p>
                <p className="text-meta text-ink-tertiary">
                  <span className="uppercase tracking-[0.14em]">Source</span>{" "}
                  <span className="italic">{threshold.source}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function DecisionAudit({
  checkin,
  patientId,
  now,
  defaultOpen = false,
}: {
  checkin: CheckinRecord;
  patientId: string;
  now: Date;
  defaultOpen?: boolean;
}) {
  const { decision, baseDecision, trendFindings } = checkin;
  const ctx = {
    dayPostOp: checkin.dayPostOp,
    symptoms: checkin.symptoms,
    vitals: checkin.vitals,
    ecg: checkin.ecg,
  };

  const engineRules = baseDecision.firedRules.map((id) => auditRule(id, ctx));
  const raisedByTrend = decision.firedRules.includes(TREND_ESCALATION_RULE_ID);

  return (
    <details
      open={defaultOpen}
      id={`checkin-${checkin.id}`}
      className="group border-b border-line last:border-b-0"
    >
      <summary
        className={cn(
          "flex min-h-14 cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3",
          "hover:bg-wash focus-visible:bg-wash",
        )}
      >
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-ink-tertiary transition-transform group-open:rotate-90"
        />
        <span className="numeric w-14 shrink-0 text-label font-medium text-ink">
          Day {checkin.dayPostOp}
        </span>
        <SeverityChip level={decision.level} size="sm" />
        <span className="min-w-0 flex-1 truncate text-label text-ink-secondary">
          {decision.condition ?? "No finding — every reading inside the envelope"}
        </span>
        <span className="numeric shrink-0 text-meta text-ink-tertiary">
          {clockTime(checkin.at)} · {timeAgo(checkin.at, now)} · {callLength(checkin.callSeconds)}
        </span>
        <span className="numeric shrink-0 text-meta text-ink-tertiary">
          {checkin.acknowledgedBy ? `reviewed by ${checkin.acknowledgedBy}` : "awaiting review"}
        </span>
      </summary>

      <div className="space-y-5 bg-wash/60 px-4 py-5 sm:px-6">
        <div className="space-y-2">
          <Subhead>What she said</Subhead>
          <blockquote className="border-l-2 border-line-strong pl-3 font-serif text-lede leading-snug text-ink">
            “{checkin.said}”
          </blockquote>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Subhead>Reading</Subhead>
            <p className="numeric text-label text-ink-secondary">
              {vitalsSummary(checkin.vitals)}
            </p>
            <p className="numeric text-meta text-ink-tertiary">
              source {checkin.vitals.source}
              {checkin.ecg ? ` · ECG ${checkin.ecg.determination} (KardiaMobile 6L)` : ""}
            </p>
          </div>
          <div className="space-y-2">
            <Subhead>Reported</Subhead>
            <p className="text-label text-ink-secondary">
              {symptomSummary(checkin.symptoms)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Subhead>
            {engineRules.length > 0
              ? `Rules fired — ${engineRules.length}`
              : "Rules fired — none"}
          </Subhead>

          {engineRules.length > 0 ? (
            engineRules.map((audit, index) => (
              <RuleCard
                key={audit.id}
                audit={audit}
                rationale={baseDecision.rationale[index]}
              />
            ))
          ) : (
            <div className="space-y-2 rounded-lg border border-line bg-paper p-4">
              <p className="text-label text-ink-secondary">
                No rule fired. In this engine green is the absence of a fired
                rule, never a rule firing favourably — every red and amber rule
                was evaluated against this reading and none of them matched.
              </p>
              <p className="font-serif text-lede leading-snug text-ink">
                {baseDecision.rationale[0]}
              </p>
            </div>
          )}
        </div>

        {trendFindings.length > 0 ? (
          <div className="space-y-3">
            <Subhead>Trend findings — {trendFindings.length}</Subhead>
            {trendFindings.map((finding) => {
              const entry = ruleEntry(finding.id);
              const audit = auditRule(finding.id, ctx);
              return (
                <div
                  key={finding.id}
                  className="space-y-3 rounded-lg border border-line bg-paper p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="numeric text-label font-medium text-ink">
                      {finding.id}
                    </p>
                    <SeverityChip level={finding.severity} size="sm" />
                  </div>
                  {entry ? (
                    <p className="text-label text-ink-secondary">{entry.test}</p>
                  ) : null}
                  <p className="border-l-2 border-line-strong pl-3 font-serif text-lede leading-snug text-ink">
                    {finding.description}
                  </p>
                  {audit.thresholds.map((threshold) => (
                    <p key={threshold.label} className="text-meta text-ink-tertiary">
                      <span className="numeric font-medium text-ink-secondary">
                        {threshold.value}
                      </span>{" "}
                      · {threshold.derivation} ·{" "}
                      <span className="italic">{threshold.source}</span>
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
        ) : null}

        {raisedByTrend ? (
          <div className="space-y-2 rounded-lg border border-line bg-paper p-4">
            <Subhead>Composition — {TREND_ESCALATION_RULE_ID}</Subhead>
            <p className="text-label text-ink-secondary">
              The red-flag engine returned{" "}
              <span className="font-medium text-ink">{baseDecision.level}</span> on
              this reading. The trend findings above raised it to{" "}
              <span className="font-medium text-ink">{decision.level}</span>. This
              edge only ever runs green to amber: a trend finding can never lower a
              level and can never reach red.
            </p>
          </div>
        ) : null}

        <div className="space-y-2 border-t border-line pt-4">
          <Subhead>Verdict handed to the patient</Subhead>
          <p className="font-serif text-lede leading-snug text-ink">
            {decision.action}
          </p>
          <p className="numeric text-meta text-ink-tertiary">
            level {decision.level}
            {decision.call ? ` · contact ${decision.call}` : ""} · fired{" "}
            {decision.firedRules.length > 0 ? decision.firedRules.join(", ") : "none"}{" "}
            · check-in {checkin.id} · patient {patientId}
          </p>
        </div>
      </div>
    </details>
  );
}
