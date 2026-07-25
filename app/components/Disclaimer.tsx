export function Disclaimer() {
  return (
    <div
      role="note"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        fontSize: 12.5,
        color: "var(--muted)",
        background: "var(--surface-2)",
        border: "1px dashed var(--line-strong)",
        borderRadius: 10,
        padding: "9px 13px",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="var(--warn)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flex: "none" }}
        aria-hidden="true"
      >
        <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      </svg>
      <span>
        <b style={{ color: "var(--ink)", fontWeight: 600 }}>
          Educational prototype — not medical advice.
        </b>{" "}
        All data synthetic. Mend routes concerns to a clinician; it does not
        diagnose. Vitals are simulated in place of real devices.
      </span>
    </div>
  );
}
