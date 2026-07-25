"use client";

import { useEffect, useState } from "react";
import { Decision, Symptoms, VitalsReading } from "@/lib/clinical/types";

interface Checkin {
  id: string;
  created_at: string;
  day_post_op: number;
  symptoms: Symptoms;
  vitals: VitalsReading;
  decision: Decision;
  sbar?: string;
  transcript?: string;
}

interface LocalMessage {
  id: string;
  created_at: string;
  sender: string;
  content: string;
}

export default function ClinicianPortal() {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [selectedCheckin, setSelectedCheckin] = useState<Checkin | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Poll check-ins and messages
  useEffect(() => {
    async function loadData() {
      try {
        const checkinRes = await fetch("/api/checkins");
        if (checkinRes.ok) {
          const { checkins: data } = await checkinRes.json();
          setCheckins(data ?? []);
          if (data && data.length > 0 && !selectedCheckin) {
            setSelectedCheckin(data[0]);
          }
        }

        const msgRes = await fetch("/api/messages");
        if (msgRes.ok) {
          const { messages: msgs } = await msgRes.json();
          // Merge Supabase messages with localStorage fallback
          const localStr = localStorage.getItem("mend_patient_messages");
          const localMsgs = localStr ? JSON.parse(localStr) : [];
          const combined = [...(msgs ?? []), ...localMsgs].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          setMessages(combined);
        }
      } catch (err) {
        console.error("Failed to load clinician portal data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [selectedCheckin]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const content = newMessage.trim();
    setNewMessage("");
    setStatus("Sending...");

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, sender: "Care Team" }),
      });

      const data = await res.json();
      
      // Save locally to localStorage as well so that tabs immediately see it
      const localStr = localStorage.getItem("mend_patient_messages");
      const localMsgs = localStr ? JSON.parse(localStr) : [];
      const newMsgObj: LocalMessage = {
        id: Math.random().toString(),
        created_at: new Date().toISOString(),
        sender: "Care Team",
        content,
      };
      const updatedLocal = [newMsgObj, ...localMsgs];
      localStorage.setItem("mend_patient_messages", JSON.stringify(updatedLocal));

      // Force instant update of UI
      setMessages((prev) => [newMsgObj, ...prev]);

      if (data.status === "not configured") {
        setStatus("Sent (using localStorage fallback)");
      } else {
        setStatus("Sent and saved to Supabase");
      }
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setStatus("Failed to send message: " + (err instanceof Error ? err.message : "unknown"));
    }
  }

  const getVerdictStyle = (level: string) => {
    switch (level) {
      case "red":
        return { border: "1px solid var(--crit-line)", background: "var(--crit-soft)", color: "var(--crit)" };
      case "amber":
        return { border: "1px solid var(--warn-line)", background: "var(--warn-soft)", color: "var(--warn)" };
      default:
        return { border: "1px solid var(--ok-line)", background: "var(--ok-soft)", color: "var(--ok)" };
    }
  };

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(16px, 3vw, 34px)" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid var(--line)",
          paddingBottom: 18,
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Clinician Portal</h1>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>
            Patient Monitoring & Triage Handoff Feed
          </p>
        </div>
        <div style={{ padding: "6px 12px", background: "var(--brand-soft)", color: "var(--brand-deep)", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          Active Ward: Orthopaedics (Home Recovery)
        </div>
      </header>

      {loading && checkins.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>Loading portal...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24 }}>
          {/* LEFT COLUMN: Check-ins Feed */}
          <section className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 650, margin: "0 0 16px" }}>Margaret W. — Check-in History</h2>
            
            {checkins.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13.5 }}>No check-ins received yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {checkins.map((c) => {
                  const isSelected = selectedCheckin?.id === c.id;
                  const dateStr = new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " · " + new Date(c.created_at).toLocaleDateString();
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCheckin(c)}
                      style={{
                        textAlign: "left",
                        width: "100%",
                        padding: 14,
                        borderRadius: 11,
                        cursor: "pointer",
                        border: isSelected ? "2px solid var(--brand)" : "1px solid var(--line)",
                        background: isSelected ? "var(--brand-soft)" : "var(--surface)",
                        color: "var(--ink)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 13.5 }}>Day {c.day_post_op} Check-in</span>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 750,
                            textTransform: "uppercase",
                            padding: "2px 8px",
                            borderRadius: 12,
                            ...getVerdictStyle(c.decision.level),
                          }}
                        >
                          {c.decision.level}
                        </span>
                      </div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--faint)", marginBottom: 6 }}>{dateStr}</div>
                      <p style={{ fontSize: 12.5, color: "var(--muted)", margin: 0, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        "{c.transcript || "No transcript (simulated)"}"
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* RIGHT COLUMN: Check-in Details & Messages */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {selectedCheckin && (
              <section className="card" style={{ padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 650, margin: 0 }}>Check-in Assessment Details</h2>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>Day {selectedCheckin.day_post_op} Post-Op</span>
                </div>

                <div
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    marginBottom: 16,
                    ...getVerdictStyle(selectedCheckin.decision.level),
                  }}
                >
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>
                    Triage Alert: {selectedCheckin.decision.level.toUpperCase()}
                  </h3>
                  {selectedCheckin.decision.condition && (
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                      Possible complication: {selectedCheckin.decision.condition}
                    </div>
                  )}
                  <div style={{ fontSize: 12.5 }}>Action: {selectedCheckin.decision.action}</div>
                </div>

                {selectedCheckin.sbar && (
                  <div style={{ marginBottom: 16 }}>
                    <div className="klabel" style={{ marginBottom: 6 }}>SBAR Clinical Handoff Note</div>
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        fontSize: 12.5,
                        lineHeight: 1.5,
                        background: "var(--surface-2)",
                        border: "1px solid var(--line)",
                        padding: 12,
                        borderRadius: 8,
                        color: "var(--ink)",
                        margin: 0,
                        fontFamily: "var(--mono)",
                      }}
                    >
                      {selectedCheckin.sbar}
                    </pre>
                  </div>
                )}

                <div>
                  <div className="klabel" style={{ marginBottom: 6 }}>Verifiable Rationale</div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--muted)" }}>
                    {selectedCheckin.decision.rationale.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* CARE TEAM MESSAGING CENTER */}
            <section className="card" style={{ padding: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 650, margin: "0 0 14px" }}>Patient Messaging Center</h2>

              <form onSubmit={handleSendMessage} style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type instructions or reassurance for Margaret..."
                  style={{
                    flex: 1,
                    fontSize: 13.5,
                    padding: "10px 12px",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    background: "var(--surface-2)",
                    color: "var(--ink)",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: "10px 18px",
                    background: "var(--brand)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 13.5,
                  }}
                >
                  Send
                </button>
              </form>

              {status && <div className="mono" style={{ fontSize: 11.5, color: "var(--brand)", marginBottom: 12 }}>{status}</div>}

              <div className="klabel" style={{ marginBottom: 8 }}>Message Feed</div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  maxHeight: 200,
                  overflowY: "auto",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: 10,
                  background: "var(--surface-2)",
                }}
              >
                {messages.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--faint)", fontSize: 12.5, padding: 12 }}>
                    No messages sent yet.
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} style={{ background: "var(--surface)", padding: 10, borderRadius: 6, border: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-deep)" }}>{m.sender}</span>
                        <span className="mono" style={{ fontSize: 9.5, color: "var(--faint)" }}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ fontSize: 12.5, margin: 0, color: "var(--ink)" }}>{m.content}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
