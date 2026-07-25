"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Phone } from "lucide-react";
import { SeverityChip } from "@/components/ui/severity-chip";
import type { Decision, Phase, VitalsReading } from "@/lib/clinical/types";
import { severityToken } from "@/lib/ui/severity";
import { callTarget } from "./readouts";
import { formatCallClock } from "./timeline";
import { useHydrated } from "./use-hydrated";

/**
 * The takeover. When the deterministic engine returns red, the clinical pane
 * stops being a dashboard and becomes one instruction.
 *
 * Everything on it is a rendering of the `Decision` the engine produced —
 * the condition it named, the action it chose, the number it said to call,
 * and the ids of the rules that fired. Nothing here is decided at render
 * time, which is the point: the screen can be read back against the audit
 * trail line for line.
 *
 * The colour comes from the severity token and nowhere else, and it never
 * travels alone: the icon and the word "Urgent" are on screen at the same
 * size whether or not a projector holds the red.
 */

const LABEL = "text-eyebrow font-medium uppercase";
const PAPER = "var(--color-paper)";
const PAPER_DIM = "color-mix(in srgb, var(--color-paper) 88%, transparent)";

function Reading({
  label,
  value,
  bound,
}: {
  label: string;
  value: string;
  bound: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className={LABEL} style={{ color: PAPER_DIM }}>
        {label}
      </p>
      <p className="numeric text-2xl font-medium 2xl:text-3xl" style={{ color: PAPER }}>
        {value}
      </p>
      <p className="numeric text-meta" style={{ color: PAPER_DIM }}>
        {bound}
      </p>
    </div>
  );
}

export function EscalationTakeover({
  decision,
  vitals,
  phase,
  elapsed,
}: {
  decision: Decision;
  vitals: VitalsReading;
  phase: Phase;
  /** Seconds into the call at which the engine returned this decision. */
  elapsed: number;
}) {
  const reduceMotion = useReducedMotion();
  const token = severityToken(decision.level);
  const target = callTarget(decision);

  // Reduced motion changes only how long the transition takes, never the
  // styles either end of it: the server cannot read the media query, so a
  // variant whose *shape* depended on it would hydrate into a mismatch.
  const instant = reduceMotion === true;
  const hydrated = useHydrated();

  const field: Variants = {
    hidden: { opacity: 0, clipPath: "inset(100% 0% 0% 0%)" },
    shown: {
      opacity: 1,
      clipPath: "inset(0% 0% 0% 0%)",
      transition: instant
        ? { duration: 0 }
        : {
            duration: 0.62,
            ease: [0.16, 1, 0.3, 1],
            when: "beforeChildren",
            staggerChildren: 0.08,
            delayChildren: 0.18,
          },
    },
    exit: { opacity: 0, transition: { duration: instant ? 0 : 0.2 } },
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 14 },
    shown: {
      opacity: 1,
      y: 0,
      transition: { duration: instant ? 0 : 0.42, ease: [0.16, 1, 0.3, 1] },
    },
  };

  const breathe = hydrated && !instant;

  const buttonFace = (
    <>
      <Phone aria-hidden="true" className="size-8 shrink-0 2xl:size-12" strokeWidth={2} />
      <span className="font-heading text-heading 2xl:text-[3.25rem] 2xl:leading-none">
        {target.buttonLabel}
      </span>
    </>
  );

  return (
    <motion.section
      data-severity={decision.level}
      variants={field}
      initial="hidden"
      animate="shown"
      exit="exit"
      aria-live="assertive"
      style={{ backgroundColor: token.fg, color: PAPER }}
      className="absolute inset-0 z-10 flex flex-col justify-between gap-6 overflow-y-auto px-7 py-7 2xl:gap-8 2xl:px-12 2xl:py-11"
    >
      <motion.div variants={item} className="flex items-center justify-between gap-4">
        <SeverityChip level={decision.level} size="lg" />
        <p className={LABEL} style={{ color: PAPER_DIM }}>
          <span className="numeric">Escalated at {formatCallClock(elapsed)}</span>
        </p>
      </motion.div>

      <motion.div variants={item} className="space-y-4">
        {decision.condition ? (
          <p
            className="text-lede font-medium tracking-[0.02em] uppercase 2xl:text-xl"
            style={{ color: PAPER_DIM }}
          >
            {decision.condition}
          </p>
        ) : null}
        <p
          className="font-heading text-title leading-[1.05] 2xl:text-display"
          style={{ color: PAPER }}
        >
          {target.imperative}
        </p>
      </motion.div>

      <motion.div variants={item}>
        {target.href ? (
          <motion.a
            href={target.href}
            className="flex min-h-[6.5rem] w-full items-center justify-center gap-5 rounded-xl px-8 py-6 shadow-raised transition-transform 2xl:min-h-[8rem]"
            style={{ backgroundColor: PAPER, color: token.fg }}
            data-severity={decision.level}
            animate={breathe ? { scale: [1, 1.012, 1] } : undefined}
            transition={
              breathe
                ? { duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: 1.2 }
                : undefined
            }
          >
            {buttonFace}
          </motion.a>
        ) : (
          <div
            className="flex min-h-[6.5rem] w-full items-center justify-center gap-5 rounded-xl px-8 py-6 shadow-raised 2xl:min-h-[8rem]"
            style={{ backgroundColor: PAPER, color: token.fg }}
            data-severity={decision.level}
          >
            {buttonFace}
          </div>
        )}
        <p className="pt-3 text-center text-label" style={{ color: PAPER_DIM }}>
          {target.detail} · Mend stays on the line until she has dialed
        </p>
      </motion.div>

      <motion.div
        variants={item}
        className="grid grid-cols-1 gap-5 rounded-xl px-6 py-5 sm:grid-cols-3"
        style={{ backgroundColor: "color-mix(in srgb, var(--color-paper) 14%, transparent)" }}
      >
        <Reading
          label="Heart rate"
          value={vitals.hr === undefined ? "—" : `${vitals.hr} bpm`}
          bound={`expected ≤ ${phase.normalEnvelope.hrMax}`}
        />
        <Reading
          label="Oxygen"
          value={vitals.spo2 === undefined ? "—" : `${vitals.spo2}%`}
          bound={`expected ≥ ${phase.normalEnvelope.spo2Min}%`}
        />
        <Reading
          label="Respiration"
          value={vitals.respRate === undefined ? "—" : `${vitals.respRate} /min`}
          bound="reported by device"
        />
      </motion.div>

      <motion.div variants={item} className="space-y-2.5">
        <p className={LABEL} style={{ color: PAPER_DIM }}>
          {decision.firedRules.length === 1 ? "Rule fired" : "Rules fired"}
        </p>
        <p className="numeric text-meta font-medium 2xl:text-label" style={{ color: PAPER }}>
          {decision.firedRules.join("  ·  ")}
        </p>
        {decision.rationale.map((line) => (
          <p key={line} className="text-meta 2xl:text-label" style={{ color: PAPER_DIM }}>
            {line}
          </p>
        ))}
      </motion.div>
    </motion.section>
  );
}
