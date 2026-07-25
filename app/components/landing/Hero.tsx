"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { landingCopy } from "./copy";
import { HeroProductPlane } from "./HeroProductPlane";
import { useLandingMotion } from "./motion";

export function Hero() {
  const { fadeUp, staggerContainer } = useLandingMotion();

  return (
    <section className="relative px-6 pb-16 pt-6 sm:px-10 sm:pb-24 lg:px-14">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="max-w-xl"
        >
          <motion.p
            variants={fadeUp}
            className="font-heading text-display tracking-tight text-ink"
          >
            {landingCopy.brand}
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="mt-6 font-heading text-heading tracking-tight text-ink sm:text-title"
          >
            {landingCopy.headline}
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-5 max-w-md font-serif text-lede text-ink-secondary"
          >
            {landingCopy.support}
          </motion.p>
          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <Link
              href={landingCopy.primaryHref}
              className="inline-flex min-h-12 items-center bg-ink px-6 text-label text-paper transition-opacity hover:opacity-90"
            >
              {landingCopy.primaryCta}
            </Link>
            <Link
              href={landingCopy.secondaryHref}
              className="inline-flex min-h-12 items-center px-2 text-label text-ink-secondary underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              {landingCopy.secondaryCta}
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="min-w-0"
        >
          <HeroProductPlane />
        </motion.div>
      </div>
    </section>
  );
}
