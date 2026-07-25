"use client";

import { motion } from "framer-motion";
import { landingCopy } from "./copy";
import { useLandingMotion } from "./motion";

export function HowItWorks() {
  const { fadeUp, staggerContainer, viewportOnce, initial } = useLandingMotion();
  const c = landingCopy.how;

  return (
    <section className="border-t border-line bg-wash/40 px-6 py-20 sm:px-10 sm:py-28 lg:px-14">
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
        <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {c.beats.map((beat, index) => (
            <motion.li
              key={beat.title}
              variants={fadeUp}
              className="border-t border-line pt-6"
            >
              <p className="numeric text-meta text-ink-tertiary">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-3 font-heading text-subhead text-ink">
                {beat.title}
              </h3>
              <p className="mt-3 text-body text-ink-secondary">{beat.body}</p>
            </motion.li>
          ))}
        </ol>
      </motion.div>
    </section>
  );
}
