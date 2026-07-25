"use client";

import { Decision } from "@/lib/clinical/types";

const TONE = { green: "ok", amber: "warn", red: "crit" } as const;

const CALL_LABEL: Record<string, string> = {
  "911": "Call 911",
  ER: "Go to the emergency room",
  surgeon_office: "Call your surgeon's office",
  nurse_line: "Call the nurse line",
};

function Icon({ level }: { level: Decision["level"] }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 26,
    height: 26,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.3,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  return level === "green" ? (
    <svg {...common}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ) : (
    <svg {...common}>
      <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    </svg>
  );
}

export function EscalationCard({
  decision,
  sbar,
}: {
  decision: Decision;
  sbar?: string;
}) {
  const tone = TONE[decision.level];

  return (
    <section
      aria-live="polite"
      style={{
        borderRadius: 14,
        border: `1px solid var(--${tone}-line)`,
        background: `var(--${tone}-soft)`,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", gap: 15, padding: "18px 20px", alignItems: "flex-start" }}>
        <div style={{ width: 62, textAlign: "center", flex: "none" }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              margin: "0 auto",
              border: `2px solid var(--${tone})`,
              color: `var(--${tone})`,
              background: "var(--surface)",
            }}
          >
            <Icon level={decision.level} />
          </div>
          <div
            className="mono"
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginTop: 7,
              fontWeight: 700,
              color: `var(--${tone})`,
            }}
          >
            {decision.level}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 650,
              letterSpacing: "-0.01em",
              margin: 0,
              textWrap: "balance",
            }}
          >
            {decision.condition ?? "On track"}
          </h2>
          <p style={{ fontSize: 14, marginTop: 5, marginBottom: 0 }}>{decision.action}</p>
          {decision.call && (
            <a
              href={decision.call === "911" ? "tel:911" : "#"}
              style={{
                display: "inline-block",
                marginTop: 12,
                padding: "10px 18px",
                borderRadius: 10,
                background: `var(--${tone})`,
                color: "#fff",
                fontWeight: 650,
                fontSize: 15,
                textDecoration: "none",
              }}
            >
              {CALL_LABEL[decision.call]}
            </a>
          )}
        </div>
      </div>

      <div style={{ background: "var(--surface)", borderTop: `1px solid var(--${tone}-line)`, padding: "15px 20px" }}>
        <div className="klabel" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          Why — deterministic rule trace
          <span
            className="mono"
            style={{
              fontSize: 10,
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
              color: "var(--muted)",
              padding: "2px 6px",
              borderRadius: 5,
              letterSpacing: 0,
            }}
          >
            red-flag-engine.ts
          </span>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
          {decision.rationale.map((r, i) => (
            <li key={i} style={{ display: "flex", gap: 10, fontSize: 13.5, alignItems: "flex-start" }}>
              <span style={{ color: `var(--${tone})`, flex: "none", marginTop: 2 }}>
                <Icon level={decision.level} />
              </span>
              <span>{r}</span>
            </li>
          ))}
        </ul>

        {sbar && (
          <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <div className="klabel" style={{ marginBottom: 8 }}>Clinician handoff · SBAR</div>
            <pre
              className="mono"
              style={{
                whiteSpace: "pre-wrap",
                fontSize: 12.5,
                lineHeight: 1.55,
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: 12,
                margin: 0,
                overflowX: "auto",
              }}
            >
              {sbar}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}
