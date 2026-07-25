"use client";

import {
  AlertTriangle,
  ExternalLink,
  FileUp,
  Loader2,
  Phone,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { BleHeartRate } from "@/app/components/BleHeartRate";
import { MedicalAdviceDisclaimer } from "@/app/components/MedicalAdviceDisclaimer";
import { Button } from "@/components/ui/button";
import { SeverityChip } from "@/components/ui/severity-chip";
import type { Decision, EcgDetermination, EcgReading, TrendFinding } from "@/lib/clinical/types";
import { PLAUSIBLE_RANGES, validateManualVitals } from "@/lib/clinical/vitals";
import { SCENARIO_META, SCENARIOS } from "@/lib/sim/active-scenario";
import type { Scenario } from "@/lib/sim/fixtures";
import { CONSOLE_SHORTCUT_LABEL } from "@/lib/ui/console-shortcut";
import { cn } from "@/lib/utils";

const STAGE_SURFACES = [
  {
    href: "/call",
    label: "Live call",
    note: "Stage peak — open while the phone is ringing",
  },
  {
    href: "/family",
    label: "Family",
    note: "After PE on console, open with no query string",
  },
  {
    href: "/family?state=urgent",
    label: "Family (PE deep link)",
    note: "Urgent only — never use ?state=attention for PE",
  },
  {
    href: "/clinician",
    label: "Clinician",
    note: "Worklist + SBAR + audit trail",
  },
  {
    href: "/clinician/engine",
    label: "Rule engine",
    note: "Vignette suite — model never decides",
  },
] as const;

interface DemoStatus {
  anthropic: boolean;
  supabase: boolean;
  elevenlabs: boolean;
  twilio: boolean;
  demoPatientPhone: boolean;
  missing: string[];
}

interface CheckinResult {
  decision: Decision;
  trendFindings: TrendFinding[];
  sbar: string | null;
  symptoms: Record<string, unknown>;
  warnings?: string[];
  scenario?: Scenario;
}

type ActionState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

const ECG_LABELS: Record<EcgDetermination, string> = {
  normal_sinus_rhythm: "Normal sinus rhythm",
  atrial_fibrillation: "Atrial fibrillation",
  tachycardia: "Tachycardia",
  bradycardia: "Bradycardia",
  unclassified: "Unclassified",
};

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "space-y-4 rounded-xl border border-line bg-raised p-5 shadow-card",
        className,
      )}
    >
      <h2 className="eyebrow">{title}</h2>
      {children}
    </section>
  );
}

function StatusLine({ state }: { state: ActionState }) {
  if (state.kind === "idle") return null;
  if (state.kind === "pending") {
    return (
      <p className="flex items-center gap-2 text-label text-ink-secondary">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        Working…
      </p>
    );
  }
  const tone =
    state.kind === "error"
      ? "border-severity-red-border bg-severity-red-bg text-severity-red-fg"
      : "border-line bg-wash text-ink-secondary";
  return (
    <p
      role={state.kind === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-label",
        tone,
      )}
    >
      {state.kind === "error" ? (
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      ) : null}
      <span>{state.message}</span>
    </p>
  );
}

function parseNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : Number.NaN;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const json: unknown = await res.json();
    if (
      typeof json === "object" &&
      json !== null &&
      "error" in json &&
      typeof (json as { error: unknown }).error === "string"
    ) {
      return (json as { error: string }).error;
    }
    if (
      typeof json === "object" &&
      json !== null &&
      "reason" in json &&
      typeof (json as { reason: unknown }).reason === "string"
    ) {
      return (json as { reason: string }).reason;
    }
  } catch {
    // fall through
  }
  return `Request failed (${res.status}).`;
}

export function DemoConsole() {
  const formId = useId();
  const [scenario, setScenario] = useState<Scenario>("green");
  const [scenarioState, setScenarioState] = useState<ActionState>({ kind: "idle" });
  const [status, setStatus] = useState<DemoStatus | null>(null);

  const [spo2, setSpo2] = useState("");
  const [sbp, setSbp] = useState("");
  const [dbp, setDbp] = useState("");
  const [tempC, setTempC] = useState("");
  const [vitalsState, setVitalsState] = useState<ActionState>({ kind: "idle" });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"spo2" | "sbp" | "dbp" | "tempC", string>>
  >({});

  const [ecgState, setEcgState] = useState<ActionState>({ kind: "idle" });
  const [ecgReading, setEcgReading] = useState<EcgReading | null>(null);

  const [transcript, setTranscript] = useState(
    "I'm a bit short of breath today, and my calf feels sore. Pain is about a four.",
  );
  const [checkinState, setCheckinState] = useState<ActionState>({ kind: "idle" });
  const [checkinResult, setCheckinResult] = useState<CheckinResult | null>(null);

  const [callState, setCallState] = useState<ActionState>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [scenarioRes, statusRes] = await Promise.all([
          fetch("/api/scenario"),
          fetch("/api/demo-status"),
        ]);
        if (cancelled) return;
        if (scenarioRes.ok) {
          const json = (await scenarioRes.json()) as { scenario: Scenario };
          setScenario(json.scenario);
        }
        if (statusRes.ok) {
          setStatus((await statusRes.json()) as DemoStatus);
        }
      } catch {
        if (!cancelled) {
          setStatus({
            anthropic: false,
            supabase: false,
            elevenlabs: false,
            twilio: false,
            demoPatientPhone: false,
            missing: ["Unable to reach /api/demo-status"],
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectScenario = useCallback(async (next: Scenario) => {
    setScenarioState({ kind: "pending" });
    try {
      const res = await fetch("/api/scenario", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario: next }),
      });
      if (!res.ok) {
        setScenarioState({ kind: "error", message: await readErrorMessage(res) });
        return;
      }
      setScenario(next);
      setScenarioState({
        kind: "ok",
        message: `Active scenario is now ${SCENARIO_META[next].label}. Check-in and triage will use these fixture vitals when Supabase has no rows.`,
      });
    } catch {
      setScenarioState({
        kind: "error",
        message: "Could not reach /api/scenario. Is the dev server running?",
      });
    }
  }, []);

  const submitVitals = useCallback(async () => {
    const parsed = {
      spo2: parseNumber(spo2),
      sbp: parseNumber(sbp),
      dbp: parseNumber(dbp),
      tempC: parseNumber(tempC),
    };

    for (const [field, value] of Object.entries(parsed) as Array<
      [keyof typeof parsed, number | undefined]
    >) {
      if (value !== undefined && Number.isNaN(value)) {
        setFieldErrors({ [field]: "Enter a number." });
        setVitalsState({ kind: "error", message: "Fix the highlighted fields before saving." });
        return;
      }
    }

    const validation = validateManualVitals(parsed);
    setFieldErrors(validation.errors);
    if (!validation.ok) {
      setVitalsState({
        kind: "error",
        message: "Fix the highlighted fields before saving.",
      });
      return;
    }

    if (
      parsed.spo2 === undefined &&
      parsed.sbp === undefined &&
      parsed.dbp === undefined &&
      parsed.tempC === undefined
    ) {
      setVitalsState({
        kind: "error",
        message: "Enter at least one of SpO₂, blood pressure, or temperature.",
      });
      return;
    }

    setVitalsState({ kind: "pending" });
    try {
      const res = await fetch("/api/vitals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          source: "manual",
          quality: "ok",
          deviceLabel: "Demo console (operator)",
          ...parsed,
        }),
      });
      if (!res.ok) {
        setVitalsState({ kind: "error", message: await readErrorMessage(res) });
        return;
      }
      const json = (await res.json()) as { persisted?: boolean };
      setVitalsState({
        kind: "ok",
        message: json.persisted
          ? "Vitals saved."
          : "Vitals accepted but not persisted — Supabase credentials are missing (NEXT_PUBLIC_SUPABASE_URL / key).",
      });
    } catch {
      setVitalsState({
        kind: "error",
        message: "Could not reach /api/vitals.",
      });
    }
  }, [spo2, sbp, dbp, tempC]);

  const uploadEcg = useCallback(async (file: File | null) => {
    if (!file) return;
    setEcgReading(null);
    setEcgState({ kind: "pending" });
    try {
      const body = new FormData();
      body.set("pdf", file);
      const res = await fetch("/api/ecg", { method: "POST", body });
      if (!res.ok) {
        setEcgState({ kind: "error", message: await readErrorMessage(res) });
        return;
      }
      const json = (await res.json()) as { reading: EcgReading; persisted?: boolean };
      setEcgReading(json.reading);
      const label = ECG_LABELS[json.reading.determination];
      const bpm =
        json.reading.bpm !== undefined ? `${json.reading.bpm} bpm` : "no BPM on report";
      setEcgState({
        kind: "ok",
        message: json.persisted
          ? `Extracted ${label} · ${bpm}.`
          : `Extracted ${label} · ${bpm}. Not persisted — Supabase credentials are missing.`,
      });
    } catch {
      setEcgState({ kind: "error", message: "Could not reach /api/ecg." });
    }
  }, []);

  const runCheckin = useCallback(async () => {
    const text = transcript.trim();
    if (!text) {
      setCheckinState({ kind: "error", message: "Transcript cannot be empty." });
      return;
    }
    setCheckinResult(null);
    setCheckinState({ kind: "pending" });
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });
      if (!res.ok) {
        setCheckinState({ kind: "error", message: await readErrorMessage(res) });
        return;
      }
      const json = (await res.json()) as CheckinResult;
      setCheckinResult(json);
      const warn =
        json.warnings && json.warnings.length > 0
          ? ` ${json.warnings.join(" ")}`
          : "";
      setCheckinState({
        kind: "ok",
        message: `Decision: ${json.decision.level}.${warn}`,
      });
    } catch {
      setCheckinState({ kind: "error", message: "Could not reach /api/checkin." });
    }
  }, [transcript]);

  const callMargaret = useCallback(async () => {
    setCallState({ kind: "pending" });
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        status?: string;
        reason?: string;
        conversationId?: string | null;
      };
      if (!res.ok || json.status === "skipped" || json.status === "error") {
        setCallState({
          kind: "error",
          message:
            json.reason ??
            `Call failed (${res.status}). Check DEMO_PATIENT_PHONE and ElevenLabs credentials.`,
        });
        return;
      }
      setCallState({
        kind: "ok",
        message: json.conversationId
          ? `Call placed (${json.conversationId}). Answer on speaker — press any key at the Twilio trial message, then Mend speaks.`
          : "Call placed. Answer on speaker — press any key at the Twilio trial message, then Mend speaks.",
      });
    } catch {
      setCallState({ kind: "error", message: "Could not reach /api/call." });
    }
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-10 sm:px-8 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div className="space-y-2">
          <p className="eyebrow">Operator · mission control</p>
          <h1 className="font-heading text-heading text-ink">Demo console</h1>
          <p className="max-w-xl text-label text-ink-secondary">
            Pick the scenario, place the call, feed vitals or ECG, then cut to the product
            surfaces. Nothing here appears on /call, /family, or /clinician.
          </p>
        </div>
        <p className="rounded-lg border border-line bg-wash px-3 py-2 numeric text-meta text-ink-secondary">
          Shortcut{" "}
          <kbd className="font-medium text-ink">{CONSOLE_SHORTCUT_LABEL}</kbd>
          {" · "}
          <span className="text-ink-tertiary">from any page</span>
        </p>
      </header>

      {status && status.missing.length > 0 ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-line bg-wash px-4 py-3.5"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-ink-tertiary"
          />
          <div className="min-w-0 space-y-1">
            <p className="text-label font-medium text-ink">
              Credentials missing — actions will degrade with a named message
            </p>
            <p className="numeric text-meta text-ink-secondary">
              {status.missing.join(" · ")}
            </p>
          </div>
        </div>
      ) : status ? (
        <p className="text-meta text-ink-tertiary" role="status">
          Credentials wired — Anthropic, Supabase, ElevenLabs, Twilio, demo phone.
        </p>
      ) : null}

      <Panel title="Stage path">
        <ol className="grid gap-3 text-label text-ink-secondary sm:grid-cols-2 lg:grid-cols-4">
          <li className="border-t border-line pt-3">
            <span className="numeric text-meta text-ink-tertiary">01</span>
            <p className="mt-1 font-medium text-ink">Set scenario</p>
            <p className="mt-1 text-meta">Green for calm; PE for the red cut.</p>
          </li>
          <li className="border-t border-line pt-3">
            <span className="numeric text-meta text-ink-tertiary">02</span>
            <p className="mt-1 font-medium text-ink">Call Margaret</p>
            <p className="mt-1 text-meta">
              Trial: press any key after Twilio&apos;s message, then Mend speaks.
            </p>
          </li>
          <li className="border-t border-line pt-3">
            <span className="numeric text-meta text-ink-tertiary">03</span>
            <p className="mt-1 font-medium text-ink">Watch /call</p>
            <p className="mt-1 text-meta">Transcript left, clinical state right.</p>
          </li>
          <li className="border-t border-line pt-3">
            <span className="numeric text-meta text-ink-tertiary">04</span>
            <p className="mt-1 font-medium text-ink">Cut surfaces</p>
            <p className="mt-1 text-meta">Family → clinician → rule engine.</p>
          </li>
        </ol>
        <nav aria-label="Product surfaces" className="border-t border-line pt-4">
          <ul className="flex flex-col">
            {STAGE_SURFACES.map((surface) => (
              <li key={surface.href}>
                <Link
                  href={surface.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex min-h-12 items-baseline justify-between gap-4 border-t border-line py-3 last:border-b"
                >
                  <span className="inline-flex items-center gap-2 font-heading text-subhead text-ink group-hover:text-ink-secondary">
                    {surface.label}
                    <ExternalLink
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-ink-tertiary"
                    />
                  </span>
                  <span className="text-right text-meta text-ink-tertiary">
                    {surface.note}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="1 · Scenario">
          <div
            role="group"
            aria-label="Choose demo scenario"
            className="grid gap-2 sm:grid-cols-3"
          >
            {SCENARIOS.map((key) => {
              const active = scenario === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => void selectScenario(key)}
                  className={cn(
                    "min-h-11 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ink/25",
                    active
                      ? "border-ink bg-ink text-paper"
                      : "border-line-strong bg-raised text-ink hover:bg-wash",
                  )}
                >
                  <span className="block text-label font-medium">
                    {SCENARIO_META[key].label}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block text-meta leading-snug",
                      active ? "text-paper/75" : "text-ink-tertiary",
                    )}
                  >
                    {SCENARIO_META[key].summary}
                  </span>
                </button>
              );
            })}
          </div>
          <StatusLine state={scenarioState} />
        </Panel>

        <Panel title="2 · Call Margaret now">
          <p className="text-label text-ink-secondary">
            Places the ElevenLabs / Twilio outbound check-in to the demo patient phone.
          </p>
          <p className="rounded-lg border border-line bg-wash px-3 py-2.5 text-label text-ink">
            <span className="font-medium">Twilio trial:</span> answer on speaker, then{" "}
            <span className="font-medium">press any key</span> when you hear the trial
            message — Mend starts after that.
          </p>
          <Button
            type="button"
            size="lg"
            onClick={() => void callMargaret()}
            disabled={callState.kind === "pending"}
            className="min-h-12"
          >
            {callState.kind === "pending" ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Phone aria-hidden="true" className="size-4" />
            )}
            Call Margaret now
          </Button>
          <StatusLine state={callState} />
        </Panel>

        <Panel title="Manual vitals">
          <p className="text-label text-ink-secondary">
            SpO₂, blood pressure and temperature — operator&apos;s own device readings,
            labelled as such. Validated against the clinical plausibility envelopes before
            POST /api/vitals.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  id: `${formId}-spo2`,
                  label: "SpO₂",
                  hint: `${PLAUSIBLE_RANGES.spo2.min}–${PLAUSIBLE_RANGES.spo2.max} %`,
                  value: spo2,
                  set: setSpo2,
                  field: "spo2" as const,
                  step: "1",
                },
                {
                  id: `${formId}-temp`,
                  label: "Temperature",
                  hint: `${PLAUSIBLE_RANGES.tempC.min}–${PLAUSIBLE_RANGES.tempC.max} °C`,
                  value: tempC,
                  set: setTempC,
                  field: "tempC" as const,
                  step: "0.1",
                },
                {
                  id: `${formId}-sbp`,
                  label: "Systolic BP",
                  hint: `${PLAUSIBLE_RANGES.sbp.min}–${PLAUSIBLE_RANGES.sbp.max} mmHg`,
                  value: sbp,
                  set: setSbp,
                  field: "sbp" as const,
                  step: "1",
                },
                {
                  id: `${formId}-dbp`,
                  label: "Diastolic BP",
                  hint: `${PLAUSIBLE_RANGES.dbp.min}–${PLAUSIBLE_RANGES.dbp.max} mmHg`,
                  value: dbp,
                  set: setDbp,
                  field: "dbp" as const,
                  step: "1",
                },
              ] as const
            ).map((field) => (
              <label key={field.id} className="block space-y-1.5" htmlFor={field.id}>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-label font-medium text-ink">{field.label}</span>
                  <span className="numeric text-meta text-ink-tertiary">{field.hint}</span>
                </span>
                <input
                  id={field.id}
                  type="number"
                  inputMode="decimal"
                  step={field.step}
                  value={field.value}
                  onChange={(e) => field.set(e.target.value)}
                  aria-invalid={fieldErrors[field.field] ? true : undefined}
                  aria-describedby={
                    fieldErrors[field.field] ? `${field.id}-err` : undefined
                  }
                  className={cn(
                    "numeric h-11 w-full rounded-lg border bg-paper px-3 text-body text-ink",
                    "outline-none focus-visible:border-ink focus-visible:ring-3 focus-visible:ring-ink/25",
                    fieldErrors[field.field]
                      ? "border-severity-red-border"
                      : "border-line-strong",
                  )}
                />
                {fieldErrors[field.field] ? (
                  <span
                    id={`${field.id}-err`}
                    className="block text-meta text-severity-red-fg"
                  >
                    {fieldErrors[field.field]}
                  </span>
                ) : null}
              </label>
            ))}
          </div>
          <Button
            type="button"
            onClick={() => void submitVitals()}
            disabled={vitalsState.kind === "pending"}
          >
            {vitalsState.kind === "pending" ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            Save vitals
          </Button>
          <StatusLine state={vitalsState} />
        </Panel>

        <Panel title="Kardia PDF">
          <p className="text-label text-ink-secondary">
            Upload a KardiaMobile 6L PDF export. Claude extracts the FDA-cleared
            determination and BPM — Mend never re-derives rhythm from the waveform.
          </p>
          <label className="relative flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line-strong bg-paper px-4 py-3 hover:bg-wash">
            <Upload aria-hidden="true" className="size-4 shrink-0 text-ink-tertiary" />
            <span className="text-label text-ink">Choose PDF</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              aria-label="Choose Kardia PDF"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                void uploadEcg(file);
                e.target.value = "";
              }}
            />
          </label>
          {ecgReading ? (
            <dl className="grid grid-cols-2 gap-3 rounded-lg border border-line bg-wash px-4 py-3">
              <div>
                <dt className="text-meta text-ink-tertiary">Determination</dt>
                <dd className="text-label font-medium text-ink">
                  {ECG_LABELS[ecgReading.determination]}
                </dd>
              </div>
              <div>
                <dt className="text-meta text-ink-tertiary">BPM</dt>
                <dd className="numeric text-label font-medium text-ink">
                  {ecgReading.bpm ?? "—"}
                </dd>
              </div>
            </dl>
          ) : null}
          <StatusLine state={ecgState} />
        </Panel>

        <div className="lg:col-span-2">
          <BleHeartRate />
        </div>

        <Panel title="Transcript check-in" className="lg:col-span-2">
          <p className="text-label text-ink-secondary">
            Free-text stand-in for the voice call. POSTs to /api/checkin so the full
            extract → evaluate → compose → SBAR pipeline runs without ElevenLabs.
          </p>
          <label className="block space-y-1.5" htmlFor={`${formId}-transcript`}>
            <span className="text-label font-medium text-ink">Transcript</span>
            <textarea
              id={`${formId}-transcript`}
              rows={4}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className={cn(
                "w-full rounded-lg border border-line-strong bg-paper px-3 py-2.5 text-body text-ink",
                "outline-none focus-visible:border-ink focus-visible:ring-3 focus-visible:ring-ink/25",
              )}
            />
          </label>
          <Button
            type="button"
            onClick={() => void runCheckin()}
            disabled={checkinState.kind === "pending"}
          >
            {checkinState.kind === "pending" ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <FileUp aria-hidden="true" className="size-4" />
            )}
            Run check-in
          </Button>
          <StatusLine state={checkinState} />

          {checkinResult ? (
            <div className="space-y-4 border-t border-line pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <SeverityChip level={checkinResult.decision.level} />
                {checkinResult.decision.condition ? (
                  <p className="text-label text-ink-secondary">
                    {checkinResult.decision.condition}
                  </p>
                ) : null}
              </div>
              <p className="font-heading text-subhead text-ink">
                {checkinResult.decision.action}
              </p>
              {checkinResult.decision.firedRules.length > 0 ? (
                <p className="numeric text-meta text-ink-tertiary">
                  Fired: {checkinResult.decision.firedRules.join(", ")}
                </p>
              ) : null}
              {checkinResult.trendFindings.length > 0 ? (
                <ul className="space-y-1 text-label text-ink-secondary">
                  {checkinResult.trendFindings.map((f) => (
                    <li key={f.id}>
                      <span className="font-medium text-ink">{f.id}</span>
                      {" — "}
                      {f.description}
                    </li>
                  ))}
                </ul>
              ) : null}
              {checkinResult.sbar ? (
                <div className="space-y-2">
                  <p className="eyebrow">SBAR</p>
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-line bg-wash p-4 font-heading text-body text-ink">
                    {checkinResult.sbar}
                  </pre>
                </div>
              ) : (
                <p className="text-meta text-ink-tertiary">No SBAR (green decision).</p>
              )}
            </div>
          ) : null}
        </Panel>
      </div>

      <MedicalAdviceDisclaimer
        extra="Synthetic patient data only. Manual and BLE readings on this page are the operator's own."
      />
    </div>
  );
}
