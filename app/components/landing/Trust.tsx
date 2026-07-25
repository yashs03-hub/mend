"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { landingCopy } from "./copy";
import { useLandingMotion } from "./motion";

export function Trust() {
  const { fadeUp, staggerContainer, viewportOnce, initial } = useLandingMotion();
  const c = landingCopy.trust;

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
        <ul className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {c.points.map((point) => (
            <motion.li
              key={point.title}
              variants={fadeUp}
              className="border-t border-line pt-6"
            >
              <h3 className="font-heading text-subhead text-ink">{point.title}</h3>
              <p className="mt-3 text-body text-ink-secondary">{point.body}</p>
              {point.title === "Rules you can open" ? (
                <Link
                  href="/clinician/engine"
                  className="mt-4 inline-flex min-h-11 items-center text-label text-ink underline-offset-4 hover:underline"
                >
                  Inspect the rule engine →
                </Link>
              ) : null}
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </section>
  );
}
