# Mend — demo runbook

Everything needed to set up, rehearse and present. Read this end to end once before
rehearsing; on the day, work from the checklists.

## What Mend is, in one paragraph

Margaret is 82, four days post hip hemiarthroplasty, living alone. Mend phones her, has a
warm unhurried conversation, and extracts what she reports. It fuses that with objective
vitals — live heart rate from a watch over Bluetooth, an FDA-cleared rhythm determination
from a KardiaMobile 6L, manual SpO2 and temperature — and runs it through a deterministic
clinical engine. **The language model never makes the escalation decision.** Claude
extracts, parses and writes prose; a plain TypeScript function called `evaluate()` returns
green, amber or red, and every threshold it uses carries a `source` string naming its
provenance. That separation is the product's central claim, and the demo is built to make it
visible rather than merely assert it.

## Pre-flight 1 — credentials

All values go in `.env` at the repo root, which is gitignored.

A `.env.local` also exists — `vercel link` created it and it holds only a `VERCEL_OIDC_TOKEN`.
Leave it alone. Next.js gives `.env.local` higher precedence than `.env`, but only for keys it
actually defines, so it will not shadow anything you add to `.env`. Don't add your keys there,
because keeping one file authoritative is what stops you debugging a value that was being
overridden all along.

For the deployed site, local files are irrelevant — Vercel needs its own copy:

```bash
vercel env add ANTHROPIC_API_KEY production   # repeat per variable
vercel --prod                                  # redeploy to pick them up
```

**These aren't independent.** The ElevenLabs agent can't be finished until *after* Vercel is
deployed and the Twilio number is bought, because the agent config needs the live
`/api/triage` URL and the phone number ID only exists once the number is imported. Work in
this order.

### Tier 1 — local development (~15 min, unblocks everything except the phone)

| Variable | Where |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → Settings → API keys → Create Key |
| `NEXT_PUBLIC_SUPABASE_URL` | supabase.com/dashboard → new project → Settings → API → "Project URL" |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page, "anon public" |
| `SUPABASE_SERVICE_ROLE_KEY` | same page, "service_role secret" |

The Anthropic account needs prepaid credit; $5 covers the weekend. That one key unlocks
symptom extraction, SBAR generation and Kardia PDF reading — the highest value per minute
spent, so get it first. It is also the one key without which you cannot demonstrate a green
outcome from a typed check-in; see "Why the transcript fallback needs the Anthropic key"
below.

For Supabase pick the London region (you're at Encode Hub) and then open the SQL Editor,
paste in `lib/db/schema.sql`, and run it. That file seeds Margaret itself, so there's no
separate seeding step. It is written to be safe to re-run, so if anyone provisioned a
database before today, run it again — a later fix added a `pain_score` column that the pain
trend needs, and without it that trend silently degrades on real data.

`ANTHROPIC_MODEL` is optional — the code falls back to a sensible default.

With Tier 1 alone the whole pipeline works via the hub Ops transcript box (`/clinician#ops`):
extraction, red-flag evaluation, trends, SBAR, persistence. Everything but the phone ringing.

### Tier 2 — the phone demo, in this exact order

1. `ELEVENLABS_API_KEY` — elevenlabs.io → profile → API Keys.
2. Twilio account, then buy a number with voice capability. Console home shows
   `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`; the number is `TWILIO_FROM_NUMBER` in
   E.164 (`+44…`).
3. `DEMO_PATIENT_PHONE` and `DEMO_CAREGIVER_PHONE` — your mobile and a teammate's, E.164.
   **On a Twilio trial you can only call verified numbers.** Verify both under Phone Numbers
   → Verified Caller IDs now. Finding this out on Sunday morning would be painful.
4. Deploy: `npx vercel --prod`, and set every variable in the Vercel dashboard. You need the
   live URL before the next step.
5. Create the ElevenLabs agent (config below) and copy `ELEVENLABS_AGENT_ID`.
6. Import the Twilio number into ElevenLabs and link it to the agent. That import is what
   produces `ELEVENLABS_AGENT_PHONE_NUMBER_ID` — it does not exist before this point, which
   is why it's last.

### Tier 3 — generate yourself

`TRIAGE_WEBHOOK_SECRET` — run `openssl rand -hex 32`. It must be **identical** in three
places: `.env`, the Vercel dashboard, and the ElevenLabs webhook tool header config. A
mismatch fails closed, so the agent calls the tool, gets rejected, and on stage that looks
exactly like the agent ignoring the patient.

Hub Ops (`/clinician#ops`, or legacy `/console` which redirects there) shows a live banner
naming every variable still missing, so open it after editing `.env` to confirm what's wired.

## Pre-flight 2 — the ElevenLabs agent

**Persona.** Warm, unhurried, elderly-friendly. Short sentences. One question at a time.
Explicit read-back of any critical symptom ("Just to check — you're a little short of
breath?"). US terminology throughout: ER, 911, care team, nurse line. No NHS terms.

**Webhook tool** pointing at `https://<your-app>.vercel.app/api/triage`:

- `method: "POST"`
- `response_timeout_secs: 10`
- `interruption_mode: "disable_during_tool"`
- `pre_tool_speech` set, so the agent says something while it waits instead of going silent
- the shared secret as a header, matching `TRIAGE_WEBHOOK_SECRET`

**The prompt must state that the agent speaks the returned `script` verbatim and never
substitutes its own judgement.** This is not a stylistic preference. The endpoint returns
deterministic language generated by `lib/clinical/scripts.ts` from the engine's decision; an
agent that paraphrases has silently become the decision-maker, which is the exact thing the
architecture exists to prevent.

## Pre-flight 3 — device checklist

| Item | State it must be in |
|---|---|
| Polar Pacer Pro or Garmin Vivoactive 5 | Charged, **broadcasting heart rate inside a started activity** — HR is not broadcast when the watch is idle. This is the single most common failure. |
| Browser | Chrome or Edge on desktop. Web Bluetooth does not exist in Safari or on iOS. |
| KardiaMobile 6L | Two PDFs already exported to the laptop: one at rest, one immediately after exercise for a genuine tachycardic trace. Do not plan to record live. |
| Demo phone | Charged, **on speaker**, ringer up, Do Not Disturb off. |
| SpO2 reading | A real spot reading noted down, for manual entry. |
| Laptop | Charged, notifications silenced, `/clinician` open (Ops ready via `#ops` or `Ctrl/⌘⇧M`). |

Every real reading belongs to the operator, never a patient, and the UI labels it that way.

## The stage sequence (hub-first)

Two presenters works best: one talks, one drives. The driver never talks; the talker never
touches the laptop.

**Open on `/clinician`.** This is the daily clinician hub — worklist, Margaret's chart, Call
now. Say who Margaret is and why post-op day 4 alone at home is the dangerous window. Don't
explain the architecture yet. (Landing CTAs: Open clinician hub / Patient portal.)

**Pick the scenario** in Ops if needed (`#ops` or `Ctrl/⌘⇧M` → redirects to `/clinician#ops`)
— PE/red for the peak cut. Ops is secondary; do not live in it.

**Trigger the call** from the hub — **Call now**. The phone rings on speaker. This is the
moment that separates Mend from a demo video: a real outbound phone call to a real handset
in the room. (Optional alternate: open `/patient` and tap Request a check-in call — same
telephony path; hub live strip lights up in the clinician browser.)

**Twilio trial (current account):** after answering, you will hear Twilio's trial announcement.
The driver (or the person holding the phone) must **press any key** on the handset. Only then
does the ElevenLabs media stream attach and Mend speak. Do not hang up during the trial line.
Upgrading off Trial removes this step; until then, rehearse the keypress.

**Let the conversation run in the hub.** The embedded live session shows transcript and
clinical pane. When the agent hits the safety engine, an inline marker appears — "checking
against the safety engine". Point at it. That marker is the architectural claim made visible:
the model asked a deterministic function what to do.

**The escalation.** The engine returns red and the clinical pane takes over: the condition,
one instruction, the call target, and the fired rules. Let it land before speaking. If the
driver navigates away, the sticky live strip keeps the session reachable.

**Cut to `/family`.** Same event, the daughter's phone. Plain language, no numbers, no rule
ids. The contrast with what the clinician sees is the point — one engine, three audiences,
each told exactly what they can act on. Prefer opening `/family` with no query string after
selecting PE in hub Ops (durable store). If you need a deep link for the PE cut, use
`/family?state=urgent` — never `?state=attention` (that is the drift/amber frame).

**Return to `/clinician`.** Worklist sorted by risk, the SBAR ready to hand off, and the audit
trail expanded to show fired rules with their inputs, thresholds and provenance. This is
what makes it deployable rather than a toy.

**Close on `/clinician/engine`.** The vignette suite running live. Fifteen clinical cases,
deterministic pass/fail, in front of the judges. Then the line that lands: *the model never
decides; it extracts, and this function decides.* The live strip still returns to the hub if
a call is active.

**If there's time, show the drift scenario.** Margaret's heart rate climbing about 3 bpm a
day while every individual reading sits inside the normal post-op envelope — no single
threshold can see it, and the trend engine projects when she crosses the boundary. This is
the most intellectually differentiated thing in the build and the part a physician judge will
recognise fastest.

## Fallbacks — one for every step

| If this fails | Do this |
|---|---|
| Phone doesn't ring | Use the transcript box in hub Ops (`/clinician#ops`). Identical pipeline — extract, evaluate, compose, SBAR — just typed instead of spoken. Say so plainly; don't pretend. **Requires `ANTHROPIC_API_KEY`** — see the note below. |
| Phone rings but only the Twilio trial message | Press any key on the handset; Mend should start. If still silent, check ElevenLabs conversation `stream_sid` and that the agent has the `clinical_triage` tool. |
| Watch won't pair | Manual vitals entry in hub Ops. Validated against the same plausibility gate. |
| Kardia extraction fails | Select the scenario in hub Ops; the fixture ECG determination is used. |
| Supabase is down | Fixture fallbacks carry the demo; the engine and every view still run. |
| Venue wifi collapses | Run localhost. Everything except the outbound call works offline. |
| Total failure | Play the backup video. |

**Record the backup video Saturday night, not Sunday morning.** Capture the red path end to
end, phone audio included. The one time you'll need it is the one time there's no time to
make it.

### Why the transcript fallback needs the Anthropic key

Symptom extraction fails safe. If Mend cannot understand what the patient said — no API key,
a failed tool call, a transport error — it does **not** treat that as "she reported nothing".
It fires an amber `symptoms.extraction_failed` finding, because an unreadable check-in is
missing information, not reassurance.

The consequence for the demo is concrete: **without `ANTHROPIC_API_KEY`, every typed
check-in comes out amber**, including the green scenario. The engine is behaving correctly,
but you cannot show a green outcome through the transcript box until that key is set.

This is worth turning into a talking point rather than hiding. If a judge asks what happens
when the AI fails, the answer is that it escalates instead of reassuring, and you can
demonstrate it live by clearing the key. Very few teams can show their failure mode on
purpose.

## Being honest with judges

Four YC alumni building medtech will probe. Straight answers land better than hedging:

- Patient data is synthetic. Real device readings are the operator's own and labelled as
  such.
- It's an educational prototype, not a medical device, and every surface says so.
- Mend does not interpret ECG waveform. It consumes the KardiaMobile 6L's FDA-cleared
  determination as an input and never re-derives rhythm.
- Thresholds are cited where a citation exists. Two sensitivity choices and one trend
  threshold are engineering judgment, recorded as such in `docs/clinical-decisions.md`.
  Showing that file when asked about clinical rigour is stronger than claiming everything is
  sourced.
- Fail-safe direction is always toward escalation. On missing or poor-quality vitals it falls
  back to symptom-only rules and never reassures on uncertainty.

## Routes

| Route | Purpose |
|---|---|
| `/` | Landing — CTAs to clinician hub and patient portal |
| `/clinician` | Clinician hub — worklist, Call now, embedded live, Ops (`#ops`) |
| `/patient` | Patient portal — request check-in call |
| `/family` | Daughter's view |
| `/clinician/engine` | Live vignette suite |
| `/call` | Fullscreen live call deep link (hub embed is primary) |
| `/console` | Redirects to `/clinician#ops` (`Ctrl/⌘⇧M`) — never shown as product |
| `/styleguide` | Design system reference |

## Verifying the build

```bash
npx tsc --noEmit          # must be clean
npm test                  # all green
npm run build             # must compile
node scripts/visual-check.mjs   # all routes ok, "no accessibility findings"
```

The last one screenshots every route at projector, laptop and phone widths into `.visual/`
and runs contrast, touch-target and colour-only-severity checks. Look at the projector
screenshots before presenting — a past bug had `tailwind-merge` silently dropping font-size
classes with no build error, caught only by eye.
