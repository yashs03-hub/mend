# Dora (Ufonia) — the published precedent for what Mend is

Adjudicated 2026-07-25, prompted by *Eye* 2026;40(9):1416–18 (PMID 42032053).

An autonomous AI telephone assistant conducting post-operative follow-up has
already been built, trialled, deployed in routine NHS care, and published on
across five years. It is called **Dora**, from **Ufonia Ltd** (Oxford). Mend is
the same idea in a different surgical pathway.

This is the single most useful body of evidence in this repository, for a reason
that has nothing to do with clinical thresholds: **it gives Mend real numbers to
be measured against**, from a system that made the same bet and had to survive
contact with 1,580 real patients and a research ethics process.

## The papers

| Year | What it establishes | Citation |
|---|---|---|
| 2021 | Safety/acceptability protocol | *JMIR Res Protoc* 10(7):e27227. **PMID 34319248** |
| 2023 | Patient acceptability, Dora R1 | Khavandi S, Lim E, Higham A, et al. *Eye* 37(10):2069–76. **PMID 36274084** |
| 2023 | Workforce-automation protocol | *JMIR Res Protoc* 12:e49374. **PMID 38051569** |
| 2024 | **Accuracy and safety vs. ophthalmologists** | Meinert E, Milne-Ives M, Lim E, et al. *EClinicalMedicine* 73:102692. **PMID 39050586**. NCT05213390 / ISRCTN16038063 |
| 2026 | **Routine NHS deployment, 1,580 patients** | Higham A, Sideri AM, Tarcoveanu F, et al. *Clin Ophthalmol* 20:576990. **PMID 42023401** |
| 2026 | Patient-mediated outcome capture (Sightsnap) | Higham A, Lim E, Turner R, et al. *Eye* 40(9):1416–18. **PMID 42032053** |

Funding for the pivotal study: NIHR / NHSX **AI in Health and Care Award**
(AI_AWARD01852). Note the declared conflicts — several authors are Ufonia
employees or shareholders. The 2024 study mitigates this with real-time
ophthalmologist supervision and independent academic co-authors; the 2026
deployment paper is a service evaluation and is not blinded.

## Benchmarks Mend should be held to

### Safety — the number that matters

> **0.3%** of patients required an unplanned management change within two weeks
> of a Dora call that returned "no concerns identified" (routine deployment,
> n=1,269 completed calls). — PMID 42023401

That is the published bar for a **false green**. Mend's entire design premise is
"fail toward escalation"; this is what the incumbent achieves in production, and
it is the number to beat or match. It is also the number an ASC's medical
director will ask for.

Against a supervising ophthalmologist (n=202, Dora R1) — PMID 39050586:

| Metric | Dora R1 |
|---|---|
| Sensitivity | 94% |
| Specificity | 86% |
| Agreement (kappa) | 0.758–0.970 |
| Calls completed autonomously | 195/202 (**96.5%**) |
| Discharged by Dora, unexpected management change | 11/117 (9%) — *all also discharged by the supervising clinician* |
| Discharged by Dora but not by clinician | 4 — none required review on callback |

That last row is the honest one: on four occasions the machine was more willing
to discharge than the human, and on follow-up the machine was right. It is also
n=4, which is not an argument for anything.

### Completion — voice beats a link, by roughly eight-fold

This is the finding that should change Mend's design, and it comes from
comparing the two 2026 papers directly:

| Channel | Completion | Source |
|---|---|---|
| **Autonomous voice call** | **1,269 / 1,580 = 78%** | PMID 42023401 |
| **SMS link → tap → photograph → submit** | **1,071 / 11,189 = 9.6%** | PMID 42032053 |

Same company, same population, same era. Per-site SMS completion ranged 3–16%,
and 60% of people who *opened* the link did submit — so the loss is overwhelmingly
at "open the link at all", not at the task itself.

**Implication for Mend.** The Oxford Hip Score is currently offered as a tap-through
toggle in the patient portal — a link-shaped interaction, in the 9.6% column. The
daily check-in *call* is in the 78% column. If OHS completion matters, the
instrument should be collectable **over the voice channel that already reaches the
patient**, with the portal as the fallback rather than the primary route.

Caveats before acting on this: the two tasks are not equivalent (a phone call
answered is easier than finding a printed refraction and photographing it), and
one is an inbound call while the other is an outbound ask. The eight-fold gap is
too large to be explained away by that, but it is not a controlled comparison.

### Acceptability — good, with a specific and important limit

| Measure | Result | Source |
|---|---|---|
| Net Promoter Score, median | **9 / 10** | PMID 36274084 |
| Net Promoter Score, deployment | **47** | PMID 42023401 |
| Telephone Usability Questionnaire, overall | **4.0 / 5** | PMID 36274084 |
| "Simplicity", "time saving", "ease of use" | median **5 / 5** | PMID 36274084 |
| **"Speaking to Dora feels the same as speaking to a clinician"** | median **3 / 5** | PMID 36274084 |

Qualitative themes, verbatim: *"I can see why you're doing it"*, *"It went quite
well actually"*, **"I just trust human beings I suppose"**. And from the 2024
study: acceptability was good in routine circumstances, but patients were
concerned about the lack of a *"human element"* **in cases with complications**.

This directly answers the question asked earlier in this project — how patients
feel about being monitored by a machine. The published answer is: **fine when
things are going well, and not fine when they are not.** Acceptability is
conditional on the patient being *well*, which is precisely the population in
which it is least needed.

Design consequence for Mend: the escalation path must hand over to a human
early and visibly, not because the model cannot triage, but because the evidence
says acceptability collapses at exactly the moment triage matters. That is an
argument for the clinician-in-the-loop PRN approval flow, not against it.

### Digital inequality — the assumption to stop making

- Median age **77**; no significant difference in call outcomes by age, sex or
  ethnicity (PMID 42023401). The authors conclude it "does not exacerbate digital
  inequalities."
- SMS-photograph engagement was *highest* among **60–79 year-olds** and present
  across all ages (PMID 42032053), "countering assumptions that technology-enabled
  capture is unsuitable for this population."

Mend's persona is an 82-year-old. That is now an evidenced design centre rather
than a sympathetic guess. Note the ceiling on the claim: the deployment cohort was
**84% white**, and non-attendance at community optometry, not owning a smartphone,
and not retaining the printout are all named as unmeasured exclusions.

### Unit economics

**£35.18** staff cost benefit per patient vs. standard care (PMID 39050586).
UK NHS staffing, cataract pathway, 2022 prices — it does **not** transfer to a US
ASC billing RPM/RTM codes, and should not be quoted in the ASC business case as
though it does. It is a proof that the saving is real and measurable, not a
number to reuse.

## What this does *not* license

Every figure above comes from **cataract surgery**: a low-morbidity, high-volume,
day-case pathway with a single dominant complication profile and a three-week
follow-up window. Mend watches hip arthroplasty for VTE, PJI, dislocation and
delirium over 42+ days, in patients who are older, frailer and have more to go
wrong.

The transferable claims are about **the channel** — completion rates, patient
acceptability, autonomy rates, the age finding. The **safety** figures are
pathway-specific: a 0.3% false-green rate on cataract follow-up says nothing
directly about the false-green rate for a pulmonary embolus. It is the right
benchmark to aim at and the wrong number to claim.

## Competitive position

Ufonia is not a hypothetical competitor; it is a funded company with NHS
deployments, NIHR backing, regulatory experience and a five-paper evidence base,
operating in Mend's exact product category. Anything in
`Mend_ASC_Business_Case.html` or `Mend_ASC_Investment_Memorandum.html` implying
the category is unproven or unoccupied is wrong and should be corrected.

The defensible differentiation is not "AI calls patients after surgery" — that
exists and is published. It is the parts Dora does not do: a **deterministic
clinical core** that owns the verdict rather than a model, **continuous
physiologic input** rather than a single scheduled call, **medication and PRN
governance**, and a **US ASC reimbursement pathway** rather than an NHS
capacity one.
