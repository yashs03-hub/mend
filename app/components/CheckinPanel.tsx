"use client";

import { useEffect, useState } from "react";

export type Scenario = "green" | "pe" | "fever";

const DEMO_TRANSCRIPTS: Record<Scenario, string> = {
  green:
    "Slept alright, thank you. It's a bit sore, maybe a three, but nothing like the first day. The wound feels a little warm but it's dry. I did my walk to the kitchen with the frame.",
  pe: "I'm a bit out of puff, love. Going to the bathroom left me really breathless. There's a sharp catch in my chest when I breathe deep. My right calf's been sore and swollen too.",
  fever:
    "I feel alright in myself. A bit warm maybe, but the wound's dry and I've been doing my exercises.",
};

const DEMO_DAY: Record<Scenario, number> = { green: 4, pe: 9, fever: 4 };

const SCENARIO_LABEL: Record<Scenario, string> = {
  green: "Day 1 home · stable",
  fever: "37.8 °C · move the day",
  pe: "Day 6 home · escalation",
};

const SCENARIO_TONE: Record<Scenario, string> = {
  green: "var(--ok)",
  fever: "var(--warn)",
  pe: "var(--crit)",
};

/** Renders the ElevenLabs widget only when an agent id is configured. */
function VoiceWidget({ agentId }: { agentId: string }) {
  useEffect(() => {
    const id = "elevenlabs-convai-script";
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
    s.async = true;
    s.type = "text/javascript";
    document.body.appendChild(s);
  }, []);

  return (
    <div style={{ marginTop: 12 }}>
      <div className="klabel" style={{ marginBottom: 8 }}>Live voice check-in</div>
      {/* @ts-expect-error — custom element provided by the ElevenLabs embed script */}
      <elevenlabs-convai agent-id={agentId} />
    </div>
  );
}

export function CheckinPanel({
  onResult,
  busy,
  setBusy,
}: {
  onResult: (data: unknown, error?: string) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
}) {
  const [scenario, setScenario] = useState<Scenario>("green");
  const [dayPostOp, setDayPostOp] = useState(DEMO_DAY.green);
  const [transcript, setTranscript] = useState(DEMO_TRANSCRIPTS.green);

  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

  function pick(s: Scenario) {
    setScenario(s);
    setDayPostOp(DEMO_DAY[s]);
    setTranscript(DEMO_TRANSCRIPTS[s]);
  }

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript, dayPostOp, scenario }),
      });
      if (!res.ok) {
        onResult(null, `Check-in failed (${res.status})`);
        return;
      }
      onResult(await res.json());
    } catch (err) {
      onResult(null, err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" style={{ padding: "16px 18px" }}>
      <h2 style={{ fontSize: 16, fontWeight: 650, margin: "0 0 12px" }}>Daily check-in</h2>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <div className="klabel" style={{ marginBottom: 6 }}>Demo scenario</div>
          <div
            role="group"
            aria-label="Choose demo scenario"
            style={{
              display: "inline-flex",
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
              borderRadius: 11,
              padding: 4,
              gap: 4,
            }}
          >
            {(["green", "fever", "pe"] as Scenario[]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={scenario === s}
                onClick={() => pick(s)}
                style={{
                  fontSize: 13,
                  cursor: "pointer",
                  border: `1px solid ${scenario === s ? "var(--line-strong)" : "transparent"}`,
                  background: scenario === s ? "var(--surface)" : "transparent",
                  color: scenario === s ? SCENARIO_TONE[s] : "var(--muted)",
                  fontWeight: scenario === s ? 650 : 500,
                  padding: "7px 14px",
                  borderRadius: 8,
                }}
              >
                {SCENARIO_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="klabel" htmlFor="day" style={{ display: "block", marginBottom: 6 }}>
            Day post-op
          </label>
          <input
            id="day"
            type="number"
            min={0}
            max={999}
            value={dayPostOp}
            onChange={(e) => setDayPostOp(Number(e.target.value))}
            className="mono"
            style={{
              width: 84,
              fontSize: 14,
              padding: "8px 10px",
              border: "1px solid var(--line)",
              borderRadius: 8,
              background: "var(--surface-2)",
              color: "var(--ink)",
            }}
          />
        </div>
      </div>

      {scenario === "fever" && (
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "10px 0 0" }}>
          Same 37.8 °C reading either way. Run it on day 4, then change the day to 21 and run it
          again — the vitals do not move, the verdict does.
        </p>
      )}

      <label className="klabel" htmlFor="transcript" style={{ display: "block", margin: "14px 0 6px" }}>
        What the patient said
      </label>
      <textarea
        id="transcript"
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        rows={4}
        style={{
          width: "100%",
          fontSize: 13.5,
          lineHeight: 1.5,
          padding: 11,
          border: "1px solid var(--line)",
          borderRadius: 10,
          background: "var(--surface-2)",
          color: "var(--ink)",
          fontFamily: "inherit",
          resize: "vertical",
        }}
      />

      <button
        type="button"
        onClick={run}
        disabled={busy}
        style={{
          marginTop: 12,
          padding: "11px 20px",
          borderRadius: 10,
          border: "none",
          background: busy ? "var(--muted)" : "var(--brand)",
          color: "#fff",
          fontWeight: 650,
          fontSize: 15,
          cursor: busy ? "progress" : "pointer",
        }}
      >
        {busy ? "Running check-in…" : "Run check-in"}
      </button>

      {agentId ? (
        <VoiceWidget agentId={agentId} />
      ) : (
        <p style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 12, marginBottom: 0 }}>
          Set <code className="mono">NEXT_PUBLIC_ELEVENLABS_AGENT_ID</code> to enable the live
          voice agent. Typed transcripts work without it.
        </p>
      )}
    </section>
  );
}
