"use client";

import { motion } from "framer-motion";
import { landingCopy } from "./copy";
import { useLandingMotion } from "./motion";

export function Gap() {
  const { fadeUp, staggerContainer, viewportOnce, initial } = useLandingMotion();
  const c = landingCopy.gap;

  return (
    <section className="border-t border-line px-6 py-20 sm:px-10 sm:py-28 lg:px-14">
      <motion.div
        className="mx-auto max-w-6xl"
        variants={staggerContainer}
        initial={initial}
        whileInView="show"
        viewport={viewportOnce}
      >
        <motion.p variants={fadeUp} className="eyebrow">
          {c.eyebrow}
        </motion.p>
        <motion.h2
          variants={fadeUp}
          className="mt-4 max-w-2xl font-heading text-heading tracking-tight text-ink"
        >
          {c.title}
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="mt-4 max-w-xl font-serif text-lede text-ink-secondary"
        >
          {c.support}
        </motion.p>
        <div className="mt-14 grid gap-12 md:grid-cols-2 md:gap-16">
          <motion.div variants={fadeUp} className="border-t border-line pt-6">
            <h3 className="font-heading text-subhead text-ink">{c.systemsTitle}</h3>
            <p className="mt-3 text-body text-ink-secondary">{c.systemsBody}</p>
          </motion.div>
          <motion.div variants={fadeUp} className="border-t border-line pt-6">
            <h3 className="font-heading text-subhead text-ink">{c.familiesTitle}</h3>
            <p className="mt-3 text-body text-ink-secondary">{c.familiesBody}</p>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
