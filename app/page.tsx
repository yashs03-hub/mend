"use client";

import { useState } from "react";
import { Decision, Phase, Symptoms, VitalsReading } from "@/lib/clinical/types";
import { Disclaimer } from "./components/Disclaimer";
import { CheckinPanel } from "./components/CheckinPanel";
import { VitalsTiles } from "./components/VitalsTiles";
import { EscalationCard } from "./components/EscalationCard";
import { RehabCard } from "./components/RehabCard";

interface CheckinResponse {
  decision: Decision;
  phase: Phase;
  vitals: VitalsReading;
  symptoms: Symptoms;
  sbar?: string;
  meta: {
    extractionSource: "model" | "heuristic";
    extractionNote?: string;
    sbarSource?: "model" | "deterministic";
    sbarNote?: string;
    storage: string;
  };
}

export default function Home() {
  const [data, setData] = useState<CheckinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reported = data
    ? Object.entries(data.symptoms).filter(([, v]) => v !== undefined)
    : [];

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(16px,3vw,34px)" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingBottom: 18,
          marginBottom: 18,
          borderBottom: "1px solid var(--line)",
          flexWrap: "wrap",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: "var(--brand)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            flex: "none",
          }}
        >
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12h4l2-6 4 12 2.5-8 1.5 2h6" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, margin: 0, letterSpacing: "-0.02em", fontWeight: 650 }}>Mend</h1>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Post-discharge orthopaedic recovery co-pilot
          </div>
        </div>
        <div className="mono" style={{ fontSize: 11.5, color: "var(--muted)", textAlign: "right" }}>
          Margaret W. · 82 F
          <br />
          R hip hemiarthroplasty · discharged POD 3
        </div>
      </header>

      <div style={{ marginBottom: 18 }}>
        <Disclaimer />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <CheckinPanel
          busy={busy}
          setBusy={setBusy}
          onResult={(d, err) => {
            setError(err ?? null);
            setData(err ? null : (d as CheckinResponse));
          }}
        />

        {error && (
          <div
            role="alert"
            className="card"
            style={{ padding: "14px 16px", borderColor: "var(--crit-line)", background: "var(--crit-soft)", color: "var(--crit)" }}
          >
            {error}
          </div>
        )}

        {data && (
          <>
            <VitalsTiles vitals={data.vitals} phase={data.phase} />
            <EscalationCard decision={data.decision} sbar={data.sbar} />

            <section className="card" style={{ padding: "16px 18px" }}>
              <div className="klabel" style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                Understood by Mend
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    background: data.meta.extractionSource === "model" ? "var(--brand-soft)" : "var(--warn-soft)",
                    color: data.meta.extractionSource === "model" ? "var(--brand-deep)" : "var(--warn)",
                    padding: "2px 6px",
                    borderRadius: 5,
                    letterSpacing: 0,
                  }}
                >
                  {data.meta.extractionSource === "model" ? "Claude · structured extraction" : "keyword fallback"}
                </span>
              </div>
              {reported.length === 0 ? (
                <p style={{ fontSize: 13.5, color: "var(--muted)", margin: 0 }}>
                  No specific symptoms reported.
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {reported.map(([k, v]) => {
                    const bad = k === "painControlled" ? v === false : v === true;
                    return (
                      <span
                        key={k}
                        style={{
                          fontSize: 12.5,
                          padding: "6px 11px",
                          borderRadius: 20,
                          border: `1px solid ${bad ? "var(--crit-line)" : "var(--line-strong)"}`,
                          background: bad ? "var(--crit-soft)" : "var(--surface-2)",
                          color: bad ? "var(--crit)" : "var(--ink)",
                        }}
                      >
                        {k.replace(/([A-Z])/g, " $1").toLowerCase().trim()}
                        {k === "painControlled" && (v === false ? ": no" : ": yes")}
                      </span>
                    );
                  })}
                </div>
              )}

              {(data.meta.extractionNote || data.meta.sbarNote) && (
                <p className="mono" style={{ fontSize: 11, color: "var(--faint)", marginTop: 12, marginBottom: 0 }}>
                  {[data.meta.extractionNote, data.meta.sbarNote].filter(Boolean).join(" · ")}
                </p>
              )}
              <p className="mono" style={{ fontSize: 11, color: "var(--faint)", marginTop: 6, marginBottom: 0 }}>
                storage: {data.meta.storage}
              </p>
            </section>

            <RehabCard phase={data.phase} />
          </>
        )}
      </div>
    </main>
  );
}
