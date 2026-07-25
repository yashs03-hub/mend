# Clinical decision log

Recorded rationale for rule sensitivity choices in the red-flag engine. The README notes
that thresholds are "plausible but uncited"; this file records the *decisions* made about
them and who made them, which is the second half of what provenance requires.

Every entry: the choice, the alternative rejected, the reasoning, and the direction of
error the choice accepts.

---

## 2026-07-25 — Sepsis RED fires on fever + tachycardia without a required source

**Rule:** `sepsis.*` in `lib/clinical/red-flag-engine.ts`

**Decision:** Fever with marked tachycardia in the post-op window escalates to RED (ER)
regardless of whether a source such as wound discharge is identified.

**Rejected alternative:** Requiring an identified source (wound discharge or subjective
fever) for RED, downgrading source-less presentations to AMBER.

**Reasoning:** Post-operative sepsis frequently presents before a source is localisable,
and the patient self-reporting by phone is the least reliable possible observer of their
own wound. Requiring a source would push the engine toward reassurance in exactly the
presentation where delay is most costly.

**Accepted error direction:** Over-triage. Some patients with a benign febrile illness
will be sent to the ER. This is the intended direction under the project's fail-safe
mandate.

**Signed off by:** project clinical lead, 2026-07-25.

---

## 2026-07-25 — Hip dislocation RED fires on 2 of 3 classic signs

**Rule:** `dislocation.*` in `lib/clinical/red-flag-engine.ts`

**Decision:** Any two of {sudden severe hip pain, leg shortened or rotated, unable to
weight-bear} escalates to RED.

**Rejected alternative:** Requiring all three signs, which would match the original
vignette exactly and raise specificity.

**Reasoning:** Sudden severe pain with inability to weight-bear after hip arthroplasty is
a dislocation until proven otherwise. Requiring the full triad depends on the patient
self-observing limb rotation and length over the phone, which is not a reliable
observation to gate an emergency on.

**Accepted error direction:** Over-triage.

**Signed off by:** project clinical lead, 2026-07-25.

---

## 2026-07-25 — Temperature trend threshold set at +0.15 C/day

**Rule:** `trend.tempC.*` in `lib/clinical/trends.ts`

**Decision:** A least-squares temperature slope of >= +0.15 C/day over the trailing window
raises an AMBER trend finding, even while every individual reading remains inside the
phase envelope.

**Rejected alternative:** Omitting temperature from trend analysis entirely, leaving it to
the absolute-threshold rules in the red-flag engine.

**Reasoning:** A steadily climbing temperature inside the normal post-op envelope is the
characteristic early signature of a developing deep infection, and it is invisible to any
single-reading threshold. The specific figure is an engineering judgment, not a cited
value.

**Accepted error direction:** Over-triage, and sensitivity to noisy home thermometers.

**Status:** UNCITED — engineering judgment by the implementer, not clinically signed off.
Needs the same provenance treatment as the phase envelopes before any real use.
