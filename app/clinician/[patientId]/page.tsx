import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SeverityPanel } from "@/components/ui/severity-chip";
import { DecisionAudit } from "@/app/components/clinician/AuditTrail";
import { BillingPanel } from "@/app/components/clinician/BillingPanel";
import {
  ClinicianShell,
  Panel,
  SectionHeading,
} from "@/app/components/clinician/ClinicianShell";
import { clockTime, fullDate, timeAgo } from "@/app/components/clinician/format";
import { LatestReading } from "@/app/components/clinician/LatestReading";
import { SbarCard } from "@/app/components/clinician/SbarCard";
import { TrendChart } from "@/app/components/clinician/TrendChart";
import {
  TREND_METRICS,
  TREND_WINDOW_DAYS,
  buildTrendSeries,
} from "@/app/components/clinician/trend-series";
import { findPatient, rosterIds } from "@/lib/sim/roster";

/**
 * /clinician/[patientId] — one patient, in full.
 *
 * The order of the page is the order of the questions a nurse actually asks:
 * what is the verdict right now, what would I paste into the note, what is
 * this costing and earning, what has the trajectory been, and then — for the
 * one person in ten who wants it — exactly which rule read exactly which
 * number to arrive at the verdict at the top.
 *
 * Nothing on this page needs credentials. The roster is synthetic and the
 * SBAR is the deterministic fallback that `generateSbar()` produces without
 * an Anthropic key.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ patientId: string }>;
}): Promise<Metadata> {
  const { patientId } = await params;
  const patient = findPatient(patientId);
  if (!patient) return { title: "Patient not found — Mend" };

  return {
    title: `${patient.name} — Mend`,
    description: `Day ${patient.dayPostOp} after ${patient.procedure}: trends against the phase envelope, the SBAR handoff, and the audit trail for every decision.`,
  };
}

export function generateStaticParams() {
  return rosterIds().map((patientId) => ({ patientId }));
}

export default async function PatientPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  const now = new Date();
  const patient = findPatient(patientId, now);
  if (!patient) notFound();

  const latest = patient.latest;
  const envelope = patient.phase.normalEnvelope;
  const history = [...patient.checkins].reverse();
  const trendInputs = patient.checkins.map((checkin) => ({
    dayPostOp: checkin.dayPostOp,
    vitals: checkin.vitals,
    symptoms: checkin.symptoms,
  }));

  return (
    <ClinicianShell active="/clinician" breadcrumb={patient.name}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 pt-8 pb-6">
        <div className="space-y-2">
          <h1 className="font-heading text-heading text-ink">{patient.name}</h1>
          <p className="numeric flex flex-wrap items-baseline gap-x-3 gap-y-1 text-label text-ink-secondary">
            <span>{patient.age}</span>
            <span aria-hidden="true" className="text-ink-tertiary">·</span>
            <span>{patient.procedure}</span>
            <span aria-hidden="true" className="text-ink-tertiary">·</span>
            <span className="font-medium text-ink">Day {patient.dayPostOp}</span>
            <span aria-hidden="true" className="text-ink-tertiary">·</span>
            <span>{patient.phase.name}</span>
            <span aria-hidden="true" className="text-ink-tertiary">·</span>
            <span className="text-ink-tertiary">
              surgery {fullDate(patient.surgeryDate)}
            </span>
          </p>
          <p className="numeric text-meta text-ink-tertiary">
            Caregiver on file: {patient.caregiver} · {patient.openEscalations} open
            escalation{patient.openEscalations === 1 ? "" : "s"} ·{" "}
            {patient.closedEscalations} reviewed
          </p>
        </div>
        <Link
          href="/clinician"
          className="inline-flex min-h-11 items-center rounded-md border border-line px-4 text-label text-ink-secondary hover:bg-wash"
        >
          Back to worklist
        </Link>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <SeverityPanel
            level={latest.decision.level}
            headline={latest.decision.condition ?? undefined}
          >
            <p className="font-serif text-lede leading-snug text-ink-secondary">
              {latest.decision.action}
            </p>
            <p className="numeric pt-2 text-meta">
              Day {latest.dayPostOp} check-in at {clockTime(latest.at)} ·{" "}
              {timeAgo(latest.at, now)} · fired{" "}
              {latest.decision.firedRules.join(", ") || "no rule"}
            </p>
          </SeverityPanel>

          <Panel className="p-5">
            <SectionHeading
              title="SBAR handoff"
              meta={`generated for day ${latest.dayPostOp}`}
            />
            <div className="pt-4">
              <SbarCard sbar={latest.sbar} patientName={patient.name} />
            </div>
          </Panel>
        </div>

        <Panel className="p-5">
          <SectionHeading
            title="Latest reading"
            meta={`day ${latest.dayPostOp} · ${patient.phase.name}`}
          />
          <div className="pt-3">
            <LatestReading
              vitals={latest.vitals}
              ecg={latest.ecg}
              phase={patient.phase}
              painScore={latest.symptoms.painScore}
              callSeconds={latest.callSeconds}
            />
          </div>
        </Panel>
      </div>

      <div className="space-y-4 pt-10">
        <SectionHeading
          title="Trends against the phase envelope"
          meta={`${Math.min(patient.checkins.length, TREND_WINDOW_DAYS)} days · ${patient.phase.name}`}
        />
        <p className="max-w-4xl text-label text-ink-secondary">
          The shaded band is the recovery graph&apos;s envelope for each
          individual day, so a breach is visible rather than asserted — and
          where the phase changes, the band steps with it under an otherwise
          unchanged patient. A chart can also be flagged with no breach at all:
          that is the trend engine, escalating on the slope of a line that never
          leaves the band.
        </p>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {TREND_METRICS.map((metric) => (
            <TrendChart
              key={metric}
              series={buildTrendSeries(trendInputs, metric)}
              trend={latest.trendFindings.find((f) => f.metric === metric)}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4 pt-10">
        <SectionHeading
          title="Billing capture"
          meta={`RPM and RTM · period ${patient.billing.periodStart} to ${patient.billing.periodEnd}`}
        />
        <p className="max-w-4xl text-label text-ink-secondary">
          A daily voice check-in that records a physiologic reading and logs
          review time is already doing the work these codes reimburse. Grayscale
          on purpose: an unmet billing threshold is not a clinical event and must
          not compete with a red row for the same attention.
        </p>
        <Panel className="overflow-hidden">
          <BillingPanel period={patient.billing} />
        </Panel>
      </div>

      <div className="space-y-4 pt-10">
        <SectionHeading
          title="Check-in history and audit trail"
          meta={`${patient.checkins.length} check-ins · newest first`}
        />
        <p className="max-w-4xl text-label text-ink-secondary">
          Every decision expands to the rule that produced it, the exact input
          values that rule read, and the provenance of every threshold it
          compared them against.
        </p>
        <Panel className="overflow-hidden">
          {history.map((checkin, index) => (
            <DecisionAudit
              key={checkin.id}
              checkin={checkin}
              patientId={patient.id}
              now={now}
              defaultOpen={index === 0}
            />
          ))}
        </Panel>
      </div>

      <div className="grid gap-5 pt-10 lg:grid-cols-3">
        <Panel className="space-y-3 p-5">
          <SectionHeading title="Envelope in force" meta={patient.phase.name} />
          <dl className="space-y-1.5">
            {[
              ["Heart rate", `≤ ${envelope.hrMax} bpm`],
              ["Oxygen saturation", `≥ ${envelope.spo2Min}%`],
              ["Temperature", `≤ ${envelope.tempCMax.toFixed(1)} °C`],
              [
                "Tachycardia threshold",
                `> ${envelope.hrMax + 10} bpm (hrMax + 10)`,
              ],
              [
                "PE oxygen floor",
                `< ${envelope.spo2Min - 2}% (spo2Min − 2)`,
              ],
              ["Phase days", `${patient.phase.dayStart}–${patient.phase.dayEnd}`],
            ].map(([term, value]) => (
              <div
                key={term}
                className="flex items-baseline justify-between gap-3 border-b border-line py-1 last:border-b-0"
              >
                <dt className="text-meta text-ink-secondary">{term}</dt>
                <dd className="numeric text-meta font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-meta text-ink-tertiary">
            <span className="uppercase tracking-[0.14em]">Source</span>{" "}
            <span className="italic">{envelope.source}</span>
          </p>
        </Panel>

        <Panel className="space-y-3 p-5">
          <SectionHeading title="Rehab this phase" meta={patient.phase.weightBearing} />
          <ul className="space-y-1.5">
            {patient.phase.rehab.map((item) => (
              <li key={item} className="border-b border-line py-1 text-label text-ink-secondary last:border-b-0">
                {item}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="space-y-3 p-5">
          <SectionHeading title="Precautions" meta="reinforced on every call" />
          <ul className="space-y-1.5">
            {patient.phase.precautions.map((item) => (
              <li key={item} className="border-b border-line py-1 text-label text-ink-secondary last:border-b-0">
                {item}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </ClinicianShell>
  );
}
