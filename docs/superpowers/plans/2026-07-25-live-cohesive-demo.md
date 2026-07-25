# Live Cohesive Demo (Path A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Mend’s real phone check-in path work end-to-end on production so call / family / clinician show one engine decision.

**Architecture:** Ops-first. Sync secrets to Vercel, redeploy `main`, configure the ElevenLabs agent webhook to `POST /api/triage` with header `x-triage-webhook-secret`, smoke-test outbound call. Fix code only when a live hop fails. Phase 2 console cohesion only after Phase 1 is green.

**Tech Stack:** Vercel CLI, ElevenLabs ConvAI API, Twilio (already imported), Next.js routes `/api/call` + `/api/triage`, Supabase, Anthropic.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-25-live-cohesive-demo-design.md` — binding.
- LLM never chooses escalation; only `evaluate()` does.
- Fail-safe toward escalation; synthetic patient data; disclaimer on every surface.
- US English (ER, 911, care team, nurse line).
- Webhook header must be exactly `x-triage-webhook-secret`.
- Production host: verify `https://mend-ten.vercel.app` before wiring agent.
- Never commit `.env` or print secret values in logs/reports.
- Prefer Grok 4.5 for code-fix subagents; ops steps may run in the controller shell.
- Verify `git branch --show-current` before every commit.

---

## File structure

| Path | Role |
|---|---|
| `.env` (local, gitignored) | Source of secrets — never commit |
| Vercel project `mend-health` | Production env + deploy |
| ElevenLabs agent `ELEVENLABS_AGENT_ID` | Webhook tool + prompt |
| `app/api/triage/route.ts` | Auth + engine (change only if broken) |
| `app/api/call/route.ts` | Outbound call trigger (change only if broken) |
| `app/console/DemoConsole.tsx` | Phase 2 cohesion only |
| `docs/demo-runbook.md` | Update prod URL / checklist if needed |

---

### Task 1: Push main + sync Vercel env + production deploy

**Files:** none in git (Vercel dashboard / CLI only), except optional docs note after success.

**Produces:** Production deployment with all Tier-1/Tier-2 env vars present.

- [ ] **Step 1: Push local main**

```bash
git branch --show-current   # must be main
git push origin main
```

- [ ] **Step 2: Sync env vars to Vercel production**

For each key below, set production value from local `.env` without echoing secrets. Prefer:

```bash
# Example pattern (value from .env, not pasted into chat):
node -e '
const fs=require("fs");
const env={};
for (const line of fs.readFileSync(".env","utf8").split("\n")) {
  if (!line||line.startsWith("#")||!line.includes("=")) continue;
  const i=line.indexOf("=");
  const k=line.slice(0,i).trim(); const v=line.slice(i+1).trim();
  if (v) env[k]=v;
}
const key=process.argv[1];
if (!env[key]) { console.error("missing", key); process.exit(1); }
process.stdout.write(env[key]);
' ANTHROPIC_API_KEY | vercel env add ANTHROPIC_API_KEY production --force
```

Keys (all `production`):

`ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_AGENT_PHONE_NUMBER_ID`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `DEMO_PATIENT_PHONE`, `DEMO_CAREGIVER_PHONE`, `TRIAGE_WEBHOOK_SECRET`

Optional: `NEXT_PUBLIC_ELEVENLABS_AGENT_ID` if the client reads it.

Verify with `vercel env ls production` — names present, do not print values.

- [ ] **Step 3: Deploy production**

```bash
vercel --prod --yes
```

Expected: deployment URL; alias includes `mend-ten.vercel.app`.

- [ ] **Step 4: Confirm demo-status on prod**

```bash
curl -sS https://mend-ten.vercel.app/api/demo-status
```

Expected: JSON listing missing keys empty (or only optional unused keys). Report which are still missing without printing secrets.

- [ ] **Step 5: Commit only if docs updated; otherwise note “no code commit”**

If `docs/demo-runbook.md` or handoff needs the confirmed prod URL, commit that. Do not commit `.env`.

---

### Task 2: Configure ElevenLabs agent webhook + prompt

**Files:** none required in repo; agent config via ElevenLabs API or dashboard.

**Consumes:** `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `TRIAGE_WEBHOOK_SECRET`, prod host from Task 1.

**Produces:** Agent with webhook tool pointing at `https://mend-ten.vercel.app/api/triage` and prompt requiring verbatim `script`.

- [ ] **Step 1: GET current agent config**

```bash
# Use xi-api-key from .env; do not print full JSON if it embeds secrets
curl -sS -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/convai/agents/$ELEVENLABS_AGENT_ID" | head -c 500
```

Document which fields hold tools / prompt (`conversation_config`, `tools`, etc.).

- [ ] **Step 2: Add or update webhook tool**

Tool must:

- URL: `https://mend-ten.vercel.app/api/triage`
- Method: POST
- Header: `x-triage-webhook-secret` = value of `TRIAGE_WEBHOOK_SECRET`
- `response_timeout_secs`: 10
- Prefer `interruption_mode: disable_during_tool` if supported
- `pre_tool_speech`: e.g. “One moment while I check that against your recovery plan.”

Request body shape the tool sends must include `symptoms` object matching `Symptoms` (see `app/api/triage/route.ts` / extract schema). If the existing agent tool schema differs, align it to what triage validates.

- [ ] **Step 3: Patch system prompt**

Include binding rules:

- Speak the tool response field `script` **verbatim**.
- Never invent severity or tell the patient to go to ER/911 unless `script` says so.
- US terms: ER, 911, care team, nurse line.
- Warm, unhurried, one question at a time; read back critical symptoms.

- [ ] **Step 4: Verify agent still assigned to imported phone number**

`GET /v1/convai/phone-numbers` — demo number’s `assigned_agent.agent_id` matches `ELEVENLABS_AGENT_ID`.

- [ ] **Step 5: Report** — webhook URL, header name confirmed, prompt updated (yes/no). No secrets in report.

---

### Task 3: Live smoke test (call + triage + surfaces)

**Files:** change code only if a hop fails; then minimal fix + test + commit.

**Produces:** Evidence of one successful outbound call path or a precise failure report.

- [ ] **Step 1: Local console status**

With `npm run dev`, open `/console` (or `curl localhost:3000/api/demo-status`). Missing Tier-2 keys should be none.

- [ ] **Step 2: Trigger outbound call**

From `/console` “Call Margaret now”, or:

```bash
curl -sS -X POST http://localhost:3000/api/call \
  -H 'content-type: application/json' \
  -d '{}'
```

Expected: success JSON from ElevenLabs outbound; **physical phone rings**.

If fail: capture status/reason (no secrets); fix env/agent assignment before code.

- [ ] **Step 3: Mid-call triage**

During or via simulated tool POST:

```bash
# Secret from .env — do not log it
SECRET=$(node -e '/* print TRIAGE_WEBHOOK_SECRET */')
curl -sS -X POST https://mend-ten.vercel.app/api/triage \
  -H "content-type: application/json" \
  -H "x-triage-webhook-secret: $SECRET" \
  -d '{"symptoms":{"shortnessOfBreath":true,"chestPain":false,"calfPain":false,"calfSwelling":false,"feverish":false,"woundIssues":false,"dizziness":false},"dayPostOp":4}'
```

Expected: 200 with `severity`, `script` from engine (not model-authored severity).

- [ ] **Step 4: Multi-surface check**

After a real or console transcript check-in for a chosen scenario, open `/call`, `/family`, `/clinician` and confirm the same clinical story. Note PE cut uses `/family?state=urgent` for deep link; console scenario store is preferred on stage.

- [ ] **Step 5: Write smoke report** to `.superpowers/sdd/live-smoke-report.md` — what passed, what could not be verified, exact failing hop if any.

- [ ] **Step 6: If code fix required** — TDD where applicable, commit on `main` or `fix/live-demo`, push.

---

### Task 4: Phase 2 console cohesion (gated)

**Only if Task 3 smoke is green.**

**Files:**
- Modify: `app/console/DemoConsole.tsx` (mission-control clarity)
- Possibly: `app/components/landing/Surfaces.tsx` notes only if labels mislead

**Produces:** Clear operator path: pick scenario → vitals/ECG/BLE → call → open surfaces. No fake metrics.

- [ ] **Step 1: Audit console UX** against stage sequence in `docs/demo-runbook.md`.
- [ ] **Step 2: Minimal copy/layout fixes** so the driver cannot miss “Call Margaret” / scenario / surface links.
- [ ] **Step 3: Visual check `/console` projector width; `npm test`; commit.

---

## Spec coverage

| Spec item | Task |
|---|---|
| Vercel env + deploy | 1 |
| Agent webhook + verbatim script | 2 |
| Smoke call + triage + surfaces | 3 |
| Phase 2 cohesion | 4 (gated) |
| No secrets in git | all |
| Safety constraints | all |

---

## Execution note

Tasks 1–2 are primarily operations. Controllers may run them directly with shell; use Grok subagents for Task 3 failures that need code and for Task 4.
