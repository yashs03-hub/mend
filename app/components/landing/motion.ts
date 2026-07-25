"use client";

import { useReducedMotion, type Variants } from "framer-motion";

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.06 },
  },
};

export const viewportOnce = { once: true, amount: 0.25 } as const;

export function useLandingMotion() {
  const reduce = Boolean(useReducedMotion());
  const reducedFade: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: 0.2 } },
  };
  return {
    reduce,
    // Reduced-motion: paint immediately (no scroll-gated travel / fade-in).
    initial: reduce ? ("show" as const) : ("hidden" as const),
    fadeUp: reduce ? reducedFade : fadeUp,
    staggerContainer: reduce
      ? ({ hidden: {}, show: {} } satisfies Variants)
      : staggerContainer,
    viewportOnce,
  };
}
