# Mend — Clinician Hub Platform

**Design spec · 2026-07-25**  
**Goal:** Turn separate demo surfaces into one cohesive platform: the clinician’s daily hub is primary; the live phone call is wired into that hub; patients get a minimal portal that can request an immediate check-in call.

---

## 1. Product decisions (approved)

| Decision | Choice |
|---|---|
| Clinician home | **A** — `/clinician` is the full daily hub |
| Patient-requested call | **B** — request **auto-dials** immediately (no clinician click) |
| Live call UI | **A + C** — embedded on hub; **persistent live strip** if clinician navigates away |
| Patient portal depth | **A** — minimal: summary + Request check-in call (+ family link) |
| Architecture approach | Hub refactor (reuse `CallStage`, `/api/call`, worklist, patient chart) |

---

## 2. Goal & success criteria

**Success for the hackathon demo**
- Landing offers **Clinician hub** and **Patient portal** as the two clear product entries (not four equal demo tiles as the primary story).
- A clinician can work from `/clinician` alone: worklist → patient → **Call now** → embedded live session → family / rule engine without hunting `/console`.
- Patient on `/patient` (Margaret prefilled) taps **Request a check-in call** → phone rings via existing ElevenLabs/Twilio path → clinician hub shows live session / strip.
- Twilio trial keypress remains documented in UI copy where calls are placed.
- Educational prototype disclaimer on every user-facing surface; synthetic data only.

---

## 3. Clinician hub (`/clinician`)

### 3.1 Layout

**Desktop**
- **Worklist** — existing severity-sorted roster (`buildRoster` / Worklist). Selecting a row focuses that patient in the main pane (default Margaret for demo).
- **Main pane (idle)** — selected patient chart content (severity, action, latest vitals/ECG, SBAR, trends) — compose from existing `/clinician/[patientId]` components rather than forcing a full navigation away for the primary flow.
- **Main pane (live)** — embedded live check-in session: reuse `CallStage` with a hub layout variant (not necessarily full-bleed stage chrome).
- **Actions** — **Call now** (clinician-initiated `POST /api/call`), Open family view, link to Rule engine. Ops tools (scenario, manual vitals, Kardia, BLE, transcript check-in) available under an **Ops** disclosure or secondary panel — not the hero of the page.

**Mobile** — stack: worklist → actions → chart / live; live strip still sticky.

### 3.2 Live strip

When `liveCall.active` and the clinician is not on the embedded live pane (e.g. viewing Rule engine or another section):
- Sticky strip in `ClinicianShell`: “Live check-in · Margaret” + Return + optional status.
- Cleared when session ends or operator dismisses after call complete.

### 3.3 Navigation

`ClinicianShell` nav: **Hub (Worklist)** · **Rule engine** · optional Family.  
Remove or demote standalone “Live call” as a peer demo link; live call is a **mode of the hub**.

### 3.4 `/console`

Redirect to `/clinician` (with hash/query for Ops if useful), **or** keep a thin advanced page linked only from Ops. Must not remain a parallel “real” product entry on the landing page.

---

## 4. Patient portal (`/patient`)

Prefilled for Margaret (hackathon single-patient). Calm family-adjacent design language.

**Contents**
1. Short identity / recovery context  
2. Latest plain-language status (reuse family copy patterns where possible)  
3. Primary: **Request a check-in call** → `POST /api/call` immediately; confirm “Mend is calling you now” + Twilio trial keypress tip  
4. Secondary: link to `/family`  
5. `MedicalAdviceDisclaimer`

**Not in scope:** multi-patient picker, chat inbox, request-type taxonomy, auth.

---

## 5. Landing (`/`)

- Primary CTA: **Open clinician hub** → `/clinician`  
- Secondary CTA: **Patient portal** → `/patient`  
- Product surfaces list demoted or removed as the main conversion; optional quiet links remain if needed for judges  
- Brand + value narrative unchanged in spirit  

---

## 6. Call & session wiring

### 6.1 API

- Reuse `POST /api/call` for both clinician **Call now** and patient **Request check-in call**.  
- Optional body field `source: "clinician" | "patient"` for UI copy / analytics only — does not change telephony.  
- Triage webhook, check-in, vitals, ECG paths unchanged.

### 6.2 Client session (`liveCall`)

Small client module (e.g. `lib/sim/live-call.ts` or `app/components/clinician/live-call-store.ts`):

```ts
type LiveCallState = {
  active: boolean;
  conversationId: string | null;
  startedAt: number | null;
  source: "clinician" | "patient" | null;
};
```

- Set `active` on successful `/api/call` from hub or patient portal.  
- Persist lightly (sessionStorage/localStorage) so the same demo browser profile can show the strip if the clinician tab was already open (best-effort for same-device demo).  
- Clear on explicit end / timeout / failed call.

### 6.3 Embedding `CallStage`

- Add a `variant: "stage" | "hub"` (or equivalent) so hub embed drops projector-only chrome while keeping transcript + clinical pane + escalation takeover.  
- `/call` may remain as a deep link / fullscreen escape that also reads `liveCall` state.

---

## 7. Safety & constraints (binding)

- LLM never chooses escalation; only `evaluate()`.  
- Fail-safe toward escalation.  
- Synthetic patient data; operator device readings labelled.  
- “Educational prototype — not medical advice” on hub, patient portal, call, family.  
- US English (ER, 911, care team, nurse line).  
- Mend does not re-derive ECG rhythm.  
- No fake hospital logos or invented metrics on landing.

---

## 8. Out of scope

- Real auth / multi-tenant  
- True cross-device realtime sync (Supabase presence)  
- Clinician–patient chat product  
- Removing Twilio trial announcement (account upgrade)  
- Thymia / RTM adherence  

---

## 9. Verification

- From landing → clinician hub: Call now → live pane + strip behavior when navigating to Rule engine.  
- From landing → patient portal: Request call → phone rings; hub (same browser profile) shows live mode/strip.  
- Worklist + patient chart still render without credentials (fixtures).  
- `npm test` / `tsc` green; visual check `/clinician` and `/patient` at projector + phone widths.  
- Demo runbook updated for hub-first stage sequence.
