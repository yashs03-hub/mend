# Clinician Hub Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/clinician` a cohesive daily clinician hub with embedded live call, add a minimal `/patient` portal that auto-dials, and re-point the landing page at the platform (not a demo index).

**Architecture:** Client `liveCall` session store shared across hub and patient portal; both call buttons hit `POST /api/call`. `CallStage` gains a `hub` variant for embed. `ClinicianShell` hosts a sticky live strip. Landing dual CTAs → hub / patient. `/console` redirects into hub Ops.

**Tech Stack:** Next.js App Router, existing CallStage/Worklist/patient chart components, Framer Motion (existing), Vitest, ElevenLabs/Twilio via `/api/call`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-25-clinician-hub-platform-design.md` — binding.
- LLM never chooses escalation; only `evaluate()`.
- Fail-safe toward escalation; synthetic data; disclaimer on every surface.
- US English only.
- Twilio trial keypress tip wherever a call is placed.
- No fake logos/metrics; no Thymia; no real auth.
- TypeScript strict; verify branch before commit; prefer Grok 4.5 for implementers.
- Prefer reuse over rewrite: Worklist, patient chart pieces, CallStage, `/api/call`.

---

## File structure

| Path | Role |
|---|---|
| `lib/sim/live-call.ts` | `LiveCallState`, get/set/subscribe, sessionStorage |
| `lib/sim/live-call.test.ts` | Unit tests for store |
| `app/api/call/route.ts` | Optional `source` in body |
| `app/components/call/CallStage.tsx` | `variant?: "stage" \| "hub"` |
| `app/components/clinician/ClinicianShell.tsx` | Nav + LiveCallStrip |
| `app/components/clinician/LiveCallStrip.tsx` | Sticky strip |
| `app/components/clinician/ClinicianHub.tsx` | Client hub: worklist selection, chart/live, Call now, Ops |
| `app/components/clinician/HubOpsPanel.tsx` | Scenario/vitals/ECG/BLE/transcript (extracted or thin wrap from console) |
| `app/clinician/page.tsx` | Server data → `<ClinicianHub />` |
| `app/patient/page.tsx` | Patient portal |
| `app/components/patient/PatientPortal.tsx` | Request call UI |
| `app/components/landing/copy.ts` + Hero/Surfaces | Platform CTAs |
| `app/console/page.tsx` | Redirect to `/clinician#ops` |
| `docs/demo-runbook.md` | Hub-first stage sequence |

---

### Task 1: Live-call session store

**Files:**
- Create: `lib/sim/live-call.ts`
- Create: `lib/sim/live-call.test.ts`

**Produces:**
```ts
export type LiveCallSource = "clinician" | "patient";
export type LiveCallState = {
  active: boolean;
  conversationId: string | null;
  startedAt: number | null;
  source: LiveCallSource | null;
};
export function getLiveCall(): LiveCallState;
export function startLiveCall(args: { conversationId: string | null; source: LiveCallSource }): void;
export function clearLiveCall(): void;
export function subscribeLiveCall(listener: () => void): () => void;
```

Use `sessionStorage` key `mend.liveCall` when `typeof window !== "undefined"`. In-memory fallback for SSR/tests. `subscribeLiveCall` uses a simple Set of listeners + `storage` event for cross-tab best-effort.

- [ ] **Step 1: Write failing tests** in `lib/sim/live-call.test.ts` for start/clear/get and subscribe notification.
- [ ] **Step 2: Implement store**
- [ ] **Step 3: `npx vitest run lib/sim/live-call.test.ts` PASS**
- [ ] **Step 4: Commit** `feat(sim): add live-call session store for hub strip`

---

### Task 2: `/api/call` accepts optional `source`

**Files:**
- Modify: `app/api/call/route.ts`
- Modify: `app/api/call/route.test.ts`

**Produces:** Body may include `source?: "clinician" | "patient"`. Response includes `source` echo when provided. Telephony unchanged.

- [ ] **Step 1: Extend tests** — valid source echoed; invalid source ignored (treat as undefined).
- [ ] **Step 2: Implement parse + response field**
- [ ] **Step 3: Run call route tests PASS**
- [ ] **Step 4: Commit** `feat(api): echo optional call source for hub UX`

---

### Task 3: `CallStage` hub variant

**Files:**
- Modify: `app/components/call/CallStage.tsx`

**Produces:** `variant?: "stage" | "hub"` (default `"stage"`). Hub: shorter header, no stage-keyboard help chrome if present, `min-h` suitable for embed (`min-h-[28rem]` / `lg:min-h-[32rem]`), keep transcript + LiveVitals + EscalationTakeover.

- [ ] **Step 1: Add prop + conditional classes** — do not break `/call` defaults.
- [ ] **Step 2: Smoke `tsc --noEmit`**
- [ ] **Step 3: Commit** `feat(call): hub layout variant for embedded live session`

---

### Task 4: Clinician hub UI + Call now + Ops

**Files:**
- Create: `app/components/clinician/ClinicianHub.tsx` (client)
- Create: `app/components/clinician/HubOpsPanel.tsx` (client) — port essential controls from DemoConsole (scenario, call is NOT only here — Call now is primary on hub; Ops has vitals/ECG/BLE/transcript/scenario)
- Modify: `app/clinician/page.tsx` — pass roster + render `<ClinicianHub />`
- May reuse pieces from `app/clinician/[patientId]/page.tsx` by extracting shared chart body or importing server-fetched props into hub for the selected patient (Margaret / first roster id by default)

**Behavior:**
1. Select patient from worklist (default demo Margaret if present in roster).
2. Idle: show chart summary for selection (severity, action, link to full `/clinician/[id]` for deep detail if needed).
3. **Call now** → `POST /api/call` `{ source: "clinician" }` → `startLiveCall` → switch main pane to `<CallStage variant="hub" .../>` with same data wiring approach as `/call/page.tsx` (fixtures/scenario).
4. `#ops` or disclosure opens HubOpsPanel.

**Important:** For CallStage data, prefer extracting a shared loader helper from `app/call/page.tsx` into e.g. `app/components/call/load-call-stage-props.ts` if needed — or pass a thin client wrapper `HubLiveCall` that fetches `/api/...` — simplest path: client component that imports scenario fixtures the same way call page does via a small shared module. Read `app/call/page.tsx` and reuse.

- [ ] **Step 1: Implement ClinicianHub + wire page**
- [ ] **Step 2: Call now + live pane**
- [ ] **Step 3: Ops panel**
- [ ] **Step 4: `tsc` + focused tests; commit** `feat(clinician): hub with call-now and embedded live session`

---

### Task 5: Live strip in ClinicianShell

**Files:**
- Create: `app/components/clinician/LiveCallStrip.tsx`
- Modify: `app/components/clinician/ClinicianShell.tsx` — make client boundary or nest client strip; update NAV (Hub label, remove peer “Live call” or point to `/clinician?live=1`)

**Behavior:** If `getLiveCall().active` and pathname is not the live pane focus, show strip with Return → `/clinician?live=1`.

- [ ] **Step 1: Implement strip + shell**
- [ ] **Step 2: Commit** `feat(clinician): persistent live-call strip in shell`

---

### Task 6: Patient portal

**Files:**
- Create: `app/patient/page.tsx`
- Create: `app/components/patient/PatientPortal.tsx`
- Optional: `app/components/patient/copy.ts`

**Behavior:** Margaret copy; Request check-in call → `/api/call` `{ source: "patient" }` → `startLiveCall`; trial tip; link to `/family`; disclaimer.

- [ ] **Step 1: Build portal**
- [ ] **Step 2: Commit** `feat(patient): portal with immediate check-in call request`

---

### Task 7: Landing platform CTAs + console redirect

**Files:**
- Modify: `app/components/landing/copy.ts`, `Hero.tsx`, `Surfaces.tsx` / `Close.tsx` as needed
- Modify: `app/components/landing/copy.test.ts` — update honesty tests; allow clinician/patient routes
- Modify: `app/console/page.tsx` — `redirect("/clinician#ops")`
- Modify: `docs/demo-runbook.md` — hub-first sequence

**Copy:**
- Primary CTA: `Open clinician hub` → `/clinician`
- Secondary: `Patient portal` → `/patient` (mailto Talk to us can move to footer/nav)

- [ ] **Step 1: Landing + tests**
- [ ] **Step 2: Console redirect + runbook**
- [ ] **Step 3: Commit** `feat(landing): platform CTAs for clinician hub and patient portal`

---

### Task 8: Verify + deploy

- [ ] `npx tsc --noEmit && npm test && npm run build`
- [ ] Visual: `/clinician`, `/patient`, `/` projector + phone
- [ ] Manual: Call now from hub; Request call from patient (same browser); strip on `/clinician/engine`
- [ ] `git push origin main && vercel --prod --yes`
- [ ] Update `.superpowers/sdd/progress-hub.md` ledger

---

## Spec coverage

| Spec | Task |
|---|---|
| liveCall store | 1 |
| API source | 2 |
| CallStage hub variant | 3 |
| Clinician hub + Call now + Ops | 4 |
| Live strip | 5 |
| Patient portal auto-dial | 6 |
| Landing CTAs + console redirect | 7 |
| Verification / deploy | 8 |
