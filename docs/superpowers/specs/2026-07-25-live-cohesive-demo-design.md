# Mend — Live Cohesive Demo (Path A: real phone)

**Design spec · 2026-07-25**  
**Audience:** YC judges tomorrow; operators driving `/console`  
**Approved approach:** Phase 1 live path, then Phase 2 cohesion polish only if Phase 1 is green.

---

## 1. Goal

Ship a **working** end-to-end demo: real outbound phone check-in, deterministic clinical engine, and the **same** decision visible on `/call`, `/family`, and `/clinician`. Not a fixture-only design study.

**Success criteria**
- `/console` → “Call Margaret” rings `DEMO_PATIENT_PHONE` via ElevenLabs + Twilio.
- Agent calls live `POST /api/triage` with `TRIAGE_WEBHOOK_SECRET`; speaks returned `script` verbatim.
- Check-in + decision persist (Supabase); family and clinician surfaces reflect the same scenario/decision.
- Anthropic extraction works (green path possible); fail-safe amber on extraction failure remains correct.
- Missing keys are visible on `/console` until cleared.
- Backup video recorded tonight if any live hop is flaky.

---

## 2. Current state (binding facts)

Already true:
- Product surfaces, engine, BLE HR, ECG upload, console, landing page exist on `main`.
- Local `.env` has Anthropic, Supabase, Twilio (`AC…`), ElevenLabs key, corrected `ELEVENLABS_AGENT_ID` (`agent_…`), imported `ELEVENLABS_AGENT_PHONE_NUMBER_ID`, demo phones (E.164), `TRIAGE_WEBHOOK_SECRET`.
- Twilio account is **Trial**; both demo phones are verified caller IDs.
- Supabase has Margaret seeded; `demo_state` and `pain_score` columns exist.

Not yet done:
- Vercel production env mirror + redeploy with these secrets.
- ElevenLabs agent webhook + prompt locked to live `/api/triage` and verbatim `script`.
- Live smoke test of outbound call + triage + multi-surface reflection.
- Phase 2 console cohesion polish.

---

## 3. Phase 1 — Live path

### 3.1 Vercel environment + deploy

Push to Vercel **production** (names exact):

- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_AGENT_PHONE_NUMBER_ID`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- `DEMO_PATIENT_PHONE`, `DEMO_CAREGIVER_PHONE`
- `TRIAGE_WEBHOOK_SECRET`

Then `vercel --prod` (or equivalent) so production serves current `main`.

Confirm production URL used by the agent webhook (expected alias: `https://mend-ten.vercel.app` unless project aliases change — verify before wiring).

### 3.2 ElevenLabs agent (“New agent”)

Configure Conversational AI agent linked to the imported Twilio number:

| Setting | Value |
|---|---|
| Webhook / tool URL | `https://<prod-host>/api/triage` |
| Method | `POST` |
| Auth header | `x-triage-webhook-secret: <TRIAGE_WEBHOOK_SECRET>` (exact header name in `app/api/triage/route.ts`) |
| Timeout | ≥ 10s; disable interruption during tool |
| Pre-tool speech | short filler so silence is not dead air |
| Prompt rule | Speak the returned `script` **verbatim**. Never invent green/amber/red or escalate on own judgement. US terms only (ER, 911, care team, nurse line). |

Persona: warm, unhurried, elderly-friendly; one question at a time; read back critical symptoms.

### 3.3 Smoke test sequence

1. Open production (or local with same env) `/console` — missing-key banner empty for Tier-2 vars.
2. Select scenario (green, then PE/red for peak).
3. Trigger outbound call — patient phone rings.
4. Complete check-in; confirm triage tool fires; agent speaks engine script.
5. Open `/call`, `/family`, `/clinician` — same clinical truth / scenario.
6. Optional: BLE HR in Chrome with watch broadcasting; Kardia PDF upload from console.

**Fix policy:** only change code when a live hop fails; prefer config/env fixes first.

### 3.4 Safety constraints (unchanged)

- LLM never chooses escalation; only `evaluate()` does.
- Fail-safe toward escalation.
- Synthetic patient data; operator device readings labelled as operator’s.
- “Educational prototype — not medical advice” on every surface.
- Mend does not re-derive ECG rhythm from waveform.

---

## 4. Phase 2 — Cohesion (gated)

Only after Phase 1 smoke is green:

- Treat `/console` as mission control: scenario, vitals, ECG, BLE, call, and clear deep links to product surfaces.
- Keep landing Product rows as real routes into that system.
- No fake hospital logos or invented metrics.
- No new clinical features (Thymia stays parked).

---

## 5. Operator / physical checklist (human)

- Chrome/Edge; watch in a **started activity** broadcasting HR.
- Two Kardia PDFs pre-exported (rest + post-exercise).
- Demo phones: speaker on, ringer up, DND off.
- Record backup video of the PE cut tonight.

---

## 6. Non-goals

- Redesigning landing or clinical chrome beyond cohesion links.
- Replacing Twilio trial with paid (unless trial blocks the room).
- Building a new unified “demo shell” app.
- Thymia / RTM adherence.

---

## 7. Verification

- `/console` demo-status shows no missing Tier-2 keys (prod + local).
- One successful outbound call with triage round-trip logged.
- `npm test` remains green if code changes land.
- Honest report of any hop that could not be verified live.
