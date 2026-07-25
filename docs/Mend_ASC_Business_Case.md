# Investor & Strategic Business Case: Mend for US Ambulatory Surgery Centers (ASCs)
*A post-operative remote safety net enabling capacity expansion in outpatient orthopaedics.*

---

## 1. Executive Summary

### The Opportunity
Elective joint replacement is migrating rapidly from inpatient hospital wards to Ambulatory Surgery Centers (ASCs). However, outpatient discharge at 4 hours post-operation has outpaced post-discharge safety infrastructure. Currently, ASCs rely on a single 24-hour follow-up phone call to monitor patients during a high-risk 30-day recovery window.

### The Thesis
Mend is an automated, voice-based post-discharge monitoring platform. Unlike existing solutions that market themselves on "readmission reduction," **Mend's primary economic value is capacity expansion**. By establishing a secure, clinical-grade home safety net, Mend allows ASC medical directors and surgeon-owners to confidently widen patient selection criteria—accepting older, higher ASA class (ASA III), or socially isolated patients who would otherwise be referred to inpatient hospitals.

### Financial Summary
For a mid-sized orthopaedic ASC performing 400 total joint cases per year:
* **Gross Annual Benefit**: **$70,354** ($52,500 from capacity expansion, $14,014 from reclaimed nursing hours, and $3,840 from avoided hospital rescue penalties).
* **Mend annual cost**: **$39,995** (priced at $95 per monitored case).
* **Net Annual Benefit**: **$30,359** (yielding a **1.8x Return on Investment**).

---

## 2. Market Overview & Trends

The US outpatient orthopaedic market is undergoing a structural shift driven by regulatory changes and payer incentives:

1. **CMS Regulatory Catalyst**: Medicare removed Total Knee Arthroplasty (TKA, CPT 27447) from the Inpatient-Only (IPO) list in 2018, followed by Total Hip Arthroplasty (THA, CPT 27130) in 2020. Both were added to the ASC Covered Procedures List (CPL), shifting the baseline care model for Medicare beneficiaries to same-day discharge.
2. **Payer Alignment**: Private commercial insurers (e.g., UnitedHealth, Aetna) actively incentivize or mandate outpatient joint replacement due to a 30-40% lower cost of care in the ASC setting compared to hospital outpatient departments (HOPDs).
3. **Volume Growth**: Outpatient joint replacement volumes are projected to grow by **over 100% between 2020 and 2030**, representing the single largest growth vector in elective surgery.

---

## 3. Why Now?

While the surgical, anesthetic, and rapid-rehabilitation protocols for same-day joints are highly mature, the post-discharge phase remains a critical clinical "black box":

* **Complication Windows**: Serious complications do not occur in the first 24 hours. Deep Vein Thrombosis (DVT) and Pulmonary Embolism (PE) peak between days 7 and 10. Prosthetic Joint Infection (PJI) typically declares itself between weeks 2 and 4.
* **The Surveillance Gap**: While inpatient stays historically provided 72 hours of continuous clinical observation, the ASC model discharges patients within 4 to 6 hours of surgery. The safety net has been outsourced entirely to the patient’s family, who lack clinical training.
* **Referral Defense**: Readmissions and emergency department (ED) visits within 30 days of an ambulatory joint are heavily scrutinized quality metrics. High complication rates directly harm an ASC’s reputation, leading to lost referrals from regional primary care networks.

---

## 4. The Clinical Problem & Mend's Safety Net

ASCs face a binary triage dilemma:
1. **Conservative Patient Selection (Low Yield)**: Reject borderline candidates (e.g., patients age >75, those with controlled sleep apnea, or those living alone) to avoid post-operative complications.
2. **Aggressive Patient Selection (High Risk)**: Risk unmonitored home recovery failures, leading to high ED presentation rates and unplanned readmissions.

### The Mend Solution
Mend bridges this gap by deploying an automated, voice-first remote safety net:

```
  [4-Hour Discharge] ──▶ [Daily Voice Call] ──▶ [Vitals Fusion] ──▶ [Deterministic Engine] ──▶ [Clinician Handoff]
                             (Mend AI)            (BP/HR/Temp)         (Tested Safety Rules)        (SBAR Summary)
```

* **Voice-First Accessibility**: Mend uses natural speech (via ElevenLabs and local keyword spotters) rather than a smartphone app, ensuring high compliance among elderly populations (average joint replacement age is 67).
* **Objective Vitals Fusion**: Triage decisions do not rely solely on patient self-reports. Mend fuses subjective symptoms with objective vitals (heart rate, blood pressure, temperature) via connected home monitors.
* **Deterministic Rules Engine**: Triage logic executes inside a closed, audited ruleset (e.g., [red-flag-engine.ts](file:///Users/yashsewpaul/code/mend/lib/clinical/red-flag-engine.ts)). This prevents LLM hallucinations and generates clear, traceable rationales for every clinician alert.

---

## 5. Economic Model & Value Drivers

The economic value of Mend is structured across three distinct financial value lines, weighted by their commercial impact:

```
  Annual Gains Breakdown (Single Center Model)
  ┌───────────────────────────────────────────────────────────┐
  │ ███████████████████████████████████████ Capacity ($52,500)│
  │ ██████████████ Labour ($14,014)                           │
  │ ███ Rescues ($3,840)                                      │
  └───────────────────────────────────────────────────────────┘
```

### Value Line 1: Case Capacity Expansion (Dominant Driver)
ASCs routinely decline otherwise eligible joint candidates due to post-operative safety concerns or a lack of strong social support at home. By offering a continuous post-op safety net, the medical director can expand the selection envelope.
* **Baseline volume**: 400 joint cases/year.
* **Declined cases (safety/social)**: 60 cases/year.
* **Recovered cases (35% accepted with monitoring)**: 21 cases/year.
* **Facility contribution margin per case**: $2,500.
* **Annual Capacity Gain**: **$52,500** (21 cases * $2,500).

### Value Line 2: Nursing Labor Efficiency (Reliable Driver)
ASC post-op nurses spend significant time attempting to reach patients for manual follow-up calls, frequently ending in voicemail tag. Mend automates routine check-ins, escalating only patients who breach clinical thresholds.
* **Baseline nursing follow-up time**: 10 hours/week.
* **Loaded nurse hourly rate**: $55/hour.
* **Mend absorption rate**: 70% of routine calls handled.
* **Annual Labor Reclaimed**: **$14,014** (10 hours * 52 weeks * $55 * 70%).

### Value Line 3: Avoided Unplanned Hospital Rescues (Supporting Driver)
Reducing ED visits and readmissions within the 30-day global window.
* **30-day hospital return rate**: 4% (16 patients out of 400).
* **Mend clinical reduction rate**: 20%.
* **Avoided rescues**: 3.2 visits/year.
* **Average ASC penalty/unplanned care cost**: $1,200.
* **Annual Rescue Savings**: **$3,840** (3.2 * $1,200).

---

## 6. Market Sizing (TAM / SAM / SOM)

### Total Addressable Market (TAM)
* **Definition**: All elective primary total joint replacements (THA & TKA) performed in the United States.
* **Size**: **~1,250,000 procedures/year** (generating a TAM of **$118M** at $95/case).

### Serviceable Addressable Market (SAM)
* **Definition**: Total joint replacements performed in Ambulatory Surgery Centers (ASCs).
* **Size**: **~400,000 procedures/year** (generating a SAM of **$38M**).

### Serviceable Obtainable Market (SOM)
* **Definition**: Outpatient joints performed in physician-owned, single-specialty orthopaedic ASCs running dedicated total joint programs.
* **Size**: **~60,000 procedures/year** across ~150 target centers (generating an SOM of **$5.7M**).

---

## 7. Competitive Landscape

Mend occupies a distinct niche by addressing the structural fragmentation of the ASC market:

| Category | Representative Competitors | Target Segment | What They Leave Uncovered |
|---|---|---|---|
| **Digital Rehab / Engagement** | Force Therapeutics, Zimmer Biomet MyMobility | Large Hospital Systems | Built for long-term exercise compliance. Highly reliant on app downloads, leaving elderly, non-tech-savvy cohorts unmonitored. |
| **Discharge Outreach Tools** | CipherHealth, GetWellNetwork | Enterprise Multi-specialty | Generic, text-only SMS survey workflows. Lack objective vitals integration and orthopaedic-specific safety engines. |
| **EHR-Native Companions** | Epic MyChart Care Companion | Enterprise Hospital Systems | Hard-coded into large hospital EHR instances (Epic/Cerner). Out of scope for the majority of ASCs that run independent, lightweight EHRs. |
| **Mend** | *Mend* | **Independent ASCs** | **Voice-first, vitals-fused, deterministic safety rules, offline-capable, and EHR-agnostic.** |

---

## 8. Go-To-Market (GTM) Strategy

We deploy a three-phased GTM model targeting decision-makers with the direct economic incentive of capacity expansion:

```
  Phase 1: Physician-Owned ASCs ──▶ Phase 2: Orthopaedic MSOs ──▶ Phase 3: Bundled Conveners
  (Surgeon-owners bypass committees)   (AmSurg / USPI / SCA)       (Signify Health / at-risk)
```

1. **Phase 1: Physician-Owned Orthopaedic ASCs**: We sell directly to surgeon-partners. Because they own the facility, they directly pocket the $2,500 contribution margin of every additional case. This bypasses long hospital purchasing committees.
2. **Phase 2: Orthopaedic Management Services Organizations (MSOs)**: Partner with national MSOs (e.g., USPI, AmSurg, SCA Health) that manage hundreds of ASCs under unified clinical governance.
3. **Phase 3: Bundled-Payment Conveners**: Sell to organizations managing at-risk clinical contracts (CMS BPCI Advanced), where preventing a single post-operative readmission directly impacts the convener's bottom line.

---

## 9. Pricing Strategy

To reduce purchasing friction, Mend uses a **Volume-Tiered annual subscription model**:

* **Pricing**: Flat annual subscription corresponding to a tier of estimated monitored cases (e.g., $30,000/year for up to 350 cases, adjusting to $95 per case for overage).
* **Alignment**: Subscription pricing aligns with the annual budget cycles of ASC IT procurement, avoiding per-case billing issues.
* **Value Justification**: The annual subscription is fully paid off if the center recovers just **12 additional cases per year** (a 3.0% expansion in patient volume).

---

## 10. Risks & Assumptions

### Risk 1: The "Load-Bearing" Capacity Assumption
* **Impact**: Critical. If the ASC medical director does not actually loosen selection criteria to accept more patients, the net benefit of Mend drops, resulting in a financial shortfall.
* **Mitigation**: Pre-sell and validate this specific threshold with the ASC board during contract setup.

### Risk 2: Global Period Billing Constraints
* **Impact**: Medium. Remote physiological monitoring (RPM/RTM) codes are typically bundled into the 90-day global surgical period for joint arthroplasty, preventing separate billing.
* **Mitigation**: Mend does not rely on reimbursement billing. The product clears on pure **operating efficiency and facility margin** alone. Any reimbursement represents pure upside.

---

## 11. Validation Plan

Before scaling sales, the following steps are required to validate our core assumptions:

1. **Structured Customer Discovery**: Conduct interviews with three target ASC Medical Directors to verify the exact number of patients they currently decline due to post-op social support concerns.
2. **Shadow-Mode Retrospective Evaluation**: Run the Mend safety engine against a retrospective cohort of 200 patients to calculate the sensitivity and specificity of its thresholds compared to actual clinical outcomes.
3. **Pilot Adherence Audit**: Audit the first 50 pilot cases to measure real-world device compliance under the voice-prompt protocol.

---

## 12. Investment Conclusion

Mend represents a highly asymmetric investment opportunity in the digital health space:
* It targets a **rapidly growing, high-margin niche (outpatient joints)** that is currently ignored by enterprise EHR giants.
* It sells on **revenue expansion (capacity)** rather than cost containment, aligning directly with the financial interests of surgeon-owners.
* The software architecture is highly scalable, requiring minimal integration and providing a keyless, robust fallback to survive clinic wifi failures.

**Recommendation**: Proceed with investment to fund the Phase 1 GTM pilot.
