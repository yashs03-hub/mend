export const landingCopy = {
  brand: "Mend",
  headline: "Recovery doesn’t end at discharge.",
  support:
    "Voice check-ins at home. A deterministic clinical engine. The right person notified when something drifts.",
  primaryCta: "Open clinician hub",
  primaryHref: "/clinician",
  secondaryCta: "Patient portal",
  secondaryHref: "/patient",
  contactCta: "Talk to us",
  gap: {
    eyebrow: "The gap",
    title: "After discharge, everyone loses the plot.",
    support:
      "Hospitals lose visibility. Families are left with a phone tree. Complications surface late.",
    systemsTitle: "Health systems",
    systemsBody:
      "Post-op patients go home and the care team’s line of sight drops. Drift shows up as a readmission, not a Tuesday morning call.",
    familiesTitle: "Patients and families",
    familiesBody:
      "An elderly patient will answer a calm daily call. They will not open another app. Families need a clear update without clinical jargon.",
  },
  how: {
    eyebrow: "How Mend works",
    title: "One morning event. Three audiences.",
    support:
      "Language models extract and speak. A deterministic engine decides. Escalation is never improvised.",
    beats: [
      {
        title: "Morning voice check-in",
        body: "Mend calls the patient, listens in plain language, and confirms what matters before anything else happens.",
      },
      {
        title: "Deterministic clinical engine",
        body: "Symptoms and vitals meet cited red-flag rules against the recovery phase. The LLM never chooses green, amber, or red.",
      },
      {
        title: "The right people, same truth",
        body: "Patient call guidance, family update, and clinician worklist all reflect the same engine decision.",
      },
    ],
  },
  trust: {
    eyebrow: "Why trust it",
    title: "Clinical rigor you can inspect.",
    support: "Credibility from architecture — not logo walls or invented pilots.",
    points: [
      {
        title: "Rules you can open",
        body: "Every threshold includes provenance. The vignette suite at /clinician/engine shows what fires and why.",
      },
      {
        title: "Fail-safe by design",
        body: "On ambiguity, missing data, or poor signal quality, Mend escalates. It never reassures into uncertainty.",
      },
      {
        title: "Devices stay devices",
        body: "Mend consumes FDA-cleared determinations from home ECG hardware. It does not re-derive rhythm from a waveform.",
      },
    ],
  },
  surfaces: {
    eyebrow: "Also available",
    title: "Quiet deep links for the demo.",
    support:
      "The hub and patient portal are the product entries. These remain for judges who want a specific seat.",
  },
  close: {
    title: "Built for the hardest week after surgery.",
    support:
      "A voice-first recovery co-pilot for orthopedics — calm when it’s fine, decisive when it isn’t.",
  },
} as const;

/** Optional quiet deep links — not the primary conversion path. */
export const PRODUCT_SURFACES = [
  {
    href: "/clinician",
    label: "Clinician hub",
    note: "Daily worklist and live call",
    quiet: true,
  },
  {
    href: "/patient",
    label: "Patient portal",
    note: "Request a check-in call",
    quiet: true,
  },
  {
    href: "/family",
    label: "Family",
    note: "Caregiver morning update",
    quiet: true,
  },
  {
    href: "/clinician/engine",
    label: "Rule engine",
    note: "Deterministic safety rules",
    quiet: true,
  },
] as const;
