# Candidate evidence — reading list

**Retrieved from PubMed. Nothing here is a citation yet.**

A search returns candidates. It cannot confirm a threshold came from a paper,
and it cannot tell you whether a threshold validated on an examined patient
transfers to a phone call and four vitals. Each row below is something to read
and adjudicate, not something to cite.

Workflow: read → decide *supports / refutes / irrelevant* → record the verdict
and the adjusted threshold in `docs/CLINICAL_SOURCES.md` → get it signed off.

Retrieved 2026-07-25 · 12 hits per threshold.

## deterioration-score

**Where:** `red-flag-engine.ts — HR/BP/temp thresholds generally`

**Claim a human must verify:** NEWS2 is the appropriate published basis for generic deterioration thresholds, and what its validated cut-points are.

207 papers match this query; top 12 by relevance:

| | PMID | Year | Journal | Title |
|---|---|---|---|---|
| ☐ | [33243839](https://pubmed.ncbi.nlm.nih.gov/33243839/) | 2021 | Emerg Med J | Oxygen therapy and inpatient mortality in COPD exacerbation. |
| ☐ | [30470600](https://pubmed.ncbi.nlm.nih.gov/30470600/) | 2019 | Am J Emerg Med | Comparison of SIRS, qSOFA, and NEWS for the early identification of sepsis in the Emergency Department. |
| ☐ | [33839632](https://pubmed.ncbi.nlm.nih.gov/33839632/) | 2021 | Am J Emerg Med | Comparison of qSOFA, SIRS, and NEWS scoring systems for diagnosis, mortality, and morbidity of sepsis in emergency department. |
| ☐ | [36914194](https://pubmed.ncbi.nlm.nih.gov/36914194/) | 2023 | BMJ Open | Performance of digital early warning score (NEWS2) in a cardiac specialist setting: retrospective cohort study. |
| ☐ | [37730667](https://pubmed.ncbi.nlm.nih.gov/37730667/) | 2023 | J Biomed Semantics | Development and validation of the early warning system scores ontology. |
| ☐ | [32900406](https://pubmed.ncbi.nlm.nih.gov/32900406/) | 2022 | Disaster Med Public Health Prep | Predictive Value of 5 Early Warning Scores for Critical COVID-19 Patients. |
| ☐ | [30623422](https://pubmed.ncbi.nlm.nih.gov/30623422/) | 2019 | Acta Anaesthesiol Scand | Prehospital National Early Warning Score predicts early mortality. |
| ☐ | [37806223](https://pubmed.ncbi.nlm.nih.gov/37806223/) | 2024 | J Surg Res | Validation of NEWS2, SIRS, and qSOFA in Postoperative Cardiac Patients: A Retrospective Cohort Study. |
| ☐ | [41388251](https://pubmed.ncbi.nlm.nih.gov/41388251/) | 2025 | BMC Emerg Med | Respiratory National Early Warning Score for 28-day mortality prediction in suspected sepsis patients in the emergency department. |
| ☐ | [33547065](https://pubmed.ncbi.nlm.nih.gov/33547065/) | 2021 | Clin Med (Lond) | National Early Warning Score 2 (NEWS2) to identify inpatient COVID-19 deterioration: a retrospective analysis. |
| ☐ | [40138535](https://pubmed.ncbi.nlm.nih.gov/40138535/) | 2025 | Crit Care Explor | Multicenter Development and Prospective Validation of eCARTv5: A Gradient-Boosted Machine-Learning Early Warning Score. |
| ☐ | [37651762](https://pubmed.ncbi.nlm.nih.gov/37651762/) | 2023 | Am J Emerg Med | Prehospital National Early Warning Score as a predictor of massive transfusion in adult trauma patients. |

<details><summary>PubMed query used</summary>

```
("NEWS2"[tiab] OR "National Early Warning Score"[tiab]) AND (validation[tiab] OR "predictive value"[tiab] OR derivation[tiab]) AND humans[MeSH Terms] AND english[Language]
```

</details>

## sepsis

**Where:** `red-flag-engine.ts — tempC >= 38.5 AND hr > 120`

**Claim a human must verify:** The fever-plus-tachycardia pair used here is defensible against Sepsis-3 / qSOFA rather than invented.

952 papers match this query; top 12 by relevance:

| | PMID | Year | Journal | Title |
|---|---|---|---|---|
| ☐ | [38245889](https://pubmed.ncbi.nlm.nih.gov/38245889/) | 2024 | JAMA | International Consensus Criteria for Pediatric Sepsis and Septic Shock. |
| ☐ | [26903338](https://pubmed.ncbi.nlm.nih.gov/26903338/) | 2016 | JAMA | The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3). |
| ☐ | [29937192](https://pubmed.ncbi.nlm.nih.gov/29937192/) | 2018 | Lancet | Sepsis and septic shock. |
| ☐ | [39531053](https://pubmed.ncbi.nlm.nih.gov/39531053/) | 2024 | Intensive Care Med | Sepsis: key insights, future directions, and immediate goals. A review and expert opinion. |
| ☐ | [38968960](https://pubmed.ncbi.nlm.nih.gov/38968960/) | 2024 | Semin Respir Crit Care Med | Definition and Epidemiology of Sepsis. |
| ☐ | [40098600](https://pubmed.ncbi.nlm.nih.gov/40098600/) | 2025 | JAMA | Optimal Vasopressin Initiation in Septic Shock: The OVISS Reinforcement Learning Study. |
| ☐ | [26903335](https://pubmed.ncbi.nlm.nih.gov/26903335/) | 2016 | JAMA | Assessment of Clinical Criteria for Sepsis: For the Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3). |
| ☐ | [32572531](https://pubmed.ncbi.nlm.nih.gov/32572531/) | 2020 | Intensive Care Med | Incidence and mortality of hospital- and ICU-treated sepsis: results from an updated and expanded systematic review and meta-analysis. |
| ☐ | [26903336](https://pubmed.ncbi.nlm.nih.gov/26903336/) | 2016 | JAMA | Developing a New Definition and Assessing New Clinical Criteria for Septic Shock: For the Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3). |
| ☐ | [40743135](https://pubmed.ncbi.nlm.nih.gov/40743135/) | 2025 | PLoS Pathog | Is "pre-sepsis" the new sepsis? A narrative review. |
| ☐ | [37624600](https://pubmed.ncbi.nlm.nih.gov/37624600/) | 2023 | JAMA Netw Open | Sepsis Prediction Model for Determining Sepsis vs SIRS, qSOFA, and SOFA. |
| ☐ | [40423381](https://pubmed.ncbi.nlm.nih.gov/40423381/) | 2025 | Crit Care Nurs Q | Sepsis Epidemiology, Definitions, Scoring Systems, and Diagnostic Markers. |

<details><summary>PubMed query used</summary>

```
("Sepsis-3"[tiab] OR qSOFA[tiab] OR "quick SOFA"[tiab]) AND (criteria[tiab] OR definition[tiab] OR validation[tiab]) AND humans[MeSH Terms] AND english[Language]
```

</details>

## pe-vte

**Where:** `red-flag-engine.ts — breathless/chestPain + hr > 110`

**Claim a human must verify:** Heart rate > 110 is a supportable corroborating threshold for suspected PE, and what proportion of PE presents WITHOUT tachycardia.

90 papers match this query; top 12 by relevance:

| | PMID | Year | Journal | Title |
|---|---|---|---|---|
| ☐ | [30665906](https://pubmed.ncbi.nlm.nih.gov/30665906/) | 2019 | Postgrad Med J | ECG in suspected pulmonary embolism. |
| ☐ | [25863772](https://pubmed.ncbi.nlm.nih.gov/25863772/) | 2015 | J Emerg Med | Emergency Evaluation for Pulmonary Embolism, Part 1: Clinical Factors that Increase Risk. |
| ☐ | [22959541](https://pubmed.ncbi.nlm.nih.gov/22959541/) | 2012 | Best Pract Res Clin Haematol | Clinical presentation of deep vein thrombosis and pulmonary embolism. |
| ☐ | [39322474](https://pubmed.ncbi.nlm.nih.gov/39322474/) | 2024 | J Emerg Med | Pulmonary Embolism Rule-out Criteria: Diagnostic Accuracy and Impact of COVID-19. |
| ☐ | [34478718](https://pubmed.ncbi.nlm.nih.gov/34478718/) | 2022 | Chest | Heart Rate and Mortality in Patients With Acute Symptomatic Pulmonary Embolism. |
| ☐ | [33848094](https://pubmed.ncbi.nlm.nih.gov/33848094/) | 2022 | Pediatr Emerg Care | Presentation, Management and Outcomes of Pediatric Pulmonary Embolus: A Retrospective Review. |
| ☐ | [18827912](https://pubmed.ncbi.nlm.nih.gov/18827912/) | 2008 | Vasc Health Risk Manag | Pulmonary embolism in the elderly: a review on clinical, instrumental and laboratory presentation. |
| ☐ | [33025502](https://pubmed.ncbi.nlm.nih.gov/33025502/) | 2021 | J Thromb Thrombolysis | Occurrence of pulmonary embolism related to COVID-19. |
| ☐ | [37945410](https://pubmed.ncbi.nlm.nih.gov/37945410/) | 2024 | Eur J Intern Med | How to recognize pulmonary embolism in syncope patients: A simple rule. |
| ☐ | [24696111](https://pubmed.ncbi.nlm.nih.gov/24696111/) | 2014 | Eur Respir J | Identification of intermediate-risk patients with acute symptomatic pulmonary embolism. |
| ☐ | [36304801](https://pubmed.ncbi.nlm.nih.gov/36304801/) | 2022 | Acta Clin Croat | DIAGNOSIS OF PULMONARY EMBOLISM IN THE EMERGENCY DEPARTMENT. |
| ☐ | [37543614](https://pubmed.ncbi.nlm.nih.gov/37543614/) | 2023 | Respir Res | Validation of clinical-radiological scores for prognosis of mortality in acute pulmonary embolism. |

<details><summary>PubMed query used</summary>

```
("pulmonary embolism"[tiab] AND (tachycardia[tiab] OR "heart rate"[tiab]) AND (sensitivity[tiab] OR "clinical presentation"[tiab] OR "vital signs"[tiab])) AND humans[MeSH Terms] AND english[Language]
```

</details>

## vte-after-hip

**Where:** `recovery-graph.ts — implied VTE risk window`

**Claim a human must verify:** When VTE actually peaks after hip arthroplasty, which determines whether the monitoring window is the right length.

661 papers match this query; top 12 by relevance:

| | PMID | Year | Journal | Title |
|---|---|---|---|---|
| ☐ | [37606428](https://pubmed.ncbi.nlm.nih.gov/37606428/) | 2023 | Med Sci (Basel) | Venous Thromboembolism Prophylaxis in Major Orthopedic Surgeries and Factor XIa Inhibitors. |
| ☐ | [29466159](https://pubmed.ncbi.nlm.nih.gov/29466159/) | 2018 | N Engl J Med | Aspirin or Rivaroxaban for VTE Prophylaxis after Hip or Knee Arthroplasty. |
| ☐ | [12216974](https://pubmed.ncbi.nlm.nih.gov/12216974/) | 2002 | Am J Orthop (Belle Mead NJ) | Complications of total hip arthroplasty. |
| ☐ | [36512031](https://pubmed.ncbi.nlm.nih.gov/36512031/) | 2023 | Eur J Trauma Emerg Surg | Tranexamic acid in hip hemiarthroplasty surgery: a systematic review and meta-analysis. |
| ☐ | [40452196](https://pubmed.ncbi.nlm.nih.gov/40452196/) | 2025 | J Musculoskelet Neuronal Interact | Efficacy of Atorvastatin Against Venous Thromboembolism After Total Hip Arthroplasty. |
| ☐ | [23222928](https://pubmed.ncbi.nlm.nih.gov/23222928/) | 2012 | Int Angiol | Asian venous thromboembolism guidelines: prevention of venous thromboembolism. |
| ☐ | [39731033](https://pubmed.ncbi.nlm.nih.gov/39731033/) | 2024 | BMC Musculoskelet Disord | Efficacy and safety of aspirin in preventing venous thromboembolism after hip arthroplasty for femoral neck fracture: a noninferiority prospective cohort study. |
| ☐ | [3052057](https://pubmed.ncbi.nlm.nih.gov/3052057/) | 1988 | Am J Med | Hydroxychloroquine and postoperative thromboembolism after total hip replacement. |
| ☐ | [32824931](https://pubmed.ncbi.nlm.nih.gov/32824931/) | 2020 | Medicina (Kaunas) | An Update on Venous Thromboembolism Rates and Prophylaxis in Hip and Knee Arthroplasty in 2020. |
| ☐ | [2191811](https://pubmed.ncbi.nlm.nih.gov/2191811/) | 1990 | Clin Cardiol | Deep vein thrombosis: prophylaxis, diagnosis, and treatment--lessons from orthopedic studies. |
| ☐ | [39482927](https://pubmed.ncbi.nlm.nih.gov/39482927/) | 2024 | J Orthop Surg (Hong Kong) | A randomized controlled trial comparing carbazochrome sodium sulfonate and tranexamic acid in reducing blood loss and inflammatory response after simultaneous bilateral total hip arthroplasty. |
| ☐ | [11055889](https://pubmed.ncbi.nlm.nih.gov/11055889/) | 2000 | Semin Hematol | New therapeutic options in deep vein thrombosis prophylaxis. |

<details><summary>PubMed query used</summary>

```
("venous thromboembolism"[tiab] OR "deep vein thrombosis"[tiab] OR "pulmonary embolism"[tiab]) AND ("hip arthroplasty"[tiab] OR "hip replacement"[tiab] OR hemiarthroplasty[tiab]) AND (incidence[tiab] OR timing[tiab] OR "postoperative day"[tiab]) AND humans[MeSH Terms] AND english[Language]
```

</details>

## postop-fever-envelope

**Where:** `recovery-graph.ts — tempCMax 38.0 (days 0-13), 37.5 thereafter`

**Claim a human must verify:** THE LOAD-BEARING ONE. That early post-operative fever is predominantly non-infectious, and what temperature/day cut-point the literature supports.

27 papers match this query; top 12 by relevance:

| | PMID | Year | Journal | Title |
|---|---|---|---|---|
| ☐ | [28353448](https://pubmed.ncbi.nlm.nih.gov/28353448/) | 2017 | Infez Med | Predictive value of fever following arthroplasty in diagnosing an early infection. |
| ☐ | [32386473](https://pubmed.ncbi.nlm.nih.gov/32386473/) | 2020 | Can J Surg | Postoperative fever in the time of COVID-19. |
| ☐ | [36449067](https://pubmed.ncbi.nlm.nih.gov/36449067/) | 2023 | Arch Orthop Trauma Surg | Postoperative fever: differences between elective vs. traumatic hip, knee and shoulder arthroplasty. |
| ☐ | [20048106](https://pubmed.ncbi.nlm.nih.gov/20048106/) | 2010 | J Bone Joint Surg Am | The value of serum procalcitonin level for differentiation of infectious from noninfectious causes of fever after orthopaedic surgery. |
| ☐ | [24902928](https://pubmed.ncbi.nlm.nih.gov/24902928/) | 2015 | Knee Surg Sports Traumatol Arthrosc | Course of fever and potential infection after total joint replacement. |
| ☐ | [28851265](https://pubmed.ncbi.nlm.nih.gov/28851265/) | 2017 | J Orthop Surg (Hong Kong) | Post-operative fever in orthopaedic surgery: How effective is the 'fever workup?'. |
| ☐ | [9487422](https://pubmed.ncbi.nlm.nih.gov/9487422/) | 1997 | East Afr Med J | Post-operative pyrexia in an orthopaedic unit. |
| ☐ | [41174689](https://pubmed.ncbi.nlm.nih.gov/41174689/) | 2025 | Ital J Pediatr | Clinical characteristics and risk factors for pathological fractures in children with Staphylococcus aureus osteoarticular infections: a retrospective cohort study. |
| ☐ | [24522863](https://pubmed.ncbi.nlm.nih.gov/24522863/) | 2014 | Arch Orthop Trauma Surg | Characteristics and significance of fever during 4 weeks after primary total knee arthroplasty. |
| ☐ | [10546613](https://pubmed.ncbi.nlm.nih.gov/10546613/) | 1999 | Clin Orthop Relat Res | Febrile response after knee and hip arthroplasty. |
| ☐ | [20452174](https://pubmed.ncbi.nlm.nih.gov/20452174/) | 2010 | J Arthroplasty | Cost and effectiveness of postoperative fever diagnostic evaluation in total joint arthroplasty patients. |
| ☐ | [7814598](https://pubmed.ncbi.nlm.nih.gov/7814598/) | 1994 | J Pediatr Orthop | Postoperative fever in pediatric orthopaedic patients. |

<details><summary>PubMed query used</summary>

```
("postoperative fever"[tiab] OR "post-operative pyrexia"[tiab]) AND (arthroplasty[tiab] OR orthopedic[tiab] OR orthopaedic[tiab] OR "joint replacement"[tiab]) AND (infection[tiab] OR "non-infectious"[tiab] OR workup[tiab] OR evaluation[tiab]) AND humans[MeSH Terms] AND english[Language]
```

</details>

## pji-wound

**Where:** `red-flag-engine.ts — woundDischarge, temp above envelope`

**Claim a human must verify:** Wound discharge plus fever maps onto recognised PJI / surgical-site-infection criteria.

329 papers match this query; top 12 by relevance:

| | PMID | Year | Journal | Title |
|---|---|---|---|---|
| ☐ | [33380199](https://pubmed.ncbi.nlm.nih.gov/33380199/) | 2021 | Bone Joint J | The EBJIS definition of periprosthetic joint infection. |
| ☐ | [29551303](https://pubmed.ncbi.nlm.nih.gov/29551303/) | 2018 | J Arthroplasty | The 2018 Definition of Periprosthetic Hip and Knee Infection: An Evidence-Based and Validated Criteria. |
| ☐ | [41192529](https://pubmed.ncbi.nlm.nih.gov/41192529/) | 2026 | J Arthroplasty | International Consensus Meeting on Orthopaedic Infection: Differences Between ICM 2018 and ICM 2025. |
| ☐ | [37714518](https://pubmed.ncbi.nlm.nih.gov/37714518/) | 2024 | J ISAKOS | Debridement, antibiotics, and implant retention (DAIR) for the early prosthetic joint infection of total knee and hip arthroplasties: a systematic review. |
| ☐ | [31659475](https://pubmed.ncbi.nlm.nih.gov/31659475/) | 2020 | Arch Orthop Trauma Surg | General treatment principles for fracture-related infection: recommendations from an international expert group. |
| ☐ | [40965158](https://pubmed.ncbi.nlm.nih.gov/40965158/) | 2025 | Clin Microbiol Rev | Optimized use and performance of culture for periprosthetic joint infection diagnosis: a comprehensive literature review. |
| ☐ | [41921050](https://pubmed.ncbi.nlm.nih.gov/41921050/) | 2026 | J Bone Joint Surg Am | One-Stage Versus Two-Stage Exchange Arthroplasty for Periprosthetic Joint Infection: A Prospective Randomized Trial. |
| ☐ | [25913561](https://pubmed.ncbi.nlm.nih.gov/25913561/) | 2015 | J Arthroplasty | The Diagnosis of Periprosthetic Joint Infection. |
| ☐ | [37366187](https://pubmed.ncbi.nlm.nih.gov/37366187/) | 2023 | Acta Biomed | Diagnosis of periprosthetic hip infection: a clinical update. |
| ☐ | [41013706](https://pubmed.ncbi.nlm.nih.gov/41013706/) | 2025 | J Orthop Surg Res | Periprosthetic joint infection after arthroplasty: advances and future prospects. |
| ☐ | [22075161](https://pubmed.ncbi.nlm.nih.gov/22075161/) | 2011 | J Arthroplasty | New definition for periprosthetic joint infection. |
| ☐ | [40782944](https://pubmed.ncbi.nlm.nih.gov/40782944/) | 2026 | J Arthroplasty | Novel Technologies in Periprosthetic Joint Infection: Emerging Diagnostics. |

<details><summary>PubMed query used</summary>

```
("periprosthetic joint infection"[tiab] AND (criteria[tiab] OR diagnosis[tiab]) AND (MSIS[tiab] OR "International Consensus"[tiab] OR definition[tiab])) AND humans[MeSH Terms] AND english[Language]
```

</details>

## dislocation

**Where:** `red-flag-engine.ts — suddenSevereHipPain + shortened/rotated OR non-weight-bearing`

**Claim a human must verify:** The shortened-and-rotated / unable-to-weight-bear pair is the recognised presentation of prosthetic dislocation.

50 papers match this query; top 12 by relevance:

| | PMID | Year | Journal | Title |
|---|---|---|---|---|
| ☐ | [27999925](https://pubmed.ncbi.nlm.nih.gov/27999925/) | 2017 | Int Orthop | Total hip arthroplasty instability in Italy. |
| ☐ | [31628149](https://pubmed.ncbi.nlm.nih.gov/31628149/) | 2020 | Emerg Med J | Is a hip flip the right trick? |
| ☐ | [27872981](https://pubmed.ncbi.nlm.nih.gov/27872981/) | 2017 | Int Orthop | Dual-mobility arthroplasty failure: a rationale review of causes and technical considerations for revision. |
| ☐ | [37084922](https://pubmed.ncbi.nlm.nih.gov/37084922/) | 2023 | J Arthroplasty | Fibromyalgia Increases Post-operative Healthcare Utilization Following total Hip Arthroplasty. |
| ☐ | [25757209](https://pubmed.ncbi.nlm.nih.gov/25757209/) | 2016 | J Pediatr Orthop | Adolescent Hip Dislocation Combined With Proximal Femoral Physeal Fractures and Epiphysiolysis. |
| ☐ | [39038867](https://pubmed.ncbi.nlm.nih.gov/39038867/) | 2024 | BMJ Open | Association between diabetes mellitus and total hip arthroplasty outcomes: an observational study using the US National Inpatient Sample. |
| ☐ | [27837400](https://pubmed.ncbi.nlm.nih.gov/27837400/) | 2017 | Clin Orthop Relat Res | Are Readmissions After THA Preventable? |
| ☐ | [35447277](https://pubmed.ncbi.nlm.nih.gov/35447277/) | 2022 | J Arthroplasty | Outcomes Following Total Hip Arthroplasty in Patients With Postpolio Syndrome: A Matched Cohort Analysis. |
| ☐ | [14974039](https://pubmed.ncbi.nlm.nih.gov/14974039/) | 2004 | Cochrane Database Syst Rev | Posterior versus lateral surgical approach for total hip arthroplasty in adults with osteoarthritis. |
| ☐ | [16856020](https://pubmed.ncbi.nlm.nih.gov/16856020/) | 2006 | Cochrane Database Syst Rev | Posterior versus lateral surgical approach for total hip arthroplasty in adults with osteoarthritis. |
| ☐ | [35356923](https://pubmed.ncbi.nlm.nih.gov/35356923/) | 2022 | Medicine (Baltimore) | Pseudotumor and delayed recurrent dislocation after total hip arthroplasty with a modular femoral neck: A case report. |
| ☐ | [18001186](https://pubmed.ncbi.nlm.nih.gov/18001186/) | 2007 | J Womens Health (Larchmt) | Safety of pregnancy and delivery after total hip arthroplasty. |

<details><summary>PubMed query used</summary>

```
(("hip dislocation"[tiab] OR "prosthetic dislocation"[tiab]) AND (arthroplasty[tiab] OR hemiarthroplasty[tiab]) AND (presentation[tiab] OR diagnosis[tiab] OR "clinical features"[tiab])) AND humans[MeSH Terms] AND english[Language]
```

</details>

## delirium

**Where:** `red-flag-engine.ts — newConfusion -> amber`

**Claim a human must verify:** New confusion warrants same-day rather than emergency escalation in this cohort, and how often it signals something else.

487 papers match this query; top 12 by relevance:

| | PMID | Year | Journal | Title |
|---|---|---|---|---|
| ☐ | [34928310](https://pubmed.ncbi.nlm.nih.gov/34928310/) | 2022 | JAMA | Effect of Regional vs General Anesthesia on Incidence of Postoperative Delirium in Older Patients Undergoing Hip Fracture Surgery: The RAGA Randomized Trial. |
| ☐ | [34623788](https://pubmed.ncbi.nlm.nih.gov/34623788/) | 2021 | N Engl J Med | Spinal Anesthesia or General Anesthesia for Hip Surgery in Older Adults. |
| ☐ | [35156194](https://pubmed.ncbi.nlm.nih.gov/35156194/) | 2022 | Cochrane Database Syst Rev | Arthroplasties for hip fracture in adults. |
| ☐ | [34591127](https://pubmed.ncbi.nlm.nih.gov/34591127/) | 2022 | Calcif Tissue Int | Effects of Orthogeriatric Care Models on Outcomes of Hip Fracture Patients: A Systematic Review and Meta-Analysis. |
| ☐ | [34218905](https://pubmed.ncbi.nlm.nih.gov/34218905/) | 2021 | Br J Anaesth | Preoperative inflammatory mediators and postoperative delirium: systematic review and meta-analysis. |
| ☐ | [36031067](https://pubmed.ncbi.nlm.nih.gov/36031067/) | 2022 | Int J Surg | The impact of regional versus general anesthesia on postoperative neurocognitive outcomes in elderly patients undergoing hip fracture surgery: A systematic review and meta-analysis. |
| ☐ | [34302312](https://pubmed.ncbi.nlm.nih.gov/34302312/) | 2022 | J Clin Nurs | Evaluation of the effectiveness of delirium prevention care protocol for the patients with hip fracture: A randomised controlled study. |
| ☐ | [21716111](https://pubmed.ncbi.nlm.nih.gov/21716111/) | 2011 | Curr Opin Crit Care | Postoperative cognitive disorders. |
| ☐ | [38267405](https://pubmed.ncbi.nlm.nih.gov/38267405/) | 2024 | Transl Psychiatry | Prediction models for postoperative delirium in elderly patients with machine-learning algorithms and SHapley Additive exPlanations. |
| ☐ | [40513143](https://pubmed.ncbi.nlm.nih.gov/40513143/) | 2025 | J Clin Anesth | Preoperative low-dose dexmedetomidine reduces postoperative delirium in elderly patients with hip fracture under spinal anesthesia: A randomized, double blind, controlled clinical study. |
| ☐ | [39985018](https://pubmed.ncbi.nlm.nih.gov/39985018/) | 2025 | BMC Med | Effect of combination of multiple anti-inflammatory drugs strategy on postoperative delirium among older patients undergoing hip fracture surgery: a pilot randomized controlled trial. |
| ☐ | [41255934](https://pubmed.ncbi.nlm.nih.gov/41255934/) | 2025 | Clin Interv Aging | Postoperative Serum NLRP1 as a Biochemical Predictor of Delirium and Cognitive Decline After Hip Fracture Surgery in Elderly Patients: A Single Center Observational Study. |

<details><summary>PubMed query used</summary>

```
(delirium[tiab] AND ("hip fracture"[tiab] OR "hip arthroplasty"[tiab]) AND (incidence[tiab] OR "risk factors"[tiab] OR outcome[tiab] OR 4AT[tiab])) AND humans[MeSH Terms] AND english[Language]
```

</details>

## phase-boundaries

**Where:** `recovery-graph.ts — day 0-13 / 14-41 / 42+`

**Claim a human must verify:** MOST INVENTED PART OF THE SYSTEM. When complications actually occur after hip arthroplasty, which is what the phase boundaries should track.

485 papers match this query; top 12 by relevance:

| | PMID | Year | Journal | Title |
|---|---|---|---|---|
| ☐ | [38134323](https://pubmed.ncbi.nlm.nih.gov/38134323/) | 2024 | Postgrad Med J | Enhanced recovery after surgery in patients after hip and knee arthroplasty: a systematic review and meta-analysis. |
| ☐ | [36863397](https://pubmed.ncbi.nlm.nih.gov/36863397/) | 2024 | Z Orthop Unfall | Intraoperative Acetabular Fracture. |
| ☐ | [37024039](https://pubmed.ncbi.nlm.nih.gov/37024039/) | 2023 | J Shoulder Elbow Surg | Outcomes of acute vs. delayed reverse shoulder arthroplasty for proximal humerus fractures in the elderly: a systematic review and meta-analysis. |
| ☐ | [28042116](https://pubmed.ncbi.nlm.nih.gov/28042116/) | 2017 | Bone Joint J | Obesity in total hip arthroplasty: does it make a difference? |
| ☐ | [32763019](https://pubmed.ncbi.nlm.nih.gov/32763019/) | 2020 | Injury | Tranexamic acid in hip hemiarthroplasty. |
| ☐ | [31633660](https://pubmed.ncbi.nlm.nih.gov/31633660/) | 2020 | J Am Acad Orthop Surg | Complications After Pediatric Hip Fractures: Evaluation and Management. |
| ☐ | [35568138](https://pubmed.ncbi.nlm.nih.gov/35568138/) | 2022 | J Arthroplasty | Volume and Outcomes of Joint Arthroplasty. |
| ☐ | [38320106](https://pubmed.ncbi.nlm.nih.gov/38320106/) | 2024 | Int J Surg | Trends and benefits of early hip arthroplasty for femoral neck fracture in China: a national cohort study. |
| ☐ | [29451943](https://pubmed.ncbi.nlm.nih.gov/29451943/) | 2018 | Orthopedics | Dual Diagnosis and Total Hip Arthroplasty. |
| ☐ | [36512031](https://pubmed.ncbi.nlm.nih.gov/36512031/) | 2023 | Eur J Trauma Emerg Surg | Tranexamic acid in hip hemiarthroplasty surgery: a systematic review and meta-analysis. |
| ☐ | [32540306](https://pubmed.ncbi.nlm.nih.gov/32540306/) | 2020 | J Arthroplasty | Emergency Department Presentation After Total Hip and Knee Arthroplasty: A Systematic Review. |
| ☐ | [28065622](https://pubmed.ncbi.nlm.nih.gov/28065622/) | 2017 | J Arthroplasty | Is Outpatient Total Hip Arthroplasty Safe? |

<details><summary>PubMed query used</summary>

```
(("total hip arthroplasty"[tiab] OR hemiarthroplasty[tiab]) AND (complications[tiab] OR readmission[tiab]) AND (timing[tiab] OR "30-day"[tiab] OR NSQIP[tiab])) AND humans[MeSH Terms] AND english[Language]
```

</details>

## remote-monitoring-transfer

**Where:** `docs/CLINICAL_SOURCES.md — the threshold-transfer problem`

**Claim a human must verify:** Whether anyone has studied how in-person-validated deterioration thresholds behave under remote monitoring — the gap this whole product sits in.

13 papers match this query; top 12 by relevance:

| | PMID | Year | Journal | Title |
|---|---|---|---|---|
| ☐ | [31379218](https://pubmed.ncbi.nlm.nih.gov/31379218/) | 2019 | Expert Rev Med Devices | Telemedicine in patients with peripheral arterial disease: is it worth the effort? |
| ☐ | [36169200](https://pubmed.ncbi.nlm.nih.gov/36169200/) | 2023 | J Surg Oncol | Feasibility of perioperative remote monitoring of patient-generated health data in complex surgical oncology. |
| ☐ | [40000568](https://pubmed.ncbi.nlm.nih.gov/40000568/) | 2025 | Obes Surg | Remote Patient Monitoring Following Same-Day Discharge Bariatric Surgery: A Systematic Review and Meta-analysis. |
| ☐ | [40211952](https://pubmed.ncbi.nlm.nih.gov/40211952/) | 2026 | Ann Surg | Randomized Controlled Trial-Perioperative Telemonitoring of Patient-Generated Health Data in Gastrointestinal Oncologic (GI) Surgery: Assessing Outcomes. |
| ☐ | [36085116](https://pubmed.ncbi.nlm.nih.gov/36085116/) | 2023 | Eur J Surg Oncol | A wearable patch based remote early warning score (REWS) in major abdominal cancer surgery patients. |
| ☐ | [27451860](https://pubmed.ncbi.nlm.nih.gov/27451860/) | 2016 | J Surg Res | Use of digital health kits to reduce readmission after cardiac surgery. |
| ☐ | [36812167](https://pubmed.ncbi.nlm.nih.gov/36812167/) | 2023 | PLoS One | Telemonitoring for perioperative care of outpatient bariatric surgery: Preference-based randomized clinical trial. |
| ☐ | [37415024](https://pubmed.ncbi.nlm.nih.gov/37415024/) | 2023 | Obes Surg | Lessons Learned from Telemonitoring in an Outpatient Bariatric Surgery Pathway-Secondary Outcomes of a Patient Preference Clinical Trial. |
| ☐ | [35063007](https://pubmed.ncbi.nlm.nih.gov/35063007/) | 2022 | Trials | Postbariatric EArly discharge Controlled by Healthdot (PEACH) trial: study protocol for a preference-based randomized trial. |
| ☐ | [32186521](https://pubmed.ncbi.nlm.nih.gov/32186521/) | 2020 | J Med Internet Res | Postoperative Remote Automated Monitoring and Virtual Hospital-to-Home Care System Following Cardiac and Major Vascular Surgery: User Testing Study. |
| ☐ | [34313956](https://pubmed.ncbi.nlm.nih.gov/34313956/) | 2022 | Updates Surg | The role of telemedicine in the postoperative home monitoring after robotic colo-rectal cancer surgery: a preliminary single center experience. |
| ☐ | [40333921](https://pubmed.ncbi.nlm.nih.gov/40333921/) | 2025 | PLoS One | Implementation of a surgical ward innovation: Telemonitoring controlled by healthdot [SWITCH-trial PROTOCOL]. |

<details><summary>PubMed query used</summary>

```
("remote patient monitoring"[tiab] OR telemonitoring[tiab]) AND (postoperative[tiab] OR "post-discharge"[tiab]) AND (surgery[tiab] OR arthroplasty[tiab]) AND (deterioration[tiab] OR readmission[tiab] OR "early warning"[tiab]) AND humans[MeSH Terms] AND english[Language]
```

</details>
