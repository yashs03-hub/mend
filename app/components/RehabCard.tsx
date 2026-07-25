import { Phase } from "@/lib/clinical/types";

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="klabel" style={{ marginBottom: 7 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
        {items.map((it, i) => (
          <li key={i} style={{ fontSize: 13.5 }}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

export function RehabCard({ phase }: { phase: Phase }) {
  return (
    <section className="card" style={{ padding: "16px 18px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 650, margin: 0 }}>Today&rsquo;s rehab</h2>
        <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>
          {phase.name} · days {phase.dayStart}–{phase.dayEnd === 999 ? "onwards" : phase.dayEnd}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 18,
        }}
      >
        <List title="Exercises" items={phase.rehab} />
        <List title="Precautions" items={phase.precautions} />
      </div>

      <div
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid var(--line)",
          fontSize: 13.5,
        }}
      >
        <span className="klabel" style={{ marginRight: 8 }}>Weight-bearing</span>
        {phase.weightBearing}
      </div>
    </section>
  );
}
